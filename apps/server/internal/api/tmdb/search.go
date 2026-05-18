package tmdb

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"time"
)

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
	var allResults []SearchResult
	for p := 1; p <= 5; p++ {
		params.Set("page", fmt.Sprintf("%d", p))

		type Response struct {
			Results []SearchResult `json:"results"`
		}

		resp, err := executeWithRetry[Response](ctx, c, "/search/tv?"+params.Encode())
		if err != nil {
			return nil, err
		}

		allResults = append(allResults, resp.Results...)
		if len(resp.Results) < 20 {
			break
		}
	}

	var animationResults []SearchResult
	var otherResults []SearchResult
	for _, r := range allResults {
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

	// Rank animation results first, but keep others
	results := append(animationResults, otherResults...)

	// Limit to top 100 results
	if len(results) > 100 {
		results = results[:100]
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

	var allResults []SearchResult
	for p := 1; p <= 5; p++ {
		params.Set("page", fmt.Sprintf("%d", p))

		type Response struct {
			Results []SearchResult `json:"results"`
		}

		resp, err := executeWithRetry[Response](ctx, c, "/search/movie?"+params.Encode())
		if err != nil {
			return nil, err
		}

		allResults = append(allResults, resp.Results...)
		if len(resp.Results) < 20 {
			break
		}
	}

	var animationResults []SearchResult
	var otherResults []SearchResult
	for _, r := range allResults {
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

	// Rank animation results first, but keep others
	results := append(animationResults, otherResults...)

	// Limit to top 100 results
	if len(results) > 100 {
		results = results[:100]
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
