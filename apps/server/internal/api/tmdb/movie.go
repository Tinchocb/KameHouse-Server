package tmdb

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"
)

// GetMovieDetails fetches a specific Movie by ID with full details.
func (c *Client) GetMovieDetails(ctx context.Context, id string) (*MovieDetails, error) {
	cacheKey := fmt.Sprintf("movie_detail_full:%s:%s", id, c.language)
	if cached, ok := GetCached[*MovieDetails](c, cacheKey); ok {
		return cached, nil
	}

	params := url.Values{}
	params.Set("language", c.language)

	resp, err := executeWithRetry[MovieDetails](ctx, c, fmt.Sprintf("/movie/%s?%s", id, params.Encode()))
	if err != nil {
		return nil, fmt.Errorf("tmdb get movie details: %w", err)
	}

	if strings.HasPrefix(c.language, "es") && (resp.Overview == "" || resp.Title == "") {
		fallbackParams := url.Values{}
		fallbackParams.Set("language", "en-US")
		if fallbackResp, err := executeWithRetry[MovieDetails](ctx, c, fmt.Sprintf("/movie/%s?%s", id, fallbackParams.Encode())); err == nil {
			if resp.Overview == "" {
				resp.Overview = fallbackResp.Overview
			}
			if resp.Title == "" {
				resp.Title = fallbackResp.Title
			}
		}
	}

	SetCached(c, cacheKey, resp, 7*24*time.Hour)
	return resp, nil
}

// GetMovieAlternativeTitles gets all alternative titles for a movie.
func (c *Client) GetMovieAlternativeTitles(ctx context.Context, movieID int) ([]AlternativeTitle, error) {
	cacheKey := fmt.Sprintf("movie_alt:%d", movieID)
	if cached, ok := GetCached[[]AlternativeTitle](c, cacheKey); ok {
		return cached, nil
	}

	params := url.Values{}

	resp, err := executeWithRetry[AlternativeTitlesResponse](ctx, c, fmt.Sprintf("/movie/%d/alternative_titles?%s", movieID, params.Encode()))
	if err != nil {
		return nil, fmt.Errorf("tmdb get movie alternative titles: %w", err)
	}

	SetCached(c, cacheKey, resp.Results, 7*24*time.Hour)
	return resp.Results, nil
}
