package anilist

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	httputil "kamehouse/internal/util/http"
	"github.com/rs/zerolog"
)

type Client struct {
	logger     *zerolog.Logger
	httpClient *http.Client
}

func NewClient(logger *zerolog.Logger) *Client {
	return &Client{
		logger:     logger,
		httpClient: httputil.NewFastClient(),
	}
}

// Structs for AniList GraphQL response
type GraphQLResponse struct {
	Data struct {
		Media *Media `json:"Media"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

type Media struct {
	ID    int `json:"id"`
	Title struct {
		Romaji  string `json:"romaji"`
		English string `json:"english"`
		Native  string `json:"native"`
	} `json:"title"`
	Description string `json:"description"`
	CoverImage  struct {
		ExtraLarge string `json:"extraLarge"`
	} `json:"coverImage"`
	BannerImage string `json:"bannerImage"`
	Format      string `json:"format"`
	Episodes    int    `json:"episodes"`
	StartDate   struct {
		Year  int `json:"year"`
		Month int `json:"month"`
		Day   int `json:"day"`
	} `json:"startDate"`
}

func (c *Client) SearchAnimeByTitle(ctx context.Context, title string) (*Media, error) {
	query := `
	query ($search: String) {
		Media (search: $search, type: ANIME, sort: SEARCH_MATCH) {
			id
			title {
				romaji
				english
				native
			}
			description
			coverImage {
				extraLarge
			}
			bannerImage
			format
			episodes
			startDate {
				year
				month
				day
			}
		}
	}`

	variables := map[string]interface{}{
		"search": title,
	}

	payload := map[string]interface{}{
		"query":     query,
		"variables": variables,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://graphql.anilist.co", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	// AniList rate limits: 90 req / minute. We should ideally respect this, but for simple searching it's fine.
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("anilist api returned status %d", resp.StatusCode)
	}

	var gqlResp GraphQLResponse
	if err := json.NewDecoder(resp.Body).Decode(&gqlResp); err != nil {
		return nil, err
	}

	if len(gqlResp.Errors) > 0 {
		return nil, fmt.Errorf("anilist graphql error: %s", gqlResp.Errors[0].Message)
	}

	if gqlResp.Data.Media == nil {
		return nil, fmt.Errorf("no anime found for title: %s", title)
	}

	return gqlResp.Data.Media, nil
}
