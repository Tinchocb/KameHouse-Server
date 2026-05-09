package dto

import (
	"kamehouse/internal/util/result"
)

type NormalizedMedia struct {
	ID               int
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
	NextAiringEpisode *NormalizedMediaNextAiringEpisode
	MetadataStatus    *string // "COMPLETE", "MISSING", "LOCAL"
	Description       *string
	Relations         []*NormalizedMediaRelation
	// Whether it was fetched from TMDB
	fetched bool

	// FanArt.tv enrichment (filled in Stage 4 if FanArt API key is configured)
	LogoImage    *string // HD transparent logo (hdtvlogo / hdmovielogo)
	ThumbImage   *string // Thumb/tile image (tvthumb / moviethumb)
	ClearArtImage *string // HD clearart (hdclearart / hdmovieclearart)

	// OMDb enrichment (filled in Stage 4 if OMDb API key is configured)
	ImdbRating *string // "8.4"
	ImdbVotes  *string // "1,234,567"
	Runtime    *string // "148 min"
	Director   *string
	Awards     *string
	Rated      *string // "PG-13"
	RTRating   *string // Rotten Tomatoes rating e.g. "94%"
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

type NormalizedMediaRelation struct {
	RelationType string
	Media        *NormalizedMedia
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
// The media is marked as not fetched (fetched=false) since it lacks some TMDB-specific data.
func NewNormalizedMediaFromOfflineDB(
	id int,
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
