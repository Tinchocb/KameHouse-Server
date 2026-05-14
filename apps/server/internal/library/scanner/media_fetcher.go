package scanner

import (
	"context"
	"errors"

	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/anime"
	librarymetadata "kamehouse/internal/library/metadata"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"kamehouse/internal/util/limiter"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"

	"github.com/rs/zerolog"
	"github.com/samber/lo"
	"golang.org/x/sync/errgroup"
)

// MediaFetcher holds all media that will be used for the comparison process
type MediaFetcher struct {
	AllMedia           []*dto.NormalizedMedia
	CollectionMediaIds []int
	UnknownMediaIds    []int // Media IDs that are not in the user's collection
	ScanLogger         *ScanLogger
}

type MediaFetcherOptions struct {
	PlatformRef            *util.Ref[platform.Platform]
	MetadataProviderRef    *util.Ref[metadata_provider.Provider]
	MetadataProviders      []librarymetadata.Provider
	LocalFiles             []*dto.LocalFile
	Logger                 *zerolog.Logger
	DisableAnimeCollection bool
	ScanLogger             *ScanLogger
	// used for adding custom sources
	OptionalAnimeCollection interface{}
	// TMDB mode
	TMDBProvider *librarymetadata.TMDBProvider
	SeriesPaths  []string
	MoviePaths   []string
	Database     *db.Database
}

// NewMediaFetcher creates a MediaFetcher using TMDB + folder structure
func NewMediaFetcher(ctx context.Context, opts *MediaFetcherOptions) (ret *MediaFetcher, retErr error) {
	defer util.HandlePanicInModuleWithError("library/scanner/NewMediaFetcher", &retErr)

	if opts.LocalFiles == nil || opts.Logger == nil {
		return nil, errors.New("missing options")
	}

	// If no TMDB provider is configured, return an empty fetcher
	// The caller will still be able to match files by other means
	if opts.TMDBProvider == nil {
		opts.Logger.Warn().Msg("scanner: No TMDB provider available, skipping remote media fetch")
		return &MediaFetcher{ScanLogger: opts.ScanLogger}, nil
	}

	return newMediaFetcherTMDB(ctx, opts)
}

//----------------------------------------------------------------------------------------------------------------------

// newMediaFetcherTMDB creates a MediaFetcher using TMDB + folder structure
func newMediaFetcherTMDB(ctx context.Context, opts *MediaFetcherOptions) (*MediaFetcher, error) {
	mf := new(MediaFetcher)
	mf.ScanLogger = opts.ScanLogger

	if mf.ScanLogger != nil {
		mf.ScanLogger.LogMediaFetcher(zerolog.InfoLevel).
			Msg("Creating media fetcher (TMDB mode)")
	}

	// 1. Fetch user's collection if available
	if !opts.DisableAnimeCollection && opts.PlatformRef != nil && !opts.PlatformRef.IsAbsent() {
		collection, err := opts.PlatformRef.Get().GetAnimeCollection(ctx, false)
		if err == nil && collection != nil {
			if c, ok := collection.(*platform.UnifiedCollection); ok {
				for _, list := range c.Lists {
					for _, entry := range list.Entries {
						if entry.Media != nil {
							mf.AllMedia = append(mf.AllMedia, anime.NewNormalizedMedia(entry.Media))
							mf.CollectionMediaIds = append(mf.CollectionMediaIds, entry.Media.ID)
						}
					}
				}
			}
		}
	}

	// 2. Parse titles from local files using pure robust name parser
	// This prevents the bug where generic root library folders like "Series" or "Peliculas" break TMDB
	libPaths := append([]string{}, opts.SeriesPaths...)
	libPaths = append(libPaths, opts.MoviePaths...)

	groups := lo.GroupBy(opts.LocalFiles, func(lf *dto.LocalFile) string {
		pm := parsedMediaFromLocalFile(lf)
		if pm.Title != "" {
			return pm.Title
		}

		info := ParseFolderStructure(lf.Path, libPaths)
		if isMeaningfulFolderTitle(info.SeriesName) {
			return info.SeriesName
		}

		// Folder context is only a last resort and must be semantically useful.
		return meaningfulImmediateFolderTitle(lf.Path)
	})

	var mu sync.Mutex
	eg, egCtx := errgroup.WithContext(ctx)
	eg.SetLimit(runtime.NumCPU() * 2)
	tmdbLimiter := limiter.NewTmdbLimiter()

	// 3. Initialize Metadata Cache (Persistent)
	metaCache := newMetadataFetchCache(opts.Database)

	// Pre-inject all Dragon Ball movie IDs from the resolver
	if opts.TMDBProvider != nil && (len(opts.MoviePaths) > 0 || len(opts.SeriesPaths) > 0) {
		priorityIds := make(map[int]bool)
		for _, lf := range opts.LocalFiles {
			parentDir := filepath.Base(filepath.Dir(lf.Path))
			combinedName := parentDir + " " + lf.Name
			if dbId, isMovie, isDb := ResolveDragonBallID(combinedName); isDb {
				if isMovie {
					priorityIds[dbId+1000000] = true
				} else {
					priorityIds[dbId] = true
				}
			}
			info := ParseFolderStructure(lf.Path, opts.MoviePaths)
			if dbId, isMovie, isDb := ResolveDragonBallID(info.SeriesName); isDb {
				if isMovie {
					priorityIds[dbId+1000000] = true
				} else {
					priorityIds[dbId] = true
				}
			}
		}

		if len(priorityIds) > 0 {
			for dbId := range priorityIds {
				id := dbId
				eg.Go(func() error {
					mu.Lock()
					exists := lo.SomeBy(mf.AllMedia, func(m *dto.NormalizedMedia) bool { return m.ID == id })
					mu.Unlock()
					if exists {
						return nil
					}

					_ = tmdbLimiter.Wait(egCtx)
					result, err := opts.TMDBProvider.GetMediaDetails(egCtx, strconv.Itoa(id))

					mu.Lock()
					defer mu.Unlock()
					if err != nil || result == nil {
						mf.AllMedia = append(mf.AllMedia, &dto.NormalizedMedia{
							ID: id,
							Title: &dto.NormalizedMediaTitle{
								UserPreferred: lo.ToPtr("Dragon Ball Match (Pending Metadata)"),
							},
						})
					} else {
						mf.AllMedia = append(mf.AllMedia, result)
					}
					return nil
				})
			}
		}
	}

	for title, files := range groups {
		titleGroup := title
		groupFiles := files
		eg.Go(func() error {
			if titleGroup == "" {
				return nil
			}
			lowerGroup := strings.ToLower(titleGroup)
			if lowerGroup == "series" || lowerGroup == "peliculas" || lowerGroup == "películas" || lowerGroup == "movies" || lowerGroup == "anime" || lowerGroup == "tv" || lowerGroup == "tv shows" || lowerGroup == "films" {
				return nil
			}

			// Determine type hint based on file paths
			var hint string
			if len(groupFiles) > 0 {
				nfp := filepath.ToSlash(filepath.Clean(groupFiles[0].Path))
				for _, rp := range opts.SeriesPaths {
					if rp == "" {
						continue
					}
					nrp := filepath.ToSlash(filepath.Clean(rp))
					if !strings.HasSuffix(nrp, "/") {
						nrp += "/"
					}
					if strings.HasPrefix(nfp, nrp) {
						hint = "series"
						break
					}
				}
				if hint == "" {
					for _, rp := range opts.MoviePaths {
						if rp == "" {
							continue
						}
						nrp := filepath.ToSlash(filepath.Clean(rp))
						if !strings.HasSuffix(nrp, "/") {
							nrp += "/"
						}
						if strings.HasPrefix(nfp, nrp) {
							hint = "movie"
							break
						}
					}
				}
				if hint == "" {
					info := ParseFolderStructure(groupFiles[0].Path, libPaths)
					if info.IsMovie {
						hint = "movie"
					}
				}
			}

			mu.Lock()
			anilistMatch, ok := findAniListExactMatch(mf.AllMedia, titleGroup)
			mu.Unlock()

			if ok {
				if mf.ScanLogger != nil {
					mf.ScanLogger.LogMediaFetcher(zerolog.InfoLevel).
						Str("title", titleGroup).
						Int("anilist_id", anilistMatch.ID).
						Msg("anilist_resolver: Matched title strictly with offline AniList collection")
				}
				mu.Lock()
				mf.AllMedia = append(mf.AllMedia, anilistMatch)
				mu.Unlock()
				return nil
			}

			// ── Persistent Cache + Provider Fetch ────────────────────────────────
			result, err := metaCache.FetchOnce(egCtx, titleGroup, opts.MetadataProviders, tmdbLimiter, hint)
			if err != nil {
				if mf.ScanLogger != nil {
					mf.ScanLogger.LogMediaFetcher(zerolog.WarnLevel).
						Str("title", titleGroup).
						Err(err).
						Msg("Failed to fetch metadata for title group")
				}
				return nil
			}

			if result != nil {
				mu.Lock()
				mf.AllMedia = append(mf.AllMedia, result)
				mf.UnknownMediaIds = append(mf.UnknownMediaIds, result.ID)
				mu.Unlock()
			}

			return nil
		})
	}

	_ = eg.Wait()
	return mf, nil
}

func (mf *MediaFetcher) GetCollectionMediaIds() []int {
	return mf.CollectionMediaIds
}

var anilistIdRegex = regexp.MustCompile(`(?i)(?:\[|\()(\d{1,6})(?:\]|\))`)

func findAniListExactMatch(collection []*dto.NormalizedMedia, title string) (*dto.NormalizedMedia, bool) {
	if match := anilistIdRegex.FindStringSubmatch(title); match != nil {
		if id, err := strconv.Atoi(match[1]); err == nil {
			for _, m := range collection {
				if m.ID == id {
					return m, true
				}
			}
		}
	}

	cleanCompare := func(a *string, b string) bool {
		if a == nil || *a == "" {
			return false
		}
		cleanVal := anilistIdRegex.ReplaceAllString(b, "")
		cleanVal = strings.TrimSpace(cleanVal)
		return strings.EqualFold(strings.TrimSpace(*a), cleanVal)
	}

	for _, m := range collection {
		if m.Title != nil {
			if cleanCompare(m.Title.Romaji, title) || cleanCompare(m.Title.English, title) || cleanCompare(m.Title.Native, title) {
				return m, true
			}
		}
		for _, syn := range m.Synonyms {
			if cleanCompare(syn, title) {
				return m, true
			}
		}
	}
	return nil, false
}
