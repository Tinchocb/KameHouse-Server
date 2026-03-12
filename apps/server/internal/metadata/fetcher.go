package metadata

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

// MediaMetadata represents the normalized output from AniList or TMDB scraping.
type MediaMetadata struct {
	Title         string
	Synopsis      string
	PosterURL     string
	BackgroundURL string
	Score         int
	Year          int
}

// Fetcher wraps an HTTP client and a thread-safe cache to scrape media data efficiently.
type Fetcher struct {
	httpClient *http.Client
	cache      map[string]MediaMetadata
	mu         sync.RWMutex
	logger     *zerolog.Logger
}

// NewFetcher constructs a new Metadata Fetcher with a 5-second HTTP timeout boundary.
func NewFetcher(logger *zerolog.Logger) *Fetcher {
	return &Fetcher{
		httpClient: &http.Client{Timeout: 5 * time.Second},
		cache:      make(map[string]MediaMetadata),
		logger:     logger,
	}
}

// Search queries an external API (AniList Graphql representation mocked via TMDB/REST for simplicity here) 
// using the clean title. Returns cached metadata if present to avoid rate-limiting.
func (f *Fetcher) Search(title string) (MediaMetadata, error) {
	// 1. Thread-safe cached read
	f.mu.RLock()
	cached, exists := f.cache[title]
	f.mu.RUnlock()

	if exists {
		f.logger.Debug().Str("title", title).Msg("fetcher: Cache hit")
		return cached, nil
	}

	f.logger.Debug().Str("title", title).Msg("fetcher: API search")

	// 2. Perform HTTP lookup (AniList GraphQL example. Adjusted payload structure omitted for brevity)
	// We use the AniList GraphQL HTTP endpoint for Anime metadata resolution as standard for KameHouse.
	query := `query ($search: String) {
		Media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
			title { romaji english }
			description
			coverImage { large extraLarge }
			bannerImage
			averageScore
			seasonYear
		}
	}`

	variables := map[string]interface{}{"search": title}
	payload := map[string]interface{}{"query": query, "variables": variables}
	
	// Convert payload to JSON
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return MediaMetadata{}, err
	}

	req, err := http.NewRequest("POST", "https://graphql.anilist.co", strings.NewReader(string(jsonPayload)))
	if err != nil {
		return MediaMetadata{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := f.httpClient.Do(req)
	if err != nil {
		return MediaMetadata{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return MediaMetadata{}, fmt.Errorf("API failed with status %d", resp.StatusCode)
	}

	var response struct {
		Data struct {
			Media struct {
				Title struct {
					Romaji  string `json:"romaji"`
					English string `json:"english"`
				} `json:"title"`
				Description  string `json:"description"`
				CoverImage   struct {
					Large      string `json:"large"`
					ExtraLarge string `json:"extraLarge"`
				} `json:"coverImage"`
				BannerImage  string `json:"bannerImage"`
				AverageScore int    `json:"averageScore"`
				SeasonYear   int    `json:"seasonYear"`
			} `json:"Media"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return MediaMetadata{}, err
	}

	media := response.Data.Media
	resolvedTitle := media.Title.English
	if resolvedTitle == "" {
		resolvedTitle = media.Title.Romaji
	}

	poster := media.CoverImage.ExtraLarge
	if poster == "" {
		poster = media.CoverImage.Large
	}

	metadata := MediaMetadata{
		Title:         resolvedTitle,
		Synopsis:      media.Description,
		PosterURL:     poster,
		BackgroundURL: media.BannerImage,
		Score:         media.AverageScore,
		Year:          media.SeasonYear,
	}

	// 3. Thread-safe cached write
	f.mu.Lock()
	f.cache[title] = metadata
	f.mu.Unlock()

	return metadata, nil
}
