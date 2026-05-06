package anime

import (
	"fmt"
	"kamehouse/internal/platforms/platform"
	"time"

	"github.com/samber/lo"
)

type ScheduleItem struct {
	MediaId int    `json:"mediaId"`
	Title   string `json:"title"`
	// Time is in 15:04 format
	Time string `json:"time"`
	// DateTime is in UTC
	DateTime       time.Time `json:"dateTime"`
	Image          string    `json:"image"`
	EpisodeNumber  int       `json:"episodeNumber"`
	IsMovie        bool      `json:"isMovie"`
	IsSeasonFinale bool      `json:"isSeasonFinale"`
}

func GetScheduleItems(animeSchedule *platform.UnifiedAiringSchedule, animeCollection *platform.UnifiedCollection) []*ScheduleItem {
	if animeSchedule == nil {
		return nil
	}

	allItems := make([]*ScheduleItem, 0)

	for _, media := range animeSchedule.Media {
		if media.NextAiringEpisode == nil {
			continue
		}

		entry, found := animeCollection.GetListEntryFromMediaId(media.ID)
		if found && entry.Status == platform.MediaListStatusDropped {
			continue
		}

		t := time.Unix(int64(media.NextAiringEpisode.AiringAt), 0)
		item := &ScheduleItem{
			MediaId:        media.ID,
			Title:          media.GetTitleSafe(),
			Time:           t.UTC().Format("15:04"),
			DateTime:       t.UTC(),
			Image:          media.GetCoverImageSafe(),
			EpisodeNumber:  media.NextAiringEpisode.Episode,
			IsMovie:        media.IsMovie(),
			IsSeasonFinale: false,
		}
		if media.Episodes != nil && *media.Episodes > 0 && media.NextAiringEpisode.Episode == *media.Episodes {
			item.IsSeasonFinale = true
		}
		allItems = append(allItems, item)
	}

	ret := lo.UniqBy(allItems, func(item *ScheduleItem) string {
		return fmt.Sprintf("%d-%d", item.MediaId, item.EpisodeNumber)
	})

	return ret
}
