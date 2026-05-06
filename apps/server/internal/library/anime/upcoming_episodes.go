package anime

import (
	"context"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"kamehouse/internal/util/limiter"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/samber/lo"
)

type (
	UpcomingEpisodes struct {
		Episodes []*UpcomingEpisode `json:"episodes"`
	}

	UpcomingEpisode struct {
		MediaId         int                    `json:"mediaId"`
		EpisodeNumber   int                    `json:"episodeNumber"`
		AiringAt        int64                  `json:"airingAt"`
		TimeUntilAiring int                    `json:"timeUntilAiring"`
		BaseAnime       *platform.UnifiedMedia `json:"baseAnime"`
		EpisodeMetadata *EpisodeMetadata       `json:"episodeMetadata,omitempty"`
	}

	NewUpcomingEpisodesOptions struct {
		AnimeCollection     *platform.UnifiedCollection
		MetadataProviderRef *util.Ref[metadata_provider.Provider]
	}
)

func NewUpcomingEpisodes(opts *NewUpcomingEpisodesOptions) *UpcomingEpisodes {
	upcoming := new(UpcomingEpisodes)


	// Get all media with next airing episodes
	allMedia := opts.AnimeCollection.GetAllAnime()
	mediaWithNextAiring := lo.Filter(allMedia, func(item *platform.UnifiedMedia, _ int) bool {
		return item.NextAiringEpisode != nil && item.NextAiringEpisode.Episode > 0
	})

	// Sort by time until airing
	sort.Slice(mediaWithNextAiring, func(i, j int) bool {
		return mediaWithNextAiring[i].NextAiringEpisode.TimeUntilAiring < mediaWithNextAiring[j].NextAiringEpisode.TimeUntilAiring
	})

	rateLimiter := limiter.NewLimiter(time.Second, 20)
	upcomingEps := make([]*UpcomingEpisode, 0, len(mediaWithNextAiring))
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, media := range mediaWithNextAiring {
		wg.Add(1)
		go func(media *platform.UnifiedMedia) {
			defer wg.Done()

			entry, found := opts.AnimeCollection.GetListEntryFromMediaId(media.ID)
			if !found {
				return
			}

			if entry.Status == platform.MediaListStatusDropped {
				return
			}

			if media.NextAiringEpisode.Episode <= 0 {
				return
			}

			upcomingEp := &UpcomingEpisode{
				MediaId:         media.ID,
				EpisodeNumber:   media.NextAiringEpisode.Episode,
				AiringAt:        int64(media.NextAiringEpisode.AiringAt),
				TimeUntilAiring: media.NextAiringEpisode.TimeUntilAiring,
				BaseAnime:       media,
			}

			// Get episode metadata
			if opts.MetadataProviderRef != nil {
				provider := opts.MetadataProviderRef.Get()
				if provider != nil {
					rateLimiter.Wait(context.Background())
					animeMetadata, err := provider.GetAnimeMetadata(media.ID)
					if err == nil {
						if ep, ok := animeMetadata.FindEpisode(strconv.Itoa(media.NextAiringEpisode.Episode)); ok {
							upcomingEp.EpisodeMetadata = &EpisodeMetadata{
								Title:    ep.Title,
								Image:    ep.Image,
								AirDate:  ep.AirDate,
								Summary:  ep.Summary,
								Overview: ep.Overview,
							}
						}
					}
				}
			}

			mu.Lock()
			upcomingEps = append(upcomingEps, upcomingEp)
			mu.Unlock()
		}(media)
	}
	wg.Wait()

	// Sort by time until airing
	sort.Slice(upcomingEps, func(i, j int) bool {
		return upcomingEps[i].TimeUntilAiring < upcomingEps[j].TimeUntilAiring
	})

	upcoming.Episodes = upcomingEps

	return upcoming
}
