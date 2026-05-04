package metadata

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/models/dto"
)

// TMDBProvider implements the Provider interface using TMDB as the metadata source.
type TMDBProvider struct {
	client *tmdb.Client
}

// NewTMDBProvider creates a new TMDB metadata provider.
// language is a BCP 47 language tag (e.g. "es-MX", "en-US"). If empty, defaults to "es-MX".
func NewTMDBProvider(bearerToken string, language ...string) *TMDBProvider {
	lang := ""
	if len(language) > 0 {
		lang = language[0]
	}
	return &TMDBProvider{
		client: tmdb.NewClient(bearerToken, lang),
	}
}

// NewTMDBProviderWithClient creates a TMDB metadata provider using an existing tmdb.Client.
func NewTMDBProviderWithClient(client *tmdb.Client) *TMDBProvider {
	return &TMDBProvider{
		client: client,
	}
}

// GetTVSeason fetches the details of a specific TV season, including its episodes.
func (p *TMDBProvider) GetTVSeason(ctx context.Context, tvID int, seasonNumber int) (tmdb.TVSeasonDetails, error) {
	return p.client.GetTVSeason(ctx, tvID, seasonNumber)
}

func (p *TMDBProvider) GetProviderID() string {
	return "tmdb"
}

func (p *TMDBProvider) GetName() string {
	return "TMDB"
}

// SearchMedia searches TMDB for anime matching the query.
// It searches both TV and Movies and returns NormalizedMedia results.
func (p *TMDBProvider) SearchMedia(ctx context.Context, query string) ([]*dto.NormalizedMedia, error) {
	var results []*dto.NormalizedMedia

	// Search TV shows first (most anime are TV series)
	tvResults, tvErr := p.client.SearchTV(ctx, query)
	if tvErr == nil {
		for _, r := range tvResults {
			nm := TmdbTVResultToNormalizedMedia(r)
			results = append(results, nm)
		}
	}

	// Also search movies
	movieResults, movieErr := p.client.SearchMovie(ctx, query)
	if movieErr == nil {
		for _, r := range movieResults {
			nm := tmdbMovieResultToNormalizedMedia(r)
			results = append(results, nm)
		}
	}

	if len(results) == 0 {
		// Report the most relevant error
		if tvErr != nil && !errors.Is(tvErr, ErrNotFound) {
			return nil, fmt.Errorf("no results found for query %q: TV search: %w", query, tvErr)
		}
		if movieErr != nil && !errors.Is(movieErr, ErrNotFound) {
			return nil, fmt.Errorf("no results found for query %q: Movie search: %w", query, movieErr)
		}
		return nil, ErrNotFound
	}

	return results, nil
}

func (p *TMDBProvider) SearchTV(ctx context.Context, query string) ([]*dto.NormalizedMedia, error) {
	var results []*dto.NormalizedMedia
	tvResults, err := p.client.SearchTV(ctx, query)
	if err == nil {
		for _, r := range tvResults {
			nm := TmdbTVResultToNormalizedMedia(r)
			results = append(results, nm)
		}
		if len(results) == 0 {
			return nil, ErrNotFound
		}
		return results, nil
	}
	return nil, err
}

func (p *TMDBProvider) SearchMovie(ctx context.Context, query string) ([]*dto.NormalizedMedia, error) {
	var results []*dto.NormalizedMedia
	movieResults, err := p.client.SearchMovie(ctx, query)
	if err == nil {
		for _, r := range movieResults {
			nm := tmdbMovieResultToNormalizedMedia(r)
			results = append(results, nm)
		}
		if len(results) == 0 {
			return nil, ErrNotFound
		}
		return results, nil
	}
	return nil, err
}

// GetMediaDetails fetches full details for a specific TMDB media.
func (p *TMDBProvider) GetMediaDetails(ctx context.Context, id string) (*dto.NormalizedMedia, error) {
	// If it's a number, try to determine if it's TV or Movie based on offset
	if numID, err := strconv.Atoi(id); err == nil {
		if numID >= 1000000 {
			// Movie
			realID := numID - 1000000
			movieRes, err := p.client.GetMovieDetails(ctx, strconv.Itoa(realID))
			if err == nil {
				return tmdbMovieResultToNormalizedMedia(movieRes), nil
			}
		} else if numID > 0 {
			// TV
			tvRes, err := p.client.GetTVDetails(ctx, id)
			if err == nil {
				return TmdbTVResultToNormalizedMedia(tvRes), nil
			}
		}
		// If it's negative, it might be an old cached ID. Try to handle it by stripping the sign.
		if numID < 0 {
			posID := -numID
			if posID >= 1000000 {
				realID := posID - 1000000
				movieRes, err := p.client.GetMovieDetails(ctx, strconv.Itoa(realID))
				if err == nil {
					return tmdbMovieResultToNormalizedMedia(movieRes), nil
				}
			} else {
				tvRes, err := p.client.GetTVDetails(ctx, strconv.Itoa(posID))
				if err == nil {
					return TmdbTVResultToNormalizedMedia(tvRes), nil
				}
			}
		}
	}

	// Try TV first
	tvRes, tvErr := p.client.GetTVDetails(ctx, id)
	if tvErr == nil {
		nm := TmdbTVResultToNormalizedMedia(tvRes)
		return nm, nil
	}

	// Try Movie next
	movieRes, movieErr := p.client.GetMovieDetails(ctx, id)
	if movieErr == nil {
		nm := tmdbMovieResultToNormalizedMedia(movieRes)
		return nm, nil
	}

	// If neither worked, determine if it was an actual API error (like 401) or just 404
	if strings.Contains(tvErr.Error(), "status code: 404") && strings.Contains(movieErr.Error(), "status code: 404") {
		return nil, ErrNotFound
	}

	// Return the actual error to avoid swallowing 401 Unauthorized or network errors
	return nil, fmt.Errorf("TMDB fetch failed. TV err: %v, Movie err: %v", tvErr, movieErr)
}

// GetClient returns the underlying TMDB client for direct API access.
func (p *TMDBProvider) GetClient() *tmdb.Client {
	return p.client
}

// TmdbTVResultToNormalizedMedia converts a TMDB TV SearchResult to NormalizedMedia.
func TmdbTVResultToNormalizedMedia(r tmdb.SearchResult) *dto.NormalizedMedia {
	tmdbId := r.ID

	// Build title
	title := &dto.NormalizedMediaTitle{}
	if r.Name != "" {
		title.English = &r.Name
		title.UserPreferred = &r.Name
	}
	if r.OriginalName != "" && r.OriginalName != r.Name {
		title.Romaji = &r.OriginalName
		if r.OriginalLanguage == "ja" {
			title.Native = &r.OriginalName
		}
	}

	// Parse year from first_air_date
	var year *int
	if r.FirstAirDate != "" && len(r.FirstAirDate) >= 4 {
		y := 0
		fmt.Sscanf(r.FirstAirDate[:4], "%d", &y)
		if y > 0 {
			year = &y
		}
	}

	// Parse start date
	var startDate *dto.NormalizedMediaDate
	if r.FirstAirDate != "" {
		startDate = parseTMDBDate(r.FirstAirDate)
	}

	// Determine format
	tvFormat := dto.MediaFormatTV
	format := &tvFormat

	// Build synonyms from alternative names
	var synonyms []*string

	// Build images
	var coverImage *dto.NormalizedMediaCoverImage
	if r.PosterPath != "" {
		url := "https://image.tmdb.org/t/p/w500" + r.PosterPath
		coverImage = &dto.NormalizedMediaCoverImage{
			Large:      &url,
			ExtraLarge: &url,
		}
	}

	var bannerImage *string
	if r.BackdropPath != "" {
		url := "https://image.tmdb.org/t/p/w1280" + r.BackdropPath
		bannerImage = &url
	}

	var description *string
	if r.Overview != "" {
		description = &r.Overview
	}

	var episodes *int
	if r.NumberOfEpisodes > 0 {
		episodes = &r.NumberOfEpisodes
	}

	return &dto.NormalizedMedia{
		ID:               tmdbId,
		TmdbId:           &tmdbId,
		ExplicitProvider: "tmdb",
		ExplicitID:       strconv.Itoa(tmdbId),
		Title:            title,
		Synonyms:         synonyms,
		Format:           format,
		Year:             year,
		StartDate:        startDate,
		Episodes:         episodes,
		CoverImage:       coverImage,
		BannerImage:      bannerImage,
		Description:      description,
	}
}

// tmdbMovieResultToNormalizedMedia converts a TMDB Movie SearchResult to NormalizedMedia.
func tmdbMovieResultToNormalizedMedia(r tmdb.SearchResult) *dto.NormalizedMedia {
	tmdbId := r.ID

	title := &dto.NormalizedMediaTitle{}
	if r.Title != "" {
		title.English = &r.Title
		title.UserPreferred = &r.Title
	}
	if r.OriginalTitle != "" && r.OriginalTitle != r.Title {
		title.Romaji = &r.OriginalTitle
		if r.OriginalLanguage == "ja" {
			title.Native = &r.OriginalTitle
		}
	}

	var year *int
	if r.ReleaseDate != "" && len(r.ReleaseDate) >= 4 {
		y := 0
		fmt.Sscanf(r.ReleaseDate[:4], "%d", &y)
		if y > 0 {
			year = &y
		}
	}

	var startDate *dto.NormalizedMediaDate
	if r.ReleaseDate != "" {
		startDate = parseTMDBDate(r.ReleaseDate)
	}

	movieFormat := dto.MediaFormatMovie
	format := &movieFormat

	// Build images
	var coverImage *dto.NormalizedMediaCoverImage
	if r.PosterPath != "" {
		url := "https://image.tmdb.org/t/p/w500" + r.PosterPath
		coverImage = &dto.NormalizedMediaCoverImage{
			Large:      &url,
			ExtraLarge: &url,
		}
	}

	var bannerImage *string
	if r.BackdropPath != "" {
		url := "https://image.tmdb.org/t/p/w1280" + r.BackdropPath
		bannerImage = &url
	}

	var description *string
	if r.Overview != "" {
		description = &r.Overview
	}

	return &dto.NormalizedMedia{
		ID:               tmdbId + 1000000, // Offset to avoid collisions with TV IDs
		TmdbId:           &tmdbId,
		ExplicitProvider: "tmdb",
		ExplicitID:       strconv.Itoa(tmdbId),
		Title:            title,
		Format:           format,
		Year:             year,
		StartDate:        startDate,
		CoverImage:       coverImage,
		BannerImage:      bannerImage,
		Description:      description,
	}
}

// parseTMDBDate parses a TMDB date string (YYYY-MM-DD) into NormalizedMediaDate.
func parseTMDBDate(dateStr string) *dto.NormalizedMediaDate {
	parts := strings.Split(dateStr, "-")
	date := &dto.NormalizedMediaDate{}

	if len(parts) >= 1 {
		y := 0
		fmt.Sscanf(parts[0], "%d", &y)
		if y > 0 {
			date.Year = &y
		}
	}
	if len(parts) >= 2 {
		m := 0
		fmt.Sscanf(parts[1], "%d", &m)
		if m > 0 {
			date.Month = &m
		}
	}
	if len(parts) >= 3 {
		d := 0
		fmt.Sscanf(parts[2], "%d", &d)
		if d > 0 {
			date.Day = &d
		}
	}

	return date
}
