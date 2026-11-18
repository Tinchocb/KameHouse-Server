package dto

type NormalizedMedia struct {
	ID                int
	TmdbID            *int
	MyanimelistId     *int
	ExplicitProvider  string
	ExplicitID        string
	Title             *NormalizedMediaTitle
	Synonyms          []*string
	Format            *MediaFormat
	Status            *MediaStatus
	Season            *MediaSeason
	Year              *int
	StartDate         *NormalizedMediaDate
	Episodes          *int
	BannerImage       *string
	CoverImage        *NormalizedMediaCoverImage
	NextAiringEpisode *NormalizedMediaNextAiringEpisode
	MetadataStatus    *string // "COMPLETE", "MISSING", "LOCAL"
	Description       *string

	// FanArt.tv enrichment (filled in Stage 4 if FanArt API key is configured)
	LogoImage     *string // HD transparent logo (hdtvlogo / hdmovielogo)
	ThumbImage    *string // Thumb/tile image (tvthumb / moviethumb)
	ClearArtImage *string // HD clearart (hdclearart / hdmovieclearart)

	Runtime *int // minutes

	// TMDB enrichment
	Score  *float64  // Normalized score (0-100)
	Genres []*string // e.g. ["Action", "Adventure"]
}

type NormalizedMediaTitle struct {
	Romaji        *string
	English       *string
	Native        *string
	Spanish       *string
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
