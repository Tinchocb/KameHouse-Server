package omdb

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"
)

const baseURL = "https://www.omdbapi.com"

// Client handles OMDb API requests.
// Free API key (1,000 req/day): https://www.omdbapi.com/apikey.aspx
type Client struct {
	apiKey string
	client *http.Client
	cache  sync.Map
}

// NewClient creates a new OMDb client.
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// MovieInfo holds the enrichment data from OMDb (ratings, runtime, awards, etc.)
type MovieInfo struct {
	Title      string   `json:"Title"`
	Year       string   `json:"Year"`
	Rated      string   `json:"Rated"`   // PG-13, R, etc.
	Released   string   `json:"Released"`
	Runtime    string   `json:"Runtime"` // "148 min"
	Genre      string   `json:"Genre"`
	Director   string   `json:"Director"`
	Actors     string   `json:"Actors"`
	Plot       string   `json:"Plot"`
	Language   string   `json:"Language"`
	Country    string   `json:"Country"`
	Awards     string   `json:"Awards"`
	ImdbRating string   `json:"imdbRating"` // "8.4"
	ImdbVotes  string   `json:"imdbVotes"`  // "1,234,567"
	ImdbID     string   `json:"imdbID"`
	Type       string   `json:"Type"`       // "movie", "series", "episode"
	Ratings    []Rating `json:"Ratings"`    // RT, Metacritic etc.
	Response   string   `json:"Response"`   // "True" or "False"
	Error      string   `json:"Error"`      // present when Response=False
}

// Rating is a single rating entry (e.g. from Rotten Tomatoes, Metacritic).
type Rating struct {
	Source string `json:"Source"`
	Value  string `json:"Value"`
}

// GetByImdbID fetches OMDb data for a given IMDb ID (e.g. "tt0111161").
func (c *Client) GetByImdbID(ctx context.Context, imdbID string) (*MovieInfo, error) {
	cacheKey := "imdb:" + imdbID
	if cached, ok := c.cache.Load(cacheKey); ok {
		v := cached.(MovieInfo)
		return &v, nil
	}

	params := url.Values{}
	params.Set("apikey", c.apiKey)
	params.Set("i", imdbID)
	params.Set("plot", "short")

	info, err := c.doRequest(ctx, params)
	if err != nil {
		return nil, err
	}
	c.cache.Store(cacheKey, *info)
	return info, nil
}

// GetByTitle fetches OMDb data for a given title and optional year.
func (c *Client) GetByTitle(ctx context.Context, title string, year int) (*MovieInfo, error) {
	cacheKey := fmt.Sprintf("title:%s:%d", title, year)
	if cached, ok := c.cache.Load(cacheKey); ok {
		v := cached.(MovieInfo)
		return &v, nil
	}

	params := url.Values{}
	params.Set("apikey", c.apiKey)
	params.Set("t", title)
	params.Set("plot", "short")
	if year > 0 {
		params.Set("y", fmt.Sprintf("%d", year))
	}

	info, err := c.doRequest(ctx, params)
	if err != nil {
		return nil, err
	}
	c.cache.Store(cacheKey, *info)
	return info, nil
}

func (c *Client) doRequest(ctx context.Context, params url.Values) (*MovieInfo, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", baseURL+"/?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("omdb: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("omdb: unexpected status %d", resp.StatusCode)
	}

	var info MovieInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("omdb: decode failed: %w", err)
	}

	if info.Response == "False" {
		return nil, fmt.Errorf("omdb: %s", info.Error)
	}

	return &info, nil
}
