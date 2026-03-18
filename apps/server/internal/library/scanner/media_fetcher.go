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
	groups := lo.GroupBy(opts.LocalFiles, func(lf *dto.LocalFile) string {
		pm := parser.Parse(lf.Name)
		if pm.Title != "" {
			return pm.Title
		}
		// Fallback to strict directory name
		return filepath.Base(filepath.Dir(lf.Path))
	})

	for titleGroup, files := range groups {
		if titleGroup == "" || strings.EqualFold(titleGroup, "Series") || strings.EqualFold(titleGroup, "Peliculas") {
			continue
		}

		// Determine type hint based on file paths
		var hint string
		if len(files) > 0 {
			// Check if file is in series paths or movie paths
			for _, rp := range opts.SeriesPaths {
				if strings.HasPrefix(files[0].Path, rp) {
					hint = "series"
					break
				}
			}
			if hint == "" {
				for _, rp := range opts.MoviePaths {
					if strings.HasPrefix(files[0].Path, rp) {
						hint = "movie"
						break
					}
				}
			}
		}

		// Search TMDB for this robust title group
		var searchRes []*dto.NormalizedMedia
		var err error
		if hint == "series" {
			searchRes, err = opts.TMDBProvider.SearchTV(ctx, titleGroup)
		} else if hint == "movie" {
			searchRes, err = opts.TMDBProvider.SearchMovie(ctx, titleGroup)
		} else {
			searchRes, err = opts.TMDBProvider.SearchMedia(ctx, titleGroup)
		}

		if err != nil && !errors.Is(err, librarymetadata.ErrNotFound) {
			if mf.ScanLogger != nil {
				mf.ScanLogger.LogMediaFetcher(zerolog.WarnLevel).
					Str("title", titleGroup).
					Err(err).
					Msg("Failed to search TMDB for title group")
			}
			continue
		}

		if len(searchRes) > 0 {
			// Take the best match
			bestMatch := searchRes[0]
			mf.AllMedia = append(mf.AllMedia, bestMatch)
			mf.UnknownMediaIds = append(mf.UnknownMediaIds, bestMatch.ID)

			// The matcher phase will verify each file strictly afterwards,
			// but we bind the TMDB cache so bayesian engine has data to work with.
			for _, lf := range files {
				if lf.MediaId == 0 {
					lf.MediaId = bestMatch.ID
				}
			}
		}
	}


	return mf, nil
}

func (mf *MediaFetcher) GetCollectionMediaIds() []int {
	return mf.CollectionMediaIds
}
