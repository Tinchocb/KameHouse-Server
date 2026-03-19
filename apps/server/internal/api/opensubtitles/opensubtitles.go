package opensubtitles

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"
)

const baseURL = "https://api.opensubtitles.com/api/v1"

// Client handles OpenSubtitles REST API v1 requests.
// Free API key: https://www.opensubtitles.com/en/consumers
// Free limits: unlimited searches, 5 downloads/day (20 with VIP)
type Client struct {
	apiKey    string
	userAgent string
	client    *http.Client
	cache     sync.Map
}

// NewClient creates a new OpenSubtitles client.
// userAgent should be "AppName/Version" e.g. "KameHouse/2.0"
func NewClient(apiKey, userAgent string) *Client {
	if userAgent == "" {
		userAgent = "KameHouse/2.0"
	}
	return &Client{
		apiKey:    apiKey,
		userAgent: userAgent,
		client:    &http.Client{Timeout: 15 * time.Second},
	}
}

// SubtitleFile represents a single subtitle file result.
type SubtitleFile struct {
	FileID    int    `json:"file_id"`
	FileName  string `json:"file_name"`
	CDNumber  int    `json:"cd_number"`
	Downloads int    `json:"download_count"`
}

// SubtitleAttributes holds the attributes of a subtitle entry.
type SubtitleAttributes struct {
	Language      string         `json:"language"`
	DownloadCount int            `json:"download_count"`
	NewDownloadCount int         `json:"new_download_count"`
	SubtitleID    string         `json:"subtitle_id"`
	Release       string         `json:"release"`
	Comments      string         `json:"comments"`
	Files         []SubtitleFile `json:"files"`
	FeatureDetails FeatureDetails `json:"feature_details"`
}

// FeatureDetails holds information about the media for a subtitle.
type FeatureDetails struct {
	FeatureID   int    `json:"feature_id"`
	FeatureType string `json:"feature_type"` // "Movie", "Episode"
	Year        int    `json:"year"`
	Title       string `json:"title"`
	SeasonNumber int   `json:"season_number"`
	EpisodeNumber int  `json:"episode_number"`
}

// SubtitleResult is a single entry in the search results.
type SubtitleResult struct {
	ID         string             `json:"id"`
	Type       string             `json:"type"`
	Attributes SubtitleAttributes `json:"attributes"`
}

// SearchResponse is the paginated response from the subtitles search endpoint.
type SearchResponse struct {
	TotalCount int              `json:"total_count"`
	TotalPages int              `json:"total_pages"`
	Page       int              `json:"page"`
	Data       []SubtitleResult `json:"data"`
}

// SearchOptions defines the filters for a subtitle search.
type SearchOptions struct {
	TmdbID        int
	ImdbID        string
	Language      string // ISO 639-1: "en", "es", "pt", "fr", etc.
	SeasonNumber  int    // for TV episodes
	EpisodeNumber int    // for TV episodes
	Query         string // fallback title search
	Limit         int    // max results (default 10)
}

// SearchSubtitles searches for subtitles matching the given criteria.
func (c *Client) SearchSubtitles(ctx context.Context, opts SearchOptions) (*SearchResponse, error) {
	cacheKey := fmt.Sprintf("search:%d:%s:%s:%d:%d", opts.TmdbID, opts.ImdbID, opts.Language, opts.SeasonNumber, opts.EpisodeNumber)
	if cached, ok := c.cache.Load(cacheKey); ok {
		v := cached.(SearchResponse)
		return &v, nil
	}

	params := url.Values{}
	if opts.TmdbID > 0 {
		params.Set("tmdb_id", fmt.Sprintf("%d", opts.TmdbID))
	}
	if opts.ImdbID != "" {
		params.Set("imdb_id", opts.ImdbID)
	}
	if opts.Language != "" {
		params.Set("languages", opts.Language)
	}
	if opts.SeasonNumber > 0 {
		params.Set("season_number", fmt.Sprintf("%d", opts.SeasonNumber))
	}
	if opts.EpisodeNumber > 0 {
		params.Set("episode_number", fmt.Sprintf("%d", opts.EpisodeNumber))
	}
	if opts.Query != "" {
		params.Set("query", opts.Query)
	}
	limit := opts.Limit
	if limit <= 0 {
		limit = 10
	}
	params.Set("per_page", fmt.Sprintf("%d", limit))

	req, err := http.NewRequestWithContext(ctx, "GET", baseURL+"/subtitles?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Api-Key", c.apiKey)
	req.Header.Set("User-Agent", c.userAgent)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("opensubtitles: search request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("opensubtitles: rate limited (429)")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("opensubtitles: unexpected status %d", resp.StatusCode)
	}

	var result SearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("opensubtitles: decode failed: %w", err)
	}

	c.cache.Store(cacheKey, result)
	return &result, nil
}
