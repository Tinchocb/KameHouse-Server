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

// GetMovieDetailsV2 fetches detailed info about a movie, including its franchise collection.
func (c *Client) GetMovieDetailsV2(ctx context.Context, id int) (MovieDetails, error) {
	cacheKey := fmt.Sprintf("movie_detail_v2:%d:%s", id, c.language)
	if cached, ok := GetCached[MovieDetails](c, cacheKey); ok {
		return cached, nil
	}

	params := url.Values{}
	params.Set("language", c.language)

	resp, err := executeWithRetry[MovieDetails](ctx, c, fmt.Sprintf("/movie/%d?%s", id, params.Encode()))
	if err != nil {
		return MovieDetails{}, fmt.Errorf("tmdb get movie details v2: %w", err)
	}

	SetCached(c, cacheKey, *resp, 7*24*time.Hour)
	return *resp, nil
}

// GetCollection fetches a TMDB franchise/saga collection by its collection ID.
func (c *Client) GetCollection(ctx context.Context, collectionID int) (CollectionDetails, error) {
	cacheKey := fmt.Sprintf("collection:%d:%s", collectionID, c.language)
	if cached, ok := GetCached[CollectionDetails](c, cacheKey); ok {
		return cached, nil
	}

	params := url.Values{}
	params.Set("language", c.language)

	resp, err := executeWithRetry[CollectionDetails](ctx, c, fmt.Sprintf("/collection/%d?%s", collectionID, params.Encode()))
	if err != nil {
		return CollectionDetails{}, fmt.Errorf("tmdb get collection: %w", err)
	}

	SetCached(c, cacheKey, *resp, 7*24*time.Hour)
	return *resp, nil
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

// FindByExternalID resolves a title from an external ID (e.g. TVDB, IMDb) using TMDb's /find endpoint.
// This is free (uses existing TMDb key) and avoids the need for a paid TVDB v4 subscription.
//
// Example:
//
//	results, err := client.FindByExternalID(ctx, "81189", ExternalSourceTvdb)
func (c *Client) FindByExternalID(ctx context.Context, externalID string, source ExternalIDSource) (*FindResponse, error) {
	cacheKey := fmt.Sprintf("find:%s:%s", source, externalID)
	if cached, ok := GetCached[FindResponse](c, cacheKey); ok {
		return &cached, nil
	}

	params := url.Values{}
	params.Set("external_source", string(source))
	params.Set("language", c.language)

	resp, err := executeWithRetry[FindResponse](ctx, c, fmt.Sprintf("/find/%s?%s", externalID, params.Encode()))
	if err != nil {
		return nil, fmt.Errorf("tmdb find by external id (%s=%s): %w", source, externalID, err)
	}

	SetCached(c, cacheKey, *resp, 7*24*time.Hour)
	return resp, nil
}
