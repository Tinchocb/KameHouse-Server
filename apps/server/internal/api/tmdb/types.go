package tmdb

const maxRetries = 3

var baseURL = "https://api.themoviedb.org/3"

// SearchResult represents a single search result from TMDb.
type SearchResult struct {
	ID               int      `json:"id"`
	Name             string   `json:"name"`           // For TV shows
	Title            string   `json:"title"`          // For movies
	OriginalName     string   `json:"original_name"`  // For TV shows
	OriginalTitle    string   `json:"original_title"` // For movies
	OriginalLanguage string   `json:"original_language"`
	Overview         string   `json:"overview"`
	FirstAirDate     string   `json:"first_air_date"` // For TV shows
	ReleaseDate      string   `json:"release_date"`   // For movies
	GenreIDs         []int    `json:"genre_ids"`
	OriginCountry    []string `json:"origin_country"`
	PosterPath       string   `json:"poster_path"`
	BackdropPath     string   `json:"backdrop_path"`
	NumberOfEpisodes int      `json:"number_of_episodes"`
	VoteAverage      float64  `json:"vote_average"`
}

// AlternativeTitle represents an alternative title for a show.
type AlternativeTitle struct {
	ISO31661 string `json:"iso_3166_1"`
	Title    string `json:"title"`
	Type     string `json:"type"`
}

// AlternativeTitlesResponse is the response for alternative titles.
type AlternativeTitlesResponse struct {
	ID      int                `json:"id"`
	Results []AlternativeTitle `json:"results"`
}

// Genre represents a TMDB genre.
type Genre struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// TVDetails represents detailed info about a TV show.
type TVDetails struct {
	ID               int      `json:"id"`
	Name             string   `json:"name"`
	OriginalName     string   `json:"original_name"`
	OriginalLanguage string   `json:"original_language"`
	Overview         string   `json:"overview"`
	FirstAirDate     string   `json:"first_air_date"`
	OriginCountry    []string `json:"origin_country"`
	NumberOfSeasons  int      `json:"number_of_seasons"`
	NumberOfEpisodes int      `json:"number_of_episodes"`
	PosterPath       string   `json:"poster_path"`
	BackdropPath     string   `json:"backdrop_path"`
	VoteAverage      float64  `json:"vote_average"`
	Genres           []Genre  `json:"genres"`
	EpisodeRunTime   []int    `json:"episode_run_time"`
}

// TVEpisode represents a single episode within a TMDb TV season.
type TVEpisode struct {
	ID            int    `json:"id"`
	EpisodeNumber int    `json:"episode_number"`
	SeasonNumber  int    `json:"season_number"`
	Name          string `json:"name"`
	Overview      string `json:"overview"`
	StillPath     string `json:"still_path"`
	AirDate       string `json:"air_date"`
	Runtime       int    `json:"runtime"`
}

// TVSeasonDetails represents a TV season including its episodes.
type TVSeasonDetails struct {
	ID           int         `json:"id"`
	SeasonNumber int         `json:"season_number"`
	Name         string      `json:"name"`
	Overview     string      `json:"overview"`
	AirDate      string      `json:"air_date"`
	PosterPath   string      `json:"poster_path"`
	Episodes     []TVEpisode `json:"episodes"`
}

// MovieDetails is the detailed response for a single movie from /movie/{id}.
type MovieDetails struct {
	ID                  int                       `json:"id"`
	Title               string                    `json:"title"`
	OriginalTitle       string                    `json:"original_title"`
	OriginalLanguage    string                    `json:"original_language"`
	Overview            string                    `json:"overview"`
	ReleaseDate         string                    `json:"release_date"`
	PosterPath          string                    `json:"poster_path"`
	BackdropPath        string                    `json:"backdrop_path"`
	VoteAverage         float64                   `json:"vote_average"`
	Genres              []Genre                   `json:"genres"`
	GenreIDs            []int                     `json:"genre_ids"`
	ImdbID              string                    `json:"imdb_id"`
	Runtime             int                       `json:"runtime"`
	BelongsToCollection *MovieBelongsToCollection `json:"belongs_to_collection"`
}

// MovieBelongsToCollection is the minimal collection stub embedded in MovieDetails.
type MovieBelongsToCollection struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}
