package dto

import (
	"kamehouse/internal/util/result"
)

type NormalizedMedia struct {
	ID               int
	IdMal            *int
	TmdbId           *int
	TvdbId           *int
	ExplicitProvider string
	ExplicitID       string
	Title            *NormalizedMediaTitle
	Synonyms         []*string
	Format           *MediaFormat
	Status           *MediaStatus
	Season           *MediaSeason
	Year             *int
	StartDate        *NormalizedMediaDate
	Episodes         *int
	BannerImage      *string
	CoverImage       *NormalizedMediaCoverImage
	//Relations         *anilist.CompleteAnimeById_Media_CompleteAnime_Relations
	NextAiringEpisode *NormalizedMediaNextAiringEpisode
	// Whether it was fetched from AniList
	fetched bool
}

type NormalizedMediaTitle struct {
	Romaji        *string
	English       *string
	Native        *string
	UserPreferred *string
}

type NormalizedMediaDate struct {
	Year  *int
	Month *int
	Day   *int
}

type NormalizedMediaCoverImage struct {
	ExtraLarge *string
	Large      *string
	Medium     *string
	Color      *string
}

type NormalizedMediaNextAiringEpisode struct {
	AiringAt        int
	TimeUntilAiring int
	Episode         int
}

type NormalizedMediaCache struct {
	*result.Cache[int, *NormalizedMedia]
}

func IsNormalizedMediaFetched(m *NormalizedMedia) bool {
	if m == nil {
		return false
	}
	return m.fetched
}

func SetNormalizedMediaFetched(m *NormalizedMedia, fetched bool) {
	if m != nil {
		m.fetched = fetched
	}
}

// NewNormalizedMediaFromOfflineDB creates a NormalizedMedia from the anime-offline-database.
// The media is marked as not fetched (fetched=false) since it lacks some AniList-specific data.
func NewNormalizedMediaFromOfflineDB(
	id int,
	idMal *int,
	tmdbId *int,
	tvdbId *int,
	title *NormalizedMediaTitle,
	synonyms []*string,
	format *MediaFormat,
	status *MediaStatus,
	season *MediaSeason,
	year *int,
	startDate *NormalizedMediaDate,
	episodes *int,
	coverImage *NormalizedMediaCoverImage,
) *NormalizedMedia {
	return &NormalizedMedia{
		ID:         id,
		IdMal:      idMal,
		TmdbId:     tmdbId,
		TvdbId:     tvdbId,
		Title:      title,
		Synonyms:   synonyms,
		Format:     format,
		Status:     status,
		Season:     season,
		Year:       year,
		StartDate:  startDate,
		Episodes:   episodes,
		CoverImage: coverImage,
		fetched:    false,
	}
}

func NewNormalizedMediaCache() *NormalizedMediaCache {
	return &NormalizedMediaCache{result.NewCache[int, *NormalizedMedia]()}
}
