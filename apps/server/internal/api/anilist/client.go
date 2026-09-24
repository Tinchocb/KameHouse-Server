package anilist

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	httputil "kamehouse/internal/util/http"
	"github.com/rs/zerolog"
	"golang.org/x/time/rate"
)

const graphQLEndpoint = "https://graphql.anilist.co"

// Client handles AniList public GraphQL queries.
type Client struct {
	logger     *zerolog.Logger
	httpClient *http.Client
	limiter    *rate.Limiter
	cache      sync.Map
}

// NewClient creates a new AniList GraphQL client with rate limiting (90 req/min).
func NewClient(logger *zerolog.Logger) *Client {
	return &Client{
		logger:     logger,
		httpClient: httputil.NewFastClient(),
		limiter:    rate.NewLimiter(rate.Every(time.Minute/90), 10),
	}
}

type graphQLRequest struct {
	Query     string                 `json:"query"`
	Variables map[string]interface{} `json:"variables"`
}

type MediaTitle struct {
	Romaji  string `json:"romaji"`
	English string `json:"english"`
	Native  string `json:"native"`
}

type MediaCoverImage struct {
	ExtraLarge string `json:"extraLarge"`
	Large      string `json:"large"`
	Medium     string `json:"medium"`
	Color      string `json:"color"`
}

type CharacterNode struct {
	ID   int `json:"id"`
	Name struct {
		Full   string `json:"full"`
		Native string `json:"native"`
	} `json:"name"`
	Image struct {
		Large  string `json:"large"`
		Medium string `json:"medium"`
	} `json:"image"`
}

type CharacterEdge struct {
	Role string        `json:"role"`
	Node CharacterNode `json:"node"`
}

type CharacterConnection struct {
	Edges []CharacterEdge `json:"edges"`
}

type MediaRelationEdge struct {
	RelationType string `json:"relationType"`
	Node         struct {
		ID     int        `json:"id"`
		Title  MediaTitle `json:"title"`
		Format string     `json:"format"`
		Type   string     `json:"type"`
	} `json:"node"`
}

type RelationConnection struct {
	Edges []MediaRelationEdge `json:"edges"`
}

type StreamingEpisode struct {
	Title     string `json:"title"`
	Thumbnail string `json:"thumbnail"`
	URL       string `json:"url"`
	Site      string `json:"site"`
}

type AniListMedia struct {
	ID                int                 `json:"id"`
	IDMal             int                 `json:"idMal"`
	Title             MediaTitle          `json:"title"`
	Format            string              `json:"format"`
	Status            string              `json:"status"`
	Description       string              `json:"description"`
	SeasonYear        int                 `json:"seasonYear"`
	Episodes          int                 `json:"episodes"`
	Duration          int                 `json:"duration"`
	AverageScore      int                 `json:"averageScore"`
	MeanScore         int                 `json:"meanScore"`
	Genres            []string            `json:"genres"`
	BannerImage       string              `json:"bannerImage"`
	CoverImage        MediaCoverImage     `json:"coverImage"`
	Characters        CharacterConnection `json:"characters"`
	Relations         RelationConnection  `json:"relations"`
	SiteURL           string              `json:"siteUrl"`
	StreamingEpisodes []StreamingEpisode  `json:"streamingEpisodes"`
}

type mediaResponse struct {
	Data struct {
		Media *AniListMedia `json:"Media"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
		Status  int    `json:"status"`
	} `json:"errors"`
}

type pageSearchResponse struct {
	Data struct {
		Page struct {
			Media []AniListMedia `json:"media"`
		} `json:"Page"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
		Status  int    `json:"status"`
	} `json:"errors"`
}

const mediaQuery = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    idMal
    title {
      romaji
      english
      native
    }
    format
    status
    description(asHtml: false)
    seasonYear
    episodes
    duration
    averageScore
    meanScore
    genres
    bannerImage
    coverImage {
      extraLarge
      large
      medium
      color
    }
    characters(sort: ROLE, perPage: 15) {
      edges {
        role
        node {
          id
          name {
            full
            native
          }
          image {
            large
            medium
          }
        }
      }
    }
    relations {
      edges {
        relationType
        node {
          id
          title {
            romaji
            english
          }
          format
          type
        }
      }
    }
    siteUrl
    streamingEpisodes {
      title
      thumbnail
      url
      site
    }
  }
}
`

const searchQuery = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id
      idMal
      title {
        romaji
        english
        native
      }
      format
      status
      description(asHtml: false)
      seasonYear
      episodes
      duration
      averageScore
      meanScore
      genres
      bannerImage
      coverImage {
        extraLarge
        large
        medium
        color
      }
      siteUrl
    }
  }
}
`

// GetMediaByID fetches complete anime metadata by AniList ID.
func (c *Client) GetMediaByID(ctx context.Context, id int) (*AniListMedia, error) {
	cacheKey := fmt.Sprintf("id:%d", id)
	if cached, ok := c.cache.Load(cacheKey); ok {
		return cached.(*AniListMedia), nil
	}

	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	vars := map[string]interface{}{"id": id}
	payload, err := json.Marshal(graphQLRequest{
		Query:     mediaQuery,
		Variables: vars,
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, graphQLEndpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("anilist request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("anilist status %d", resp.StatusCode)
	}

	var res mediaResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, fmt.Errorf("anilist decode error: %w", err)
	}

	if len(res.Errors) > 0 {
		return nil, fmt.Errorf("anilist graphql error: %s", res.Errors[0].Message)
	}

	if res.Data.Media == nil {
		return nil, fmt.Errorf("anilist media %d not found", id)
	}

	c.cache.Store(cacheKey, res.Data.Media)
	return res.Data.Media, nil
}

// GetEpisodeThumbnail returns the streaming thumbnail for an absolute episode number (1-based).
// AniList lists streamingEpisodes in order, so index = absolute-1. Returns an error when
// the series has no streaming data or the episode is out of range (caller should fall back).
func (c *Client) GetEpisodeThumbnail(ctx context.Context, id int, absoluteEpisode int) (StreamingEpisode, error) {
	if absoluteEpisode <= 0 {
		return StreamingEpisode{}, fmt.Errorf("invalid absolute episode: %d", absoluteEpisode)
	}
	media, err := c.GetMediaByID(ctx, id)
	if err != nil {
		return StreamingEpisode{}, err
	}
	if len(media.StreamingEpisodes) == 0 {
		return StreamingEpisode{}, fmt.Errorf("anilist media %d has no streaming episodes", id)
	}
	if absoluteEpisode > len(media.StreamingEpisodes) {
		return StreamingEpisode{}, fmt.Errorf("absolute episode %d exceeds streaming count %d", absoluteEpisode, len(media.StreamingEpisodes))
	}
	return media.StreamingEpisodes[absoluteEpisode-1], nil
}

// SearchAnime searches for anime by title on AniList.
func (c *Client) SearchAnime(ctx context.Context, query string, page, perPage int) ([]AniListMedia, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}

	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 50 {
		perPage = 20
	}

	vars := map[string]interface{}{
		"search":  query,
		"page":    page,
		"perPage": perPage,
	}
	payload, err := json.Marshal(graphQLRequest{
		Query:     searchQuery,
		Variables: vars,
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, graphQLEndpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("anilist search failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("anilist search status %d", resp.StatusCode)
	}

	var res pageSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, fmt.Errorf("anilist decode error: %w", err)
	}

	if len(res.Errors) > 0 {
		return nil, fmt.Errorf("anilist graphql error: %s", res.Errors[0].Message)
	}

	return res.Data.Page.Media, nil
}
