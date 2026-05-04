package tmdb

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

const maxRetries = 3

var baseURL = "https://api.themoviedb.org/3"

// Client handles TMDb API requests with caching using the new EdgeHTTPClient.
type Client struct {
	bearerToken string
	language    string
	cache       sync.Map // simple in-memory cache for search results
	rateLimiter chan struct{}
}

// language is a BCP 47 language tag (e.g. "es-MX", "en-US"). If empty, defaults to "es-MX".
func NewClient(bearerToken string, language ...string) *Client {
	lang := "es-MX"
	if len(language) > 0 && language[0] != "" {
		lang = language[0]
	}
	return &Client{
		bearerToken: bearerToken,
		language:    lang,
		rateLimiter: make(chan struct{}, 4), // max 4 concurrent requests
	}
}

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
}

// SearchResponse is the paginated response from TMDb search.
type SearchResponse struct {
	Page         int            `json:"page"`
	Results      []SearchResult `json:"results"`
	TotalPages   int            `json:"total_pages"`
	TotalResults int            `json:"total_results"`
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

// GetTVSeason fetches the details of a specific TV season, including its episodes.
func (c *Client) GetTVSeason(ctx context.Context, tvID int, seasonNumber int) (TVSeasonDetails, error) {
	cacheKey := fmt.Sprintf("tv_season:%d:%d:%s", tvID, seasonNumber, c.language)
	if cached, ok := c.cache.Load(cacheKey); ok {
		return cached.(TVSeasonDetails), nil
	}

	params := url.Values{}
	params.Set("language", c.language)


	resp, err := executeWithRetry[TVSeasonDetails](ctx, c, fmt.Sprintf("/tv/%d/season/%d?%s", tvID, seasonNumber, params.Encode()))
	if err != nil {
		return TVSeasonDetails{}, fmt.Errorf("tmdb get tv season: %w", err)
	}

	c.cache.Store(cacheKey, *resp)
	return *resp, nil
}

// SearchTV searches for anime TV shows on TMDb.
// It filters results to animation genre (16) and Japanese origin when possible.
func (c *Client) SearchTV(ctx context.Context, query string) ([]SearchResult, error) {
	// Check cache
	if cached, ok := c.cache.Load("tv:" + query); ok {
		return cached.([]SearchResult), nil
	}

	params := url.Values{}
	params.Set("query", query)
	params.Set("language", c.language)
	params.Set("page", "1")


	resp, err := executeWithRetry[SearchResponse](ctx, c, "/search/tv?"+params.Encode())
	if err != nil {
		return nil, fmt.Errorf("tmdb search tv: %w", err)
	}

	// Filter for animation genre (16) to prioritize anime
	animationResults := make([]SearchResult, 0)
	otherResults := make([]SearchResult, 0)
	for _, r := range resp.Results {
		isAnimation := false
		for _, g := range r.GenreIDs {
			if g == 16 { // Animation genre
				isAnimation = true
				break
			}
		}
		if isAnimation {
			animationResults = append(animationResults, r)
		} else {
			otherResults = append(otherResults, r)
		}
	}

	// Prefer animation results, fallback to all results
	results := animationResults
	if len(results) == 0 {
		results = otherResults
	}

	// Limit to top 5 results
	if len(results) > 5 {
		results = results[:5]
	}

	c.cache.Store("tv:"+query, results)
	return results, nil
}

// SearchMovie searches for anime movies on TMDb.
func (c *Client) SearchMovie(ctx context.Context, query string) ([]SearchResult, error) {
	// Check cache
	if cached, ok := c.cache.Load("movie:" + query); ok {
		return cached.([]SearchResult), nil
	}

	params := url.Values{}
	params.Set("query", query)
	params.Set("language", c.language)
	params.Set("page", "1")


	resp, err := executeWithRetry[SearchResponse](ctx, c, "/search/movie?"+params.Encode())
	if err != nil {
		return nil, fmt.Errorf("tmdb search movie: %w", err)
	}

	// Filter for animation genre (16)
	animationResults := make([]SearchResult, 0)
	for _, r := range resp.Results {
		for _, g := range r.GenreIDs {
			if g == 16 {
				animationResults = append(animationResults, r)
				break
			}
		}
	}

	// Prefer animation results, fallback to all results
	results := animationResults
	if len(results) == 0 {
		results = resp.Results
	}
	if len(results) > 5 {
		results = results[:5]
	}

	c.cache.Store("movie:"+query, results)
	return results, nil
}

// DiscoverTV discovers TV shows on TMDb based on various filters.
// It prioritizes Japanese animation (with origin_country=JP and with_genres=16).
func (c *Client) DiscoverTV(ctx context.Context, page *int, sort *string, status *string, genres []string, year *int, airingAtGreater *int, airingAtLesser *int) ([]SearchResult, int, error) {
	// Check cache for a deterministic key
	var p, y, ag, al int
	var s, st string
	if page != nil { p = *page }
	if sort != nil { s = *sort }
	if status != nil { st = *status }
	if year != nil { y = *year }
	if airingAtGreater != nil { ag = *airingAtGreater }
	if airingAtLesser != nil { al = *airingAtLesser }

	cacheKey := fmt.Sprintf("discover_tv:p=%d:s=%s:st=%s:g=%v:y=%d:ag=%d:al=%d", p, s, st, genres, y, ag, al)
	if cached, ok := c.cache.Load(cacheKey); ok {
		resp := cached.(SearchResponse)
		return resp.Results, resp.TotalPages, nil
	}

	params := url.Values{}
	params.Set("language", c.language)

	params.Set("with_origin_country", "JP") // Default to Japanese origin for anime
	params.Set("with_genres", "16")         // Default to Animation genre

	if page != nil {
		params.Set("page", strconv.Itoa(*page))
	} else {
		params.Set("page", "1")
	}

	if sort != nil && *sort != "" {
		params.Set("sort_by", *sort)
	}

	if status != nil && *status != "" {
		// TMDB uses integer codes for status sometimes in discover, or we might need to map them if possible.
		// For now, TMDB discover uses `with_status` (0=Returning Series, 1=Planned, 2=In Production, 3=Ended, 4=Canceled, 5=Pilot)
		params.Set("with_status", *status)
	}

	if year != nil && *year > 0 {
		params.Set("first_air_date_year", strconv.Itoa(*year))
	}

	if airingAtGreater != nil {
		dateStr := time.Unix(int64(*airingAtGreater), 0).Format("2006-01-02")
		params.Set("air_date.gte", dateStr)
	}
	if airingAtLesser != nil {
		dateStr := time.Unix(int64(*airingAtLesser), 0).Format("2006-01-02")
		params.Set("air_date.lte", dateStr)
	}

	resp, err := executeWithRetry[SearchResponse](ctx, c, "/discover/tv?"+params.Encode())
	if err != nil {
		return nil, 0, fmt.Errorf("tmdb discover tv: %w", err)
	}

	c.cache.Store(cacheKey, *resp)
	return resp.Results, resp.TotalPages, nil
}

// GetTVAlternativeTitles gets all alternative titles for a TV show.
func (c *Client) GetTVAlternativeTitles(ctx context.Context, tvID int) ([]AlternativeTitle, error) {
	cacheKey := fmt.Sprintf("tv_alt:%d", tvID)
	if cached, ok := c.cache.Load(cacheKey); ok {
		return cached.([]AlternativeTitle), nil
	}

	params := url.Values{}


	resp, err := executeWithRetry[AlternativeTitlesResponse](ctx, c, fmt.Sprintf("/tv/%d/alternative_titles?%s", tvID, params.Encode()))
	if err != nil {
		return nil, fmt.Errorf("tmdb get tv alternative titles: %w", err)
	}

	c.cache.Store(cacheKey, resp.Results)
	return resp.Results, nil
}

// GetMovieAlternativeTitles gets all alternative titles for a movie.
func (c *Client) GetMovieAlternativeTitles(ctx context.Context, movieID int) ([]AlternativeTitle, error) {
	cacheKey := fmt.Sprintf("movie_alt:%d", movieID)
	if cached, ok := c.cache.Load(cacheKey); ok {
		return cached.([]AlternativeTitle), nil
	}

	params := url.Values{}


	resp, err := executeWithRetry[AlternativeTitlesResponse](ctx, c, fmt.Sprintf("/movie/%d/alternative_titles?%s", movieID, params.Encode()))
	if err != nil {
		return nil, fmt.Errorf("tmdb get movie alternative titles: %w", err)
	}

	c.cache.Store(cacheKey, resp.Results)
	return resp.Results, nil
}

// GetAllTitlesForResult returns all known titles for a search result,
// including the main name, original name, and all alternative titles.
func (c *Client) GetAllTitlesForResult(ctx context.Context, result SearchResult) []string {
	titles := make([]string, 0, 10)

	isMovie := result.Title != ""

	// Add main titles
	if result.Name != "" {
		titles = append(titles, result.Name)
	}
	if result.Title != "" {
		titles = append(titles, result.Title)
	}
	if result.OriginalName != "" && result.OriginalName != result.Name {
		titles = append(titles, result.OriginalName)
	}
	if result.OriginalTitle != "" && result.OriginalTitle != result.Title {
		titles = append(titles, result.OriginalTitle)
	}

	// Fetch alternative titles
	var altTitles []AlternativeTitle
	var err error
	if isMovie {
		altTitles, err = c.GetMovieAlternativeTitles(ctx, result.ID)
	} else {
		altTitles, err = c.GetTVAlternativeTitles(ctx, result.ID)
	}

	if err == nil {
		for _, alt := range altTitles {
			if alt.Title != "" {
				titles = append(titles, alt.Title)
			}
		}
	}

	// Deduplicate
	seen := make(map[string]struct{}, len(titles))
	unique := make([]string, 0, len(titles))
	for _, t := range titles {
		if _, ok := seen[t]; !ok {
			seen[t] = struct{}{}
			unique = append(unique, t)
		}
	}

	return unique
}


// doRequest was removed. EdgeHTTPClient handles all request logic natively securely.

// GetTVDetails fetches a specific TV show by ID and returns it as a SearchResult for mapping.
func (c *Client) GetTVDetails(ctx context.Context, id string) (SearchResult, error) {
	cacheKey := fmt.Sprintf("tv_detail:%s:%s", id, c.language)
	if cached, ok := c.cache.Load(cacheKey); ok {
		return cached.(SearchResult), nil
	}

	params := url.Values{}
	params.Set("language", c.language)


	resp, err := executeWithRetry[SearchResult](ctx, c, fmt.Sprintf("/tv/%s?%s", id, params.Encode()))
	if err != nil {
		return SearchResult{}, fmt.Errorf("tmdb get tv details: %w", err)
	}

	c.cache.Store(cacheKey, *resp)
	return *resp, nil
}

// GetMovieDetails fetches a specific Movie by ID and returns it as a SearchResult for mapping.
func (c *Client) GetMovieDetails(ctx context.Context, id string) (SearchResult, error) {
	cacheKey := fmt.Sprintf("movie_detail:%s:%s", id, c.language)
	if cached, ok := c.cache.Load(cacheKey); ok {
		return cached.(SearchResult), nil
	}

	params := url.Values{}
	params.Set("language", c.language)


	resp, err := executeWithRetry[SearchResult](ctx, c, fmt.Sprintf("/movie/%s?%s", id, params.Encode()))
	if err != nil {
		return SearchResult{}, fmt.Errorf("tmdb get movie details: %w", err)
	}

	c.cache.Store(cacheKey, *resp)
	return *resp, nil
}

// MovieBelongsToCollection is the minimal collection stub embedded in MovieDetails.
type MovieBelongsToCollection struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// MovieDetails is the detailed response for a single movie from /movie/{id}.
type MovieDetails struct {
	ID                  int                       `json:"id"`
	Title               string                    `json:"title"`
	OriginalTitle       string                    `json:"original_title"`
	Overview            string                    `json:"overview"`
	ReleaseDate         string                    `json:"release_date"`
	PosterPath          string                    `json:"poster_path"`
	BackdropPath        string                    `json:"backdrop_path"`
	GenreIDs            []int                     `json:"genre_ids"`
	Genres              []struct{ ID int; Name string } `json:"genres"`
	ImdbID              string                    `json:"imdb_id"`
	BelongsToCollection *MovieBelongsToCollection `json:"belongs_to_collection"`
}

// CollectionPart is one movie within a TMDB franchise/saga collection.
type CollectionPart struct {
	ID           int    `json:"id"`
	Title        string `json:"title"`
	OriginalTitle string `json:"original_title"`
	Overview     string `json:"overview"`
	ReleaseDate  string `json:"release_date"`
	PosterPath   string `json:"poster_path"`
	BackdropPath string `json:"backdrop_path"`
}

// CollectionDetails is the response from /collection/{id}.
type CollectionDetails struct {
	ID           int              `json:"id"`
	Name         string           `json:"name"`
	Overview     string           `json:"overview"`
	PosterPath   string           `json:"poster_path"`
	BackdropPath string           `json:"backdrop_path"`
	Parts        []CollectionPart `json:"parts"`
}

// GetMovieDetails fetches detailed info about a movie, including its franchise collection.
func (c *Client) GetMovieDetailsV2(ctx context.Context, id int) (MovieDetails, error) {
	cacheKey := fmt.Sprintf("movie_detail_v2:%d:%s", id, c.language)
	if cached, ok := c.cache.Load(cacheKey); ok {
		return cached.(MovieDetails), nil
	}

	params := url.Values{}
	params.Set("language", c.language)


	resp, err := executeWithRetry[MovieDetails](ctx, c, fmt.Sprintf("/movie/%d?%s", id, params.Encode()))
	if err != nil {
		return MovieDetails{}, fmt.Errorf("tmdb get movie details v2: %w", err)
	}

	c.cache.Store(cacheKey, *resp)
	return *resp, nil
}

// GetCollection fetches a TMDB franchise/saga collection by its collection ID.
func (c *Client) GetCollection(ctx context.Context, collectionID int) (CollectionDetails, error) {
	cacheKey := fmt.Sprintf("collection:%d:%s", collectionID, c.language)
	if cached, ok := c.cache.Load(cacheKey); ok {
		return cached.(CollectionDetails), nil
	}

	params := url.Values{}
	params.Set("language", c.language)


	resp, err := executeWithRetry[CollectionDetails](ctx, c, fmt.Sprintf("/collection/%d?%s", collectionID, params.Encode()))
	if err != nil {
		return CollectionDetails{}, fmt.Errorf("tmdb get collection: %w", err)
	}

	c.cache.Store(cacheKey, *resp)
	return *resp, nil
}

// ExternalIDSource represents the type of external ID source for cross-referencing.
type ExternalIDSource string

const (
	ExternalSourceTvdb ExternalIDSource = "tvdb_id"
	ExternalSourceImdb ExternalIDSource = "imdb_id"
)

// FindResponse is the response from TMDb's /find endpoint.
type FindResponse struct {
	TVResults    []SearchResult `json:"tv_results"`
	MovieResults []SearchResult `json:"movie_results"`
}

// FindByExternalID resolves a title from an external ID (e.g. TVDB, IMDb) using TMDb's /find endpoint.
// This is free (uses existing TMDb key) and avoids the need for a paid TVDB v4 subscription.
//
// Example:
//
//	results, err := client.FindByExternalID(ctx, "81189", ExternalSourceTvdb)
func (c *Client) FindByExternalID(ctx context.Context, externalID string, source ExternalIDSource) (*FindResponse, error) {
	cacheKey := fmt.Sprintf("find:%s:%s", source, externalID)
	if cached, ok := c.cache.Load(cacheKey); ok {
		v := cached.(FindResponse)
		return &v, nil
	}

	params := url.Values{}
	params.Set("external_source", string(source))
	params.Set("language", c.language)


	resp, err := executeWithRetry[FindResponse](ctx, c, fmt.Sprintf("/find/%s?%s", externalID, params.Encode()))
	if err != nil {
		return nil, fmt.Errorf("tmdb find by external id (%s=%s): %w", source, externalID, err)
	}

	c.cache.Store(cacheKey, *resp)
	return resp, nil
}

func executeWithRetry[T any](ctx context.Context, c *Client, endpoint string) (*T, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		req, err := http.NewRequestWithContext(ctx, "GET", baseURL+endpoint, nil)
		if err != nil {
			return nil, err
		}

		req.Header.Set("Accept", "application/json")
		// Dynamically handle both v3 and v4 tokens
		token := strings.Trim(c.bearerToken, " \t\r\n\"'")
		if token != "" {
			if len(token) > 50 {
				// It's a v4 Read Access Token (JWT) -> use Bearer Auth
				req.Header.Set("Authorization", "Bearer "+token)
			} else {
				// It's a v3 API Key -> inject into query string
				q := req.URL.Query()
				q.Add("api_key", token)
				req.URL.RawQuery = q.Encode()
			}
		}

		c.rateLimiter <- struct{}{}
		resp, err := client.Do(req)
		<-c.rateLimiter

		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			resp.Body.Close()

			var waitTime time.Duration
			if retryAfter, err := strconv.Atoi(resp.Header.Get("Retry-After")); err == nil {
				waitTime = time.Duration(retryAfter) * time.Second
			} else {
				waitTime = time.Duration(math.Pow(2, float64(attempt))) * time.Second
			}

			select {
			case <-time.After(waitTime):
			case <-ctx.Done():
				return nil, ctx.Err()
			}

			lastErr = fmt.Errorf("rate limited")
			continue
		}

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			resp.Body.Close()
			return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
		}

		var result T
		err = json.NewDecoder(resp.Body).Decode(&result)
		resp.Body.Close()

		if err != nil {
			return nil, err
		}

		return &result, nil
	}

	return nil, lastErr
}
