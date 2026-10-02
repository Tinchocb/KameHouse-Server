package tmdb

import (
	"context"
	"fmt"
	"net/url"
	"time"
)

// SearchTV searches for anime TV shows on TMDb.
// It filters results to animation genre (16) and Japanese origin when possible.
func (c *Client) SearchTV(ctx context.Context, query string) ([]SearchResult, error) {
	// Check cache
	if cached, ok := GetCached[[]SearchResult](c, "tv:"+query); ok {
		return cached, nil
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

	SetCached(c, "tv:"+query, results, 7*24*time.Hour)
	return results, nil
}

// SearchMovie searches for anime movies on TMDb.
func (c *Client) SearchMovie(ctx context.Context, query string) ([]SearchResult, error) {
	// Check cache
	if cached, ok := GetCached[[]SearchResult](c, "movie:"+query); ok {
		return cached, nil
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

	SetCached(c, "movie:"+query, results, 7*24*time.Hour)
	return results, nil
}
