package tmdb

import (
	"context"
	"fmt"
	"net/url"
	"strings"
)

// GetTVSeason fetches the details of a specific TV season, including its episodes.
func (c *Client) GetTVSeason(ctx context.Context, tvID int, seasonNumber int) (TVSeasonDetails, error) {
	cacheKey := fmt.Sprintf("tv_season:%d:%d:%s", tvID, seasonNumber, c.language)
	if cached, ok := c.cache.Load(cacheKey); ok {
		return cached.(TVSeasonDetails), nil
	}

	params := url.Values{}
	params.Set("language", c.language)

	resp, err := executeWithRetry[TVSeasonDetails](ctx, c, fmt.Sprintf("/tv/%d/season/%d?%s", tvID, seasonNumber, params.Encode()))
	if err != nil {
		return TVSeasonDetails{}, fmt.Errorf("tmdb get tv season: %w", err)
	}

	if strings.HasPrefix(c.language, "es") {
		needsFallback := resp.Overview == "" || resp.Name == ""
		if !needsFallback {
			for _, ep := range resp.Episodes {
				if ep.Overview == "" || ep.Name == "" {
					needsFallback = true
					break
				}
			}
		}
		if needsFallback {
			fallbackParams := url.Values{}
			fallbackParams.Set("language", "en-US")
			if fallbackResp, err := executeWithRetry[TVSeasonDetails](ctx, c, fmt.Sprintf("/tv/%d/season/%d?%s", tvID, seasonNumber, fallbackParams.Encode())); err == nil {
				if resp.Overview == "" { resp.Overview = fallbackResp.Overview }
				if resp.Name == "" { resp.Name = fallbackResp.Name }
				for i, ep := range resp.Episodes {
					if ep.Overview == "" || ep.Name == "" {
						for _, fEp := range fallbackResp.Episodes {
							if ep.EpisodeNumber == fEp.EpisodeNumber {
								if ep.Overview == "" { resp.Episodes[i].Overview = fEp.Overview }
								if ep.Name == "" { resp.Episodes[i].Name = fEp.Name }
								break
							}
						}
					}
				}
			}
		}
	}

	c.cache.Store(cacheKey, *resp)
	return *resp, nil
}

// GetTVDetails fetches a specific TV show by ID with full details.
func (c *Client) GetTVDetails(ctx context.Context, id string) (*TVDetails, error) {
	cacheKey := fmt.Sprintf("tv_detail_full:%s:%s", id, c.language)
	if cached, ok := c.cache.Load(cacheKey); ok {
		return cached.(*TVDetails), nil
	}

	params := url.Values{}
	params.Set("language", c.language)

	resp, err := executeWithRetry[TVDetails](ctx, c, fmt.Sprintf("/tv/%s?%s", id, params.Encode()))
	if err != nil {
		return nil, fmt.Errorf("tmdb get tv details: %w", err)
	}

	if strings.HasPrefix(c.language, "es") && (resp.Overview == "" || resp.Name == "") {
		fallbackParams := url.Values{}
		fallbackParams.Set("language", "en-US")
		if fallbackResp, err := executeWithRetry[TVDetails](ctx, c, fmt.Sprintf("/tv/%s?%s", id, fallbackParams.Encode())); err == nil {
			if resp.Overview == "" {
				resp.Overview = fallbackResp.Overview
			}
			if resp.Name == "" {
				resp.Name = fallbackResp.Name
			}
		}
	}

	c.cache.Store(cacheKey, resp)
	return resp, nil
}

// GetTVAlternativeTitles gets all alternative titles for a TV show.
func (c *Client) GetTVAlternativeTitles(ctx context.Context, tvID int) ([]AlternativeTitle, error) {
	cacheKey := fmt.Sprintf("tv_alt:%d", tvID)
	if cached, ok := c.cache.Load(cacheKey); ok {
		return cached.([]AlternativeTitle), nil
	}

	params := url.Values{}

	resp, err := executeWithRetry[AlternativeTitlesResponse](ctx, c, fmt.Sprintf("/tv/%d/alternative_titles?%s", tvID, params.Encode()))
	if err != nil {
		return nil, fmt.Errorf("tmdb get tv alternative titles: %w", err)
	}

	c.cache.Store(cacheKey, resp.Results)
	return resp.Results, nil
}

// GetTVExternalIDs fetches the external IDs (TVDB, IMDb, etc.) for a TV show.
func (c *Client) GetTVExternalIDs(ctx context.Context, tvID int) (*ExternalIDs, error) {
	cacheKey := fmt.Sprintf("tv_external_ids:%d", tvID)
	if cached, ok := c.cache.Load(cacheKey); ok {
		return cached.(*ExternalIDs), nil
	}

	resp, err := executeWithRetry[ExternalIDs](ctx, c, fmt.Sprintf("/tv/%d/external_ids", tvID))
	if err != nil {
		return nil, fmt.Errorf("tmdb get tv external ids: %w", err)
	}

	c.cache.Store(cacheKey, resp)
	return resp, nil
}

// GetEpisodeGroups fetches the episode groups (story arcs/sagas) for a TV show.
func (c *Client) GetEpisodeGroups(ctx context.Context, tvID int) ([]EpisodeGroup, error) {
	cacheKey := fmt.Sprintf("episode_groups:%d:%s", tvID, c.language)
	if cached, ok := c.cache.Load(cacheKey); ok {
		return cached.([]EpisodeGroup), nil
	}

	params := url.Values{}
	params.Set("language", c.language)

	resp, err := executeWithRetry[EpisodeGroupResponse](ctx, c, fmt.Sprintf("/tv/%d/episode_groups?%s", tvID, params.Encode()))
	if err != nil {
		return nil, fmt.Errorf("tmdb get episode groups: %w", err)
	}

	c.cache.Store(cacheKey, resp.Groups)
	return resp.Groups, nil
}

// fetchTVDetails fetches full TV details from TMDB
func (c *Client) fetchTVDetails(ctx context.Context, tvID int) (TVDetails, error) {
	cacheKey := fmt.Sprintf("tv_full:%d:%s", tvID, c.language)
	if cached, ok := c.cache.Load(cacheKey); ok {
		return cached.(TVDetails), nil
	}

	params := url.Values{}
	params.Set("language", c.language)

	resp, err := executeWithRetry[TVDetails](ctx, c, fmt.Sprintf("/tv/%d?%s", tvID, params.Encode()))
	if err != nil {
		return TVDetails{}, fmt.Errorf("tmdb fetch tv details: %w", err)
	}

	c.cache.Store(cacheKey, *resp)
	return *resp, nil
}

// AbsoluteToStandardMapping maps an absolute episode number to TMDB's standard (Season, Episode) format.
// It iterates through all seasons to find which season contains the given absolute episode.
func (c *Client) AbsoluteToStandardMapping(ctx context.Context, tvID int, absoluteEpisode int) (season int, episode int, err error) {
	// Use TVDetails endpoint to get the full info with number of seasons
	details, err := c.fetchTVDetails(ctx, tvID)
	if err != nil {
		return 0, 0, err
	}

	if details.NumberOfEpisodes == 0 || absoluteEpisode <= 0 {
		return 0, 0, fmt.Errorf("invalid absolute episode: %d", absoluteEpisode)
	}

	// Iterate through seasons to find the correct season and episode
	accumulatedEpisodes := 0
	for seasonNum := 1; seasonNum <= details.NumberOfSeasons; seasonNum++ {
		seasonDetails, err := c.GetTVSeason(ctx, tvID, seasonNum)
		if err != nil {
			continue // Skip seasons that fail
		}

		seasonEpisodeCount := len(seasonDetails.Episodes)
		if seasonEpisodeCount == 0 {
			continue
		}

		// Check if the absolute episode falls within this season's range
		if absoluteEpisode <= accumulatedEpisodes+seasonEpisodeCount {
			return seasonNum, absoluteEpisode - accumulatedEpisodes, nil
		}
		accumulatedEpisodes += seasonEpisodeCount
	}

	// If not found in regular seasons, check for specials (season 0)
	specials, err := c.GetTVSeason(ctx, tvID, 0)
	if err == nil && len(specials.Episodes) > 0 {
		if absoluteEpisode <= accumulatedEpisodes+len(specials.Episodes) {
			return 0, absoluteEpisode - accumulatedEpisodes, nil
		}
	}

	return 0, 0, fmt.Errorf("absolute episode %d exceeds total episodes %d", absoluteEpisode, details.NumberOfEpisodes)
}
