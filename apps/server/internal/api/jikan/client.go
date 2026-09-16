package jikan

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"time"

	httputil "kamehouse/internal/util/http"
	"github.com/rs/zerolog"
	"golang.org/x/time/rate"
)

type Client struct {
	logger     *zerolog.Logger
	httpClient *http.Client
	limiter    *rate.Limiter
}

func NewClient(logger *zerolog.Logger) *Client {
	return &Client{
		logger:     logger,
		httpClient: httputil.NewFastClient(),
		// Jikan has a rate limit of 3 requests per second, 60 requests per minute.
		// We set a conservative 2 req/s with burst of 3.
		limiter: rate.NewLimiter(rate.Limit(2), 3),
	}
}

type AnimeSearchResponse struct {
	Data []struct {
		MalID    int    `json:"mal_id"`
		Title    string `json:"title"`
		TitleEng string `json:"title_english"`
		TitleJpn string `json:"title_japanese"`
		Images   struct {
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
		Episode       int    `json:"mal_id"`
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

type AnimeFullResponse struct {
	Data struct {
		MalID    int    `json:"mal_id"`
		Title    string `json:"title"`
		TitleEng string `json:"title_english"`
		TitleJpn string `json:"title_japanese"`
		Images   struct {
			Jpg struct {
				LargeImageUrl string `json:"large_image_url"`
			} `json:"jpg"`
		} `json:"images"`
		Synopsis string `json:"synopsis"`
		Episodes int    `json:"episodes"`
		Status   string `json:"status"`
		Duration string `json:"duration"`
		Rating   string `json:"rating"`
		Score    float64 `json:"score"`
		Studios  []struct {
			Name string `json:"name"`
		} `json:"studios"`
		Genres []struct {
			Name string `json:"name"`
		} `json:"genres"`
		Demographics []struct {
			Name string `json:"name"`
		} `json:"demographics"`
		Theme struct {
			Openings []string `json:"openings"`
			Endings  []string `json:"endings"`
		} `json:"theme"`
		Relations []struct {
			Relation string `json:"relation"`
			Entry    []struct {
				MalID int    `json:"mal_id"`
				Type  string `json:"type"`
				Name  string `json:"name"`
			} `json:"entry"`
		} `json:"relations"`
	} `json:"data"`
}

type AnimeCharactersResponse struct {
	Data []struct {
		Character struct {
			MalID int    `json:"mal_id"`
			Name  string `json:"name"`
			Images struct {
				Jpg struct {
					ImageUrl string `json:"image_url"`
				} `json:"jpg"`
			} `json:"images"`
		} `json:"character"`
		Role string `json:"role"`
	} `json:"data"`
}

func (c *Client) executeRequest(ctx context.Context, reqURL string, target interface{}) error {
	const maxRetries = 3
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		if err := ctx.Err(); err != nil {
			return err
		}

		if err := c.limiter.Wait(ctx); err != nil {
			return err
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
		if err != nil {
			return err
		}
		req.Header.Set("Accept", "application/json")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			if !c.sleepBackoff(ctx, attempt) {
				return ctx.Err()
			}
			continue
		}

		if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
			resp.Body.Close()
			lastErr = fmt.Errorf("http status: %d", resp.StatusCode)
			if !c.sleepBackoff(ctx, attempt) {
				return ctx.Err()
			}
			continue
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return fmt.Errorf("jikan api returned status %d", resp.StatusCode)
		}

		err = json.NewDecoder(resp.Body).Decode(target)
		resp.Body.Close()
		return err
	}

	return fmt.Errorf("jikan: request failed after %d retries: %w", maxRetries, lastErr)
}

func (c *Client) sleepBackoff(ctx context.Context, attempt int) bool {
	base := time.Duration(1<<attempt) * time.Second
	jitter := time.Duration(rand.Intn(400)) * time.Millisecond
	select {
	case <-time.After(base + jitter):
		return true
	case <-ctx.Done():
		return false
	}
}

// SearchAnime queries the Jikan API by title and returns the first match.
func (c *Client) SearchAnime(ctx context.Context, title string) (*AnimeSearchResponse, error) {
	escapedQuery := strings.ReplaceAll(url.QueryEscape(title), "+", "%20")
	reqUrl := fmt.Sprintf("https://api.jikan.moe/v4/anime?q=%s&limit=1", escapedQuery)

	var res AnimeSearchResponse
	if err := c.executeRequest(ctx, reqUrl, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

// GetAnimeEpisodes fetches all episodes for a specific MAL ID, handling pagination.
func (c *Client) GetAnimeEpisodes(ctx context.Context, malID int) (*AnimeEpisodesResponse, error) {
	var fullRes AnimeEpisodesResponse
	page := 1

	for {
		reqUrl := fmt.Sprintf("https://api.jikan.moe/v4/anime/%d/episodes?page=%d", malID, page)
		var res AnimeEpisodesResponse
		if err := c.executeRequest(ctx, reqUrl, &res); err != nil {
			return nil, err
		}

		fullRes.Data = append(fullRes.Data, res.Data...)

		if !res.Pagination.HasNextPage {
			break
		}
		page++
	}

	return &fullRes, nil
}

// SearchAnimeAdvanced queries the Jikan API by title with limit and pagination.
func (c *Client) SearchAnimeAdvanced(ctx context.Context, query string, page int, limit int) (*AnimeSearchResponse, error) {
	escapedQuery := strings.ReplaceAll(url.QueryEscape(query), "+", "%20")
	reqUrl := fmt.Sprintf("https://api.jikan.moe/v4/anime?q=%s&page=%d&limit=%d", escapedQuery, page, limit)

	var res AnimeSearchResponse
	if err := c.executeRequest(ctx, reqUrl, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

// GetAnimeFull fetches the complete details of an anime by MAL ID.
func (c *Client) GetAnimeFull(ctx context.Context, malID int) (*AnimeFullResponse, error) {
	reqUrl := fmt.Sprintf("https://api.jikan.moe/v4/anime/%d/full", malID)
	var res AnimeFullResponse
	if err := c.executeRequest(ctx, reqUrl, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

// GetAnimeCharacters fetches the characters of an anime by MAL ID.
func (c *Client) GetAnimeCharacters(ctx context.Context, malID int) (*AnimeCharactersResponse, error) {
	reqUrl := fmt.Sprintf("https://api.jikan.moe/v4/anime/%d/characters", malID)
	var res AnimeCharactersResponse
	if err := c.executeRequest(ctx, reqUrl, &res); err != nil {
		return nil, err
	}
	return &res, nil
}
