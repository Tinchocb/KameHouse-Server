package jikan

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"golang.org/x/time/rate"
	httputil "kamehouse/internal/util/http"
)

// ErrUnavailable indica que Jikan no respondió tras agotar los reintentos
// (caída, 5xx o rate limit persistente), a diferencia de un "no encontrado".
var ErrUnavailable = errors.New("jikan: servicio no disponible")

// DefaultBaseURL es la API pública de Jikan v4.
const DefaultBaseURL = "https://api.jikan.moe/v4"

type Client struct {
	logger     *zerolog.Logger
	httpClient *http.Client
	limiter    *rate.Limiter
	// baseURL permite apuntar a un servidor de prueba (tests); por defecto, DefaultBaseURL.
	baseURL string
}

func NewClient(logger *zerolog.Logger) *Client {
	return &Client{
		logger:     logger,
		httpClient: httputil.NewFastClient(),
		// Jikan has a rate limit of 3 requests per second, 60 requests per minute.
		// We set a conservative 2 req/s with burst of 3.
		limiter: rate.NewLimiter(rate.Limit(2), 3),
		baseURL: DefaultBaseURL,
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
		Synopsis string  `json:"synopsis"`
		Episodes int     `json:"episodes"`
		Status   string  `json:"status"`
		Duration string  `json:"duration"`
		Rating   string  `json:"rating"`
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
			MalID  int    `json:"mal_id"`
			Name   string `json:"name"`
			Images struct {
				Jpg struct {
					ImageUrl string `json:"image_url"`
				} `json:"jpg"`
			} `json:"images"`
		} `json:"character"`
		Role string `json:"role"`
	} `json:"data"`
}

// Límites de intentos por tipo de fallo. Un 5xx de Jikan casi siempre es su
// upstream (MyAnimeList) caído: reintentar más solo alarga la espera del usuario.
const (
	maxAttempts            = 3 // errores de red y 429 (rate limit): vale la pena esperar
	maxServerErrorAttempts = 2 // 5xx
)

func (c *Client) executeRequest(ctx context.Context, reqURL string, target interface{}) error {
	var lastErr error

	for attempt := 0; ; attempt++ {
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

		limit := maxAttempts
		resp, err := c.httpClient.Do(req)
		switch {
		case err != nil:
			lastErr = err
		case resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500:
			resp.Body.Close()
			lastErr = fmt.Errorf("http status: %d", resp.StatusCode)
			if resp.StatusCode >= 500 {
				limit = maxServerErrorAttempts
			}
		case resp.StatusCode != http.StatusOK:
			resp.Body.Close()
			return fmt.Errorf("jikan api returned status %d", resp.StatusCode)
		default:
			err = json.NewDecoder(resp.Body).Decode(target)
			resp.Body.Close()
			return err
		}

		// Sin espera después del último intento: antes se dormía el backoff
		// completo (4 s) y recién ahí se devolvía el error.
		if attempt+1 >= limit {
			return fmt.Errorf("%w: request failed after %d attempts: %w", ErrUnavailable, attempt+1, lastErr)
		}
		if !c.sleepBackoff(ctx, attempt) {
			return ctx.Err()
		}
	}
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
	reqUrl := fmt.Sprintf("%s/anime?q=%s&limit=1", c.baseURL, escapedQuery)

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
		reqUrl := fmt.Sprintf("%s/anime/%d/episodes?page=%d", c.baseURL, malID, page)
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
	reqUrl := fmt.Sprintf("%s/anime?q=%s&page=%d&limit=%d", c.baseURL, escapedQuery, page, limit)

	var res AnimeSearchResponse
	if err := c.executeRequest(ctx, reqUrl, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

// GetAnimeFull fetches the complete details of an anime by MAL ID.
func (c *Client) GetAnimeFull(ctx context.Context, malID int) (*AnimeFullResponse, error) {
	reqUrl := fmt.Sprintf("%s/anime/%d/full", c.baseURL, malID)
	var res AnimeFullResponse
	if err := c.executeRequest(ctx, reqUrl, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

// GetAnimeCharacters fetches the characters of an anime by MAL ID.
func (c *Client) GetAnimeCharacters(ctx context.Context, malID int) (*AnimeCharactersResponse, error) {
	reqUrl := fmt.Sprintf("%s/anime/%d/characters", c.baseURL, malID)
	var res AnimeCharactersResponse
	if err := c.executeRequest(ctx, reqUrl, &res); err != nil {
		return nil, err
	}
	return &res, nil
}
