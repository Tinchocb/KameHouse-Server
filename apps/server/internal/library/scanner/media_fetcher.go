package scanner

import (
	"context"
	"errors"

	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/anime"
	librarymetadata "kamehouse/internal/library/metadata"
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
	LibraryPaths []string // used for folder structure parsing in TMDB mode
}

// NewMediaFetcher creates a MediaFetcher using TMDB + folder structure
func NewMediaFetcher(ctx context.Context, opts *MediaFetcherOptions) (ret *MediaFetcher, retErr error) {
	defer util.HandlePanicInModuleWithError("library/scanner/NewMediaFetcher", &retErr)

	if opts.LocalFiles == nil ||
		opts.Logger == nil ||
		opts.TMDBProvider == nil {
		return nil, errors.New("missing options")
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

	// 2. Parse titles from folder structure and search TMDB
	// Group files by parent directory (assumed to be the anime folder)
	groups := lo.GroupBy(opts.LocalFiles, func(lf *dto.LocalFile) string {
		return filepath.Dir(lf.Path)
	})

	for dir, files := range groups {
		// Try to find which library path this directory belongs to
		var libraryPath string
		for _, lp := range opts.LibraryPaths {
			if strings.HasPrefix(dir, lp) {
				libraryPath = lp
				break
			}
		}

		if libraryPath == "" {
			continue
		}

		// The folder name is the part of the path after the library path
		folderName := strings.TrimPrefix(dir, libraryPath)
		folderName = strings.TrimPrefix(folderName, string(filepath.Separator))
		// Take only the first part of the folder name
		parts := strings.Split(folderName, string(filepath.Separator))
		if len(parts) == 0 || parts[0] == "" {
			continue
		}
		animeFolderName := parts[0]

		// Search TMDB for this folder name
		searchRes, err := opts.TMDBProvider.SearchMedia(ctx, animeFolderName)
		if err != nil {
			if mf.ScanLogger != nil {
				mf.ScanLogger.LogMediaFetcher(zerolog.WarnLevel).
					Str("folder", animeFolderName).
					Err(err).
					Msg("Failed to search TMDB for folder")
			}
			continue
		}

		if len(searchRes) > 0 {
			// Take the best match (for now just the first one)
			bestMatch := searchRes[0]
			mf.AllMedia = append(mf.AllMedia, bestMatch)
			mf.UnknownMediaIds = append(mf.UnknownMediaIds, bestMatch.ID)

			// Assign media ID to files in this folder
			for _, lf := range files {
				lf.MediaId = bestMatch.ID
			}
		}
	}

	// 3. Add offline database if requested (TODO)

	return mf, nil
}

func (mf *MediaFetcher) GetCollectionMediaIds() []int {
	return mf.CollectionMediaIds
}
