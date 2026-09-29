package dto

type NormalizedMedia struct {
	ID                int
	TmdbID            *int
	TvdbId            *int
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
	Relations         []*NormalizedMediaRelation

	// FanArt.tv enrichment (filled in Stage 4 if FanArt API key is configured)
	LogoImage     *string // HD transparent logo (hdtvlogo / hdmovielogo)
	ThumbImage    *string // Thumb/tile image (tvthumb / moviethumb)
	ClearArtImage *string // HD clearart (hdclearart / hdmovieclearart)

	// OMDb enrichment (filled in Stage 4 if OMDb API key is configured)
	ImdbRating *string // "8.4"
	ImdbVotes  *string // "1,234,567"
	Runtime    *int    // minutes
	Director   *string
	Awards     *string
	Rated      *string // "PG-13"
	RTRating   *string // Rotten Tomatoes rating e.g. "94%"

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

type NormalizedMediaRelation struct {
	RelationType string
	Media        *NormalizedMedia
}
