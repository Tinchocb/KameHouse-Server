package metadata

import (
	"strconv"
	"strings"

	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/models/dto"
)

// TmdbTVResultToNormalizedMedia converts a TMDB TV SearchResult to NormalizedMedia.
func TmdbTVResultToNormalizedMedia(r tmdb.SearchResult) *dto.NormalizedMedia {
	tmdbID := r.ID
	title := &dto.NormalizedMediaTitle{}
	if r.Name != "" {
		title.Spanish = &r.Name
		title.UserPreferred = &r.Name
		// Don't set English here - search results don't have English titles readily available
		// English will be fetched properly in GetMediaDetails via alternative titles
	}
	if r.OriginalName != "" && r.OriginalName != r.Name {
		title.Romaji = &r.OriginalName
		if r.OriginalLanguage == "ja" {
			title.Native = &r.OriginalName
		}
		// If original language is English, use it for English title
		if r.OriginalLanguage == "en" {
			title.English = &r.OriginalName
		}
	}

	var year *int
	if r.FirstAirDate != "" && len(r.FirstAirDate) >= 4 {
		if y, err := strconv.Atoi(r.FirstAirDate[:4]); err == nil && y > 0 {
			year = &y
		}
	}

	var startDate *dto.NormalizedMediaDate
	if r.FirstAirDate != "" {
		startDate = parseTMDBDate(r.FirstAirDate)
	}

	tvFormat := dto.MediaFormatTV
	format := &tvFormat

	var coverImage *dto.NormalizedMediaCoverImage
	if r.PosterPath != "" {
		url := "https://image.tmdb.org/t/p/w780" + r.PosterPath
		coverImage = &dto.NormalizedMediaCoverImage{Large: &url, ExtraLarge: &url}
	}

	var bannerImage *string
	if r.BackdropPath != "" {
		url := "https://image.tmdb.org/t/p/original" + r.BackdropPath
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

	var score *float64
	if r.VoteAverage > 0 {
		s := r.VoteAverage * 10
		score = &s
	}

	return &dto.NormalizedMedia{
		ID:               tmdbID,
		TmdbID:           &tmdbID,
		ExplicitProvider: "tmdb",
		ExplicitID:       strconv.Itoa(tmdbID),
		Title:            title,
		Format:           format,
		Year:             year,
		StartDate:        startDate,
		Episodes:         episodes,
		CoverImage:       coverImage,
		BannerImage:      bannerImage,
		Description:      description,
		Score:            score,
	}
}

// TmdbTVDetailsToNormalizedMedia converts full TMDB TVDetails to NormalizedMedia.
// englishTitle is the English title fetched from alternative titles (optional).
func TmdbTVDetailsToNormalizedMedia(r *tmdb.TVDetails, englishTitle string) *dto.NormalizedMedia {
	tmdbID := r.ID
	title := &dto.NormalizedMediaTitle{}
	if r.Name != "" {
		title.Spanish = &r.Name
		title.UserPreferred = &r.Name
		if englishTitle != "" {
			title.English = &englishTitle
		} else {
			// Fallback: use Spanish title if English not available
			title.English = &r.Name
		}
	}
	if r.OriginalName != "" && r.OriginalName != r.Name {
		title.Romaji = &r.OriginalName
		if r.OriginalLanguage == "ja" {
			title.Native = &r.OriginalName
		}
	}

	var year *int
	if r.FirstAirDate != "" && len(r.FirstAirDate) >= 4 {
		if y, err := strconv.Atoi(r.FirstAirDate[:4]); err == nil && y > 0 {
			year = &y
		}
	}

	var startDate *dto.NormalizedMediaDate
	if r.FirstAirDate != "" {
		startDate = parseTMDBDate(r.FirstAirDate)
	}

	tvFormat := dto.MediaFormatTV
	format := &tvFormat

	var coverImage *dto.NormalizedMediaCoverImage
	if r.PosterPath != "" {
		url := "https://image.tmdb.org/t/p/w780" + r.PosterPath
		coverImage = &dto.NormalizedMediaCoverImage{Large: &url, ExtraLarge: &url}
	}

	var bannerImage *string
	if r.BackdropPath != "" {
		url := "https://image.tmdb.org/t/p/original" + r.BackdropPath
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

	var score *float64
	if r.VoteAverage > 0 {
		s := r.VoteAverage * 10
		score = &s
	}

	var genres []*string
	for _, g := range r.Genres {
		name := g.Name
		genres = append(genres, &name)
	}

	return &dto.NormalizedMedia{
		ID:               tmdbID,
		TmdbID:           &tmdbID,
		ExplicitProvider: "tmdb",
		ExplicitID:       strconv.Itoa(tmdbID),
		Title:            title,
		Format:           format,
		Year:             year,
		StartDate:        startDate,
		Episodes:         episodes,
		CoverImage:       coverImage,
		BannerImage:      bannerImage,
		Description:      description,
		Score:            score,
		Genres:           genres,
		Runtime: func() *int {
			if len(r.EpisodeRunTime) > 0 {
				return &r.EpisodeRunTime[0]
			}
			return nil
		}(),
	}
}

// TmdbMovieResultToNormalizedMedia converts a TMDB Movie SearchResult to NormalizedMedia.
func TmdbMovieResultToNormalizedMedia(r tmdb.SearchResult) *dto.NormalizedMedia {
	tmdbID := r.ID
	title := &dto.NormalizedMediaTitle{}
	if r.Title != "" {
		title.Spanish = &r.Title
		title.UserPreferred = &r.Title
		// Don't set English here - search results don't have English titles readily available
		// English will be fetched properly in GetMediaDetails via alternative titles
	}
	if r.OriginalTitle != "" && r.OriginalTitle != r.Title {
		title.Romaji = &r.OriginalTitle
		if r.OriginalLanguage == "ja" {
			title.Native = &r.OriginalTitle
		}
		// If original language is English, use it for English title
		if r.OriginalLanguage == "en" {
			title.English = &r.OriginalTitle
		}
	}

	var year *int
	if r.ReleaseDate != "" && len(r.ReleaseDate) >= 4 {
		if y, err := strconv.Atoi(r.ReleaseDate[:4]); err == nil && y > 0 {
			year = &y
		}
	}

	var startDate *dto.NormalizedMediaDate
	if r.ReleaseDate != "" {
		startDate = parseTMDBDate(r.ReleaseDate)
	}

	movieFormat := dto.MediaFormatMovie
	format := &movieFormat

	var coverImage *dto.NormalizedMediaCoverImage
	if r.PosterPath != "" {
		url := "https://image.tmdb.org/t/p/w780" + r.PosterPath
		coverImage = &dto.NormalizedMediaCoverImage{Large: &url, ExtraLarge: &url}
	}

	var bannerImage *string
	if r.BackdropPath != "" {
		url := "https://image.tmdb.org/t/p/original" + r.BackdropPath
		bannerImage = &url
	}

	var description *string
	if r.Overview != "" {
		description = &r.Overview
	}

	var score *float64
	if r.VoteAverage > 0 {
		s := r.VoteAverage * 10
		score = &s
	}

	return &dto.NormalizedMedia{
		ID:               tmdbID + 1000000,
		TmdbID:           &tmdbID,
		ExplicitProvider: "tmdb",
		ExplicitID:       strconv.Itoa(tmdbID),
		Title:            title,
		Format:           format,
		Year:             year,
		StartDate:        startDate,
		CoverImage:       coverImage,
		BannerImage:      bannerImage,
		Description:      description,
		Score:            score,
	}
}

// TmdbMovieDetailsToNormalizedMedia converts full TMDB MovieDetails to NormalizedMedia.
// englishTitle is the English title fetched from alternative titles (optional).
func TmdbMovieDetailsToNormalizedMedia(r *tmdb.MovieDetails, englishTitle string) *dto.NormalizedMedia {
	tmdbID := r.ID
	title := &dto.NormalizedMediaTitle{}
	if r.Title != "" {
		title.Spanish = &r.Title
		title.UserPreferred = &r.Title
		if englishTitle != "" {
			title.English = &englishTitle
		} else {
			// Fallback: use Spanish title if English not available
			title.English = &r.Title
		}
	}
	if r.OriginalTitle != "" && r.OriginalTitle != r.Title {
		title.Romaji = &r.OriginalTitle
		if r.OriginalLanguage == "ja" {
			title.Native = &r.OriginalTitle
		}
	}

	var year *int
	if r.ReleaseDate != "" && len(r.ReleaseDate) >= 4 {
		if y, err := strconv.Atoi(r.ReleaseDate[:4]); err == nil && y > 0 {
			year = &y
		}
	}

	var startDate *dto.NormalizedMediaDate
	if r.ReleaseDate != "" {
		startDate = parseTMDBDate(r.ReleaseDate)
	}

	movieFormat := dto.MediaFormatMovie
	format := &movieFormat

	var coverImage *dto.NormalizedMediaCoverImage
	if r.PosterPath != "" {
		url := "https://image.tmdb.org/t/p/w780" + r.PosterPath
		coverImage = &dto.NormalizedMediaCoverImage{Large: &url, ExtraLarge: &url}
	}

	var bannerImage *string
	if r.BackdropPath != "" {
		url := "https://image.tmdb.org/t/p/original" + r.BackdropPath
		bannerImage = &url
	}

	var description *string
	if r.Overview != "" {
		description = &r.Overview
	}

	var score *float64
	if r.VoteAverage > 0 {
		s := r.VoteAverage * 10
		score = &s
	}

	var genres []*string
	for _, g := range r.Genres {
		name := g.Name
		genres = append(genres, &name)
	}

	return &dto.NormalizedMedia{
		ID:               tmdbID + 1000000,
		TmdbID:           &tmdbID,
		ExplicitProvider: "tmdb",
		ExplicitID:       strconv.Itoa(tmdbID),
		Title:            title,
		Format:           format,
		Year:             year,
		StartDate:        startDate,
		CoverImage:       coverImage,
		BannerImage:      bannerImage,
		Description:      description,
		Score:            score,
		Genres:           genres,
		Runtime: func() *int {
			if r.Runtime > 0 {
				return &r.Runtime
			}
			return nil
		}(),
	}
}

// parseTMDBDate parses a TMDB date string (YYYY-MM-DD) into NormalizedMediaDate.
// Las partes ausentes o no numéricas quedan en nil.
func parseTMDBDate(dateStr string) *dto.NormalizedMediaDate {
	parts := strings.Split(dateStr, "-")
	date := &dto.NormalizedMediaDate{}

	if len(parts) >= 1 {
		date.Year = positiveInt(parts[0])
	}
	if len(parts) >= 2 {
		date.Month = positiveInt(parts[1])
	}
	if len(parts) >= 3 {
		date.Day = positiveInt(parts[2])
	}

	return date
}

// positiveInt devuelve el entero de s si es mayor que cero, o nil.
func positiveInt(s string) *int {
	n, err := strconv.Atoi(s)
	if err != nil || n <= 0 {
		return nil
	}
	return &n
}
