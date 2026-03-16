package platform

import "sync"

type MediaFormat string
type MediaStatus string
type MediaType string
type MediaSeason string

const (
	MediaFormatTv      MediaFormat = "TV"
	MediaFormatMovie   MediaFormat = "MOVIE"
	MediaFormatSpecial MediaFormat = "SPECIAL"
	MediaFormatOva     MediaFormat = "OVA"
	MediaFormatOna     MediaFormat = "ONA"
	MediaFormatMusic   MediaFormat = "MUSIC"

	MediaStatusFinished       MediaStatus = "FINISHED"
	MediaStatusReleasing      MediaStatus = "RELEASING"
	MediaStatusNotYetReleased MediaStatus = "NOT_YET_RELEASED"
	MediaStatusCancelled      MediaStatus = "CANCELLED"
	MediaStatusHiatus         MediaStatus = "HIATUS"
)

type MediaTitle struct {
	Romaji  *string `json:"romaji,omitempty"`
	English *string `json:"english,omitempty"`
	Native  *string `json:"native,omitempty"`
}

type MediaCoverImage struct {
	ExtraLarge *string `json:"extraLarge,omitempty"`
	Large      *string `json:"large,omitempty"`
	Medium     *string `json:"medium,omitempty"`
	Color      *string `json:"color,omitempty"`
}

type FuzzyDate struct {
	Year  *int `json:"year,omitempty"`
	Month *int `json:"month,omitempty"`
	Day   *int `json:"day,omitempty"`
}

type NextAiringEpisode struct {
	AiringAt        int `json:"airingAt"`
	TimeUntilAiring int `json:"timeUntilAiring"`
	Episode         int `json:"episode"`
}

type UnifiedMedia struct {
	ID                int                     `json:"id"`
	Type              MediaType               `json:"type"`
	Format            MediaFormat             `json:"format"`
	Status            MediaStatus             `json:"status"`
	Title             *MediaTitle             `json:"title,omitempty"`
	Episodes          *int                    `json:"episodes,omitempty"`
	CoverImage        *MediaCoverImage        `json:"coverImage,omitempty"`
	BannerImage       *string                 `json:"bannerImage,omitempty"`
	StartDate         *FuzzyDate              `json:"startDate,omitempty"`
	EndDate           *FuzzyDate              `json:"endDate,omitempty"`
	Season            *MediaSeason            `json:"season,omitempty"`
	SeasonYear        *int                    `json:"seasonYear,omitempty"`
	NextAiringEpisode *NextAiringEpisode      `json:"nextAiringEpisode,omitempty"`
	Relations         []*UnifiedMediaRelation `json:"relations,omitempty"`
}

type MediaRelationType string

const (
	MediaRelationPrequel     MediaRelationType = "PREQUEL"
	MediaRelationSequel      MediaRelationType = "SEQUEL"
	MediaRelationSpinOff     MediaRelationType = "SPIN_OFF"
	MediaRelationSideStory   MediaRelationType = "SIDE_STORY"
	MediaRelationAlternative MediaRelationType = "ALTERNATIVE"
	MediaRelationParent      MediaRelationType = "PARENT"
	MediaRelationSummary     MediaRelationType = "SUMMARY"
	MediaRelationOther       MediaRelationType = "OTHER"
)

type UnifiedMediaRelation struct {
	ID           int               `json:"id"`
	RelationType MediaRelationType `json:"relationType"`
	Media        *UnifiedMedia     `json:"media"`
}

type UnifiedAnimeRelationTree struct {
	sync.Map
}

func (t *UnifiedAnimeRelationTree) Range(f func(key int, value *UnifiedMedia) bool) {
	t.Map.Range(func(key, value any) bool {
		return f(key.(int), value.(*UnifiedMedia))
	})
}

func (m *UnifiedMedia) IsMovie() bool {
	return m.Format == MediaFormatMovie
}

func (m *UnifiedMedia) GetTitleSafe() string {
	if m.Title == nil {
		return ""
	}
	if m.Title.Romaji != nil {
		return *m.Title.Romaji
	}
	if m.Title.English != nil {
		return *m.Title.English
	}
	if m.Title.Native != nil {
		return *m.Title.Native
	}
	return ""
}

func (m *UnifiedMedia) GetPreferredTitle() string {
	return m.GetTitleSafe()
}

func (m *UnifiedMedia) IsMovieOrSingleEpisode() bool {
	return m.Format == MediaFormatMovie || (m.Episodes != nil && *m.Episodes == 1)
}

func (m *UnifiedMedia) GetID() int {
	return m.ID
}

func (m *UnifiedMedia) GetRomajiTitleSafe() string {
	if m.Title != nil && m.Title.Romaji != nil {
		return *m.Title.Romaji
	}
	return m.GetTitleSafe()
}

type PlatformUser struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Avatar      *string `json:"avatar,omitempty"`
	BannerImage *string `json:"bannerImage,omitempty"`
}

func (m *UnifiedMedia) GetCoverImageSafe() string {
	if m.CoverImage == nil {
		return ""
	}
	if m.CoverImage.ExtraLarge != nil {
		return *m.CoverImage.ExtraLarge
	}
	if m.CoverImage.Large != nil {
		return *m.CoverImage.Large
	}
	if m.CoverImage.Medium != nil {
		return *m.CoverImage.Medium
	}
	return ""
}

func (m *UnifiedMedia) GetBannerImageSafe() string {
	if m.BannerImage == nil {
		return ""
	}
	return *m.BannerImage
}

func (m *UnifiedMedia) GetTotalEpisodeCount() int {
	if m.Episodes == nil {
		return 0
	}
	return *m.Episodes
}

type UnifiedCollectionEntry struct {
	ID          int             `json:"id"`
	Media       *UnifiedMedia   `json:"media"`
	Status      MediaListStatus `json:"status"`
	Score       *float64        `json:"score,omitempty"`
	Progress    *int            `json:"progress,omitempty"`
	Repeat      *int            `json:"repeat,omitempty"`
	StartedAt   *FuzzyDate      `json:"startedAt,omitempty"`
	CompletedAt *FuzzyDate      `json:"completedAt,omitempty"`
}

type UnifiedCollection struct {
	Lists []*UnifiedCollectionList `json:"lists"`
}

func (c *UnifiedCollection) GetListEntryFromMediaId(id int) (*UnifiedCollectionEntry, bool) {
	if c == nil {
		return nil, false
	}
	for _, l := range c.Lists {
		for _, e := range l.Entries {
			if e.Media != nil && e.Media.ID == id {
				return e, true
			}
		}
	}
	return nil, false
}

func (c *UnifiedCollection) GetAllAnime() []*UnifiedMedia {
	if c == nil {
		return nil
	}
	var res []*UnifiedMedia
	for _, l := range c.Lists {
		for _, e := range l.Entries {
			if e.Media != nil && e.Media.Type == "ANIME" {
				res = append(res, e.Media)
			}
		}
	}
	return res
}

func (c *UnifiedCollection) GetAllMedia() []*UnifiedMedia {
	if c == nil {
		return nil
	}
	var res []*UnifiedMedia
	for _, l := range c.Lists {
		for _, e := range l.Entries {
			if e.Media != nil {
				res = append(res, e.Media)
			}
		}
	}
	return res
}

type UnifiedCollectionList struct {
	Name    string                    `json:"name"`
	Status  MediaListStatus           `json:"status"`
	Entries []*UnifiedCollectionEntry `json:"entries"`
}

type MediaListStatus string

const (
	MediaListStatusCurrent   MediaListStatus = "CURRENT"
	MediaListStatusPlanning  MediaListStatus = "PLANNING"
	MediaListStatusCompleted MediaListStatus = "COMPLETED"
	MediaListStatusDropped   MediaListStatus = "DROPPED"
	MediaListStatusPaused    MediaListStatus = "PAUSED"
	MediaListStatusRepeating MediaListStatus = "REPEATING"
)

type MediaSort string
type UnifiedMediaList struct {
	Media []*UnifiedMedia `json:"media"`
}

type UnifiedAiringSchedule struct {
	Media []*UnifiedMedia `json:"media"`
}

type UnifiedViewer struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type UnifiedViewerStats struct {
	AnimeCount int `json:"animeCount"`
}

type UnifiedMediaListEntry struct {
	ID       int             `json:"id"`
	Media    *UnifiedMedia   `json:"media"`
	Status   MediaListStatus `json:"status"`
	Progress int             `json:"progress"`
	Score    float64         `json:"score"`
}

type FuzzyDateInput struct {
	Year  *int `json:"year,omitempty"`
	Month *int `json:"month,omitempty"`
	Day   *int `json:"day,omitempty"`
}

type UnifiedStudioDetails struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}
