package anime

import (
	"cmp"
	"fmt"
	"kamehouse/internal/api/metadata"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/models"
	"kamehouse/internal/util/result"
	"slices"
	"strconv"
	"time"
	"github.com/rs/zerolog"
	"github.com/samber/lo"
)

var episodeCollectionCache = result.NewBoundedCache[int, *EpisodeCollection](10)
var EpisodeCollectionFromLocalFilesCache = result.NewBoundedCache[int, *EpisodeCollection](10)

func ClearEpisodeCollectionCache() {
	episodeCollectionCache.Clear()
	EpisodeCollectionFromLocalFilesCache.Clear()
}

type (
	// EpisodeCollection represents a collection of episodes.
	EpisodeCollection struct {
		HasMappingError bool                    `json:"hasMappingError"`
		Episodes        []*Episode              `json:"episodes"`
		Metadata        *metadata.AnimeMetadata `json:"metadata"`
	}
)

type NewEpisodeCollectionOptions struct {
	// AnimeMetadata can be nil, if not provided, it will be fetched from the metadata provider.
	AnimeMetadata       *metadata.AnimeMetadata
	Media               *models.LibraryMedia
	MetadataProviderRef metadata_provider.Provider
	Logger              *zerolog.Logger
}

// NewEpisodeCollection creates a new episode collection by leveraging EntryDownloadInfo.
// The returned EpisodeCollection is cached for 6 hours.
//
// AnimeMetadata is optional, if not provided, it will be fetched from the metadata provider.
//
// Note: This is used by download info views (episode lists for download).
func NewEpisodeCollection(opts NewEpisodeCollectionOptions) (ec *EpisodeCollection, err error) {
	if opts.Logger == nil {
		opts.Logger = lo.ToPtr(zerolog.Nop())
	}

	if opts.Media == nil {
		return nil, fmt.Errorf("cannot create episode collection, media is nil")
	}

	if opts.MetadataProviderRef == nil {
		return nil, fmt.Errorf("cannot create episode collection, metadata provider is nil")
	}

	if ec, ok := episodeCollectionCache.Get(int(opts.Media.ID)); ok {
		opts.Logger.Debug().Msg("episode-collection: Using cached episode collection")
		return ec, nil
	}

	if opts.AnimeMetadata == nil {
		// Fetch the metadata
		opts.AnimeMetadata, err = opts.MetadataProviderRef.GetAnimeMetadata(int(opts.Media.ID))
		if err != nil {
			opts.AnimeMetadata = &metadata.AnimeMetadata{
				Titles:       make(map[string]string),
				Episodes:     make(map[string]*metadata.EpisodeMetadata),
				EpisodeCount: 0,
				Mappings: &metadata.AnimeMappings{
					ThemoviedbId: strconv.Itoa(int(opts.Media.ID)), // Store it in ThemoviedbId field for now as a generic media ID marker
				},
			}
			opts.AnimeMetadata.Titles["en"] = opts.Media.TitleEnglish
			opts.AnimeMetadata.Titles["x-jat"] = opts.Media.TitleRomaji
			err = nil
		}
	}

	ec = &EpisodeCollection{
		HasMappingError: false,
		Episodes:        make([]*Episode, 0),
		Metadata:        opts.AnimeMetadata,
	}

	// +---------------------+
	// |    Download Info    |
	// +---------------------+

	info, err := NewEntryDownloadInfo(&NewEntryDownloadInfoOptions{
		LocalFiles:          nil,
		AnimeMetadata:       opts.AnimeMetadata,
		Progress:            0, // Progress is 0 because we want the entire list
		Status:              "CURRENT",
		Media:               opts.Media,
		MetadataProviderRef: opts.MetadataProviderRef,
	})
	if err != nil {
		opts.Logger.Error().Err(err).Msg("episode-collection: could not get media entry info")
		return nil, err
	}

	// As of v2.8.0, this should never happen, getMediaInfo always returns an anime metadata struct, even if it's not found
	// causing NewEntryDownloadInfo to return a valid list of episodes to download
	if info == nil || info.EpisodesToDownload == nil {
		opts.Logger.Debug().Msg("episode-collection: no episodes found from AniDB, using internal provider")
		mediaWrapper := opts.MetadataProviderRef.GetAnimeMetadataWrapper(nil, nil)
		for epIdx := range opts.Media.TotalEpisodes {
			episodeNumber := epIdx + 1

			episodeMetadata := mediaWrapper.GetEpisodeMetadata(strconv.Itoa(episodeNumber))

			episode := &Episode{
				Type:                  LocalFileTypeMain,
				DisplayTitle:          fmt.Sprintf("Episode %d", episodeNumber),
				EpisodeTitle:          opts.Media.TitleEnglish,
				EpisodeNumber:         episodeNumber,
				AniDBEpisode:          fmt.Sprintf("%d", episodeNumber),
				AbsoluteEpisodeNumber: episodeNumber,
				ProgressNumber:        episodeNumber,
				LocalFile:             nil,
				IsDownloaded:          false,
				EpisodeMetadata: &EpisodeMetadata{
					AnidbId:  0,
					Image:    episodeMetadata.Image,
					AirDate:  "",
					Length:   0,
					Summary:  "",
					Overview: "",
					IsFiller: false,
				},
				FileMetadata:  nil,
				IsInvalid:     false,
				MetadataIssue: "",
				BaseAnime:     opts.Media,
			}
			ec.Episodes = append(ec.Episodes, episode)
		}
		ec.HasMappingError = true
		return
	}

	if len(info.EpisodesToDownload) == 0 {
		opts.Logger.Error().Msg("episode-collection: no episodes found")
		return nil, fmt.Errorf("no episodes found")
	}

	ec.Episodes = lo.Map(info.EpisodesToDownload, func(episode *EntryDownloadEpisode, i int) *Episode {
		return episode.Episode
	})

	slices.SortStableFunc(ec.Episodes, func(i, j *Episode) int {
		return cmp.Compare(i.EpisodeNumber, j.EpisodeNumber)
	})

	episodeCollectionCache.SetT(int(opts.Media.ID), ec, time.Minute*10)

	return ec, nil
}
