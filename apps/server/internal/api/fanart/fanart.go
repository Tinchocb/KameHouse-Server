package fanart

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

const baseURL = "https://webservice.fanart.tv/v3"

// Client handles FanArt.tv API requests.
// API keys are free from https://fanart.tv/get-an-api-key/
type Client struct {
	apiKey  string
	client  *http.Client
	cache   sync.Map
}

// NewClient creates a new FanArt.tv client.
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// TVImages holds the image sets available for a TV show.
type TVImages struct {
	Name        string       `json:"name"`
	ThetvdbID   string       `json:"thetvdb_id"`
	HdTVLogo    []FanArtImage `json:"hdtvlogo"`
	TVThumb     []FanArtImage `json:"tvthumb"`
	ClearArt    []FanArtImage `json:"hdclearart"`
	TVBanner    []FanArtImage `json:"tvbanner"`
	TVPoster    []FanArtImage `json:"tvposter"`
	SeasonThumb []FanArtImage `json:"seasonthumb"`
	Backgrounds []FanArtImage `json:"showbackground"`
}

// MovieImages holds the image sets available for a movie.
type MovieImages struct {
	Name      string       `json:"name"`
	TmdbID    string       `json:"tmdb_id"`
	ImdbID    string       `json:"imdb_id"`
	HdLogo    []FanArtImage `json:"hdmovielogo"`
	Thumb     []FanArtImage `json:"moviethumb"`
	ClearArt  []FanArtImage `json:"hdmovieclearart"`
	Banner    []FanArtImage `json:"moviebanner"`
	Poster    []FanArtImage `json:"movieposter"`
	Background []FanArtImage `json:"moviebackground"`
}

// FanArtImage is a single image entry from FanArt.tv
type FanArtImage struct {
	ID    string `json:"id"`
	URL   string `json:"url"`
	Lang  string `json:"lang"`
	Likes string `json:"likes"`
}

// GetTVImages fetches all available images for a TV show identified by its TVDB ID.
func (c *Client) GetTVImages(ctx context.Context, tvdbID string) (*TVImages, error) {
	cacheKey := "tv:" + tvdbID
	if cached, ok := c.cache.Load(cacheKey); ok {
		v := cached.(TVImages)
		return &v, nil
	}

	url := fmt.Sprintf("%s/tv/%s?api_key=%s", baseURL, tvdbID, c.apiKey)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fanart: get tv images: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("fanart: tv %s not found", tvdbID)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fanart: get tv images: status %d", resp.StatusCode)
	}

	var result TVImages
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("fanart: decode tv images: %w", err)
	}

	c.cache.Store(cacheKey, result)
	return &result, nil
}

// GetMovieImages fetches all available images for a movie by its TMDb ID.
func (c *Client) GetMovieImages(ctx context.Context, tmdbID string) (*MovieImages, error) {
	cacheKey := "movie:" + tmdbID
	if cached, ok := c.cache.Load(cacheKey); ok {
		v := cached.(MovieImages)
		return &v, nil
	}

	url := fmt.Sprintf("%s/movies/%s?api_key=%s", baseURL, tmdbID, c.apiKey)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fanart: get movie images: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("fanart: movie %s not found", tmdbID)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fanart: get movie images: status %d", resp.StatusCode)
	}

	var result MovieImages
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("fanart: decode movie images: %w", err)
	}

	c.cache.Store(cacheKey, result)
	return &result, nil
}

// BestImage returns the URL of the highest-liked image from a slice, optionally filtered by language.
// If lang is empty, it picks the best across all languages (English first, then any).
func BestImage(images []FanArtImage, lang string) string {
	if len(images) == 0 {
		return ""
	}
	// Try to find lang-specific first, then fallback to "en", then first available
	candidates := images
	if lang != "" {
		var filtered []FanArtImage
		for _, img := range images {
			if img.Lang == lang {
				filtered = append(filtered, img)
			}
		}
		if len(filtered) > 0 {
			candidates = filtered
		}
	}
	// Prefer English if no specific lang
	if lang == "" {
		var enFiltered []FanArtImage
		for _, img := range candidates {
			if img.Lang == "en" || img.Lang == "" {
				enFiltered = append(enFiltered, img)
			}
		}
		if len(enFiltered) > 0 {
			return enFiltered[0].URL
		}
	}
	return candidates[0].URL
}
