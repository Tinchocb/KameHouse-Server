package scanner

import (
	"context"
	"errors"

	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/anime"
	librarymetadata "kamehouse/internal/library/metadata"
	"kamehouse/internal/library/parser"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/rs/zerolog"
	"github.com/samber/lo"
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
	SeriesPaths []string
	MoviePaths  []string
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
		pm := parser.Parse(lf.Name)
		if pm.Title != "" {
			return pm.Title
		}

		info := ParseFolderStructure(lf.Path, libPaths)
		if info.SeriesName != "" {
			return info.SeriesName
		}

		// Fallback to strict directory name
		return filepath.Base(filepath.Dir(lf.Path))
	})

	for titleGroup, files := range groups {
		lowerGroup := strings.ToLower(titleGroup)
		if titleGroup == "" || lowerGroup == "series" || lowerGroup == "peliculas" || lowerGroup == "películas" || lowerGroup == "movies" || lowerGroup == "anime" || lowerGroup == "tv" || lowerGroup == "tv shows" || lowerGroup == "films" {
			continue
		}

		// Determine type hint based on file paths
		var hint string
		if len(files) > 0 {
			// Normalize path to avoid Windows '\' vs Unix '/' mismatches
			nfp := filepath.ToSlash(filepath.Clean(files[0].Path))

			// Check if file is in series paths or movie paths
			for _, rp := range opts.SeriesPaths {
				if rp == "" { continue }
				nrp := filepath.ToSlash(filepath.Clean(rp))
				// Ensure trailing slash to prevent partial matches (e.g. /movies vs /movies_old)
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
					if rp == "" { continue }
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
		}

		// Search TMDB for this robust title group
		var searchRes []*dto.NormalizedMedia
		var err error

		if anilistMatch, ok := findAniListExactMatch(mf.AllMedia, titleGroup); ok {
			// PHASE 1: AniList Exact Match OVERRIDE - Bypass fuzzy search if the user already has this in their AniList collection
			if mf.ScanLogger != nil {
				mf.ScanLogger.LogMediaFetcher(zerolog.InfoLevel).
					Str("title", titleGroup).
					Int("anilist_id", anilistMatch.ID).
					Msg("anilist_resolver: Matched title strictly with offline AniList collection")
			}
			searchRes = []*dto.NormalizedMedia{anilistMatch}
		} else {
			// FALLBACK: Iterate over all providers (AniList -> TMDB -> AniDB)
			for _, provider := range opts.MetadataProviders {
				switch hint {
				case "series":
					if p, ok := provider.(*librarymetadata.TMDBProvider); ok {
						searchRes, err = p.SearchTV(ctx, titleGroup)
					} else {
						searchRes, err = provider.SearchMedia(ctx, titleGroup)
					}
				case "movie":
					if p, ok := provider.(*librarymetadata.TMDBProvider); ok {
						searchRes, err = p.SearchMovie(ctx, titleGroup)
					} else {
						searchRes, err = provider.SearchMedia(ctx, titleGroup)
					}
				default:
					searchRes, err = provider.SearchMedia(ctx, titleGroup)
				}
				
				if err == nil && len(searchRes) > 0 {
					break // Found results, stop asking other providers
				}
			}
		}

		if len(searchRes) == 0 {
			if mf.ScanLogger != nil {
				mf.ScanLogger.LogMediaFetcher(zerolog.WarnLevel).
					Str("title", titleGroup).
					Err(err).
					Msg("Failed to search all providers for title group")
			}
			continue
		}

		if len(searchRes) > 0 {
			// Take the best match
			bestMatch := searchRes[0]
			mf.AllMedia = append(mf.AllMedia, bestMatch)
			mf.UnknownMediaIds = append(mf.UnknownMediaIds, bestMatch.ID)

			// The matcher phase will verify each file strictly afterwards.
		}
	}


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
