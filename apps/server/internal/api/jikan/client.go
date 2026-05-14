package jikan

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	httputil "kamehouse/internal/util/http"
	"github.com/rs/zerolog"
)

type Client struct {
	logger      *zerolog.Logger
	httpClient  *http.Client
	rateLimiter chan struct{}
}

func NewClient(logger *zerolog.Logger) *Client {
	return &Client{
		logger:      logger,
		httpClient:  httputil.NewFastClient(),
		// Jikan has a rate limit of 3 requests per second, 60 requests per minute.
		rateLimiter: make(chan struct{}, 2),
	}
}

type AnimeSearchResponse struct {
	Data []struct {
		MalID  int    `json:"mal_id"`
		Title  string `json:"title"`
		TitleEng string `json:"title_english"`
		TitleJpn string `json:"title_japanese"`
		Images struct {
			Jpg struct {
				LargeImageUrl string `json:"large_image_url"`
			} `json:"jpg"`
		} `json:"images"`
		Synopsis string `json:"synopsis"`
		Episodes int    `json:"episodes"`
	} `json:"data"`
}

type AnimeEpisodesResponse struct {
	Data []struct {
		MalID         int    `json:"mal_id"`
		Episode       int    `json:"episode"`
		Title         string `json:"title"`
		TitleJapanese string `json:"title_japanese"`
		TitleRomaji   string `json:"title_romanji"`
		Aired         string `json:"aired"`
		Synopsis      string `json:"synopsis"`
	} `json:"data"`
	Pagination struct {
		HasNextPage bool `json:"has_next_page"`
	} `json:"pagination"`
}

// SearchAnime queries the Jikan API by title and returns the first match.
func (c *Client) SearchAnime(ctx context.Context, title string) (*AnimeSearchResponse, error) {
	url := fmt.Sprintf("https://api.jikan.moe/v4/anime?q=%s&limit=1", title)
	
	for attempt := 0; attempt < 3; attempt++ {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return nil, err
		}

		c.rateLimiter <- struct{}{}
		resp, err := c.httpClient.Do(req)
		<-c.rateLimiter

		if err != nil {
			return nil, err
		}
		
		if resp.StatusCode == http.StatusTooManyRequests {
			resp.Body.Close()
			time.Sleep(2 * time.Second)
			continue
		}
		
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("jikan api returned status %d", resp.StatusCode)
		}

		var res AnimeSearchResponse
		if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
			return nil, err
		}

		return &res, nil
	}
	return nil, fmt.Errorf("jikan rate limited after retries")
}

// GetAnimeEpisodes fetches all episodes for a specific MAL ID, handling pagination.
func (c *Client) GetAnimeEpisodes(ctx context.Context, malID int) (*AnimeEpisodesResponse, error) {
	var fullRes AnimeEpisodesResponse
	page := 1

	for {
		url := fmt.Sprintf("https://api.jikan.moe/v4/anime/%d/episodes?page=%d", malID, page)
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return nil, err
		}

		c.rateLimiter <- struct{}{}
		resp, err := c.httpClient.Do(req)
		<-c.rateLimiter

		if err != nil {
			return nil, err
		}
		
		if resp.StatusCode == http.StatusTooManyRequests {
			resp.Body.Close()
			time.Sleep(1 * time.Second)
			continue
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return nil, fmt.Errorf("jikan api returned status %d", resp.StatusCode)
		}

		var res AnimeEpisodesResponse
		if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
			resp.Body.Close()
			return nil, err
		}
		resp.Body.Close()

		fullRes.Data = append(fullRes.Data, res.Data...)

		if !res.Pagination.HasNextPage {
			break
		}
		page++
		
		// Respect rate limit slightly during pagination
		time.Sleep(350 * time.Millisecond)
	}

	return &fullRes, nil
}
