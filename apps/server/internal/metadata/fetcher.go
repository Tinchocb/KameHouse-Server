package metadata

import (
	"context"
	"fmt"
	"kamehouse/internal/api/tmdb"
	"sync"

	"github.com/rs/zerolog"
)

// MediaMetadata represents the normalized output from TMDB search.
type MediaMetadata struct {
	ID            int
	Title         string
	Synopsis      string
	PosterURL     string
	BackgroundURL string
	Score         float64
	Year          int
	MediaType     string // "movie" or "tv"
}

// Fetcher wraps a TMDB client and a thread-safe cache to find media data efficiently.
type Fetcher struct {
	tmdbClient *tmdb.Client
	cache      map[string]MediaMetadata
	mu         sync.RWMutex
	logger     *zerolog.Logger
}

// NewFetcher constructs a new Metadata Fetcher with a TMDB client.
func NewFetcher(tmdbClient *tmdb.Client, logger *zerolog.Logger) *Fetcher {
	return &Fetcher{
		tmdbClient: tmdbClient,
		cache:      make(map[string]MediaMetadata),
		logger:     logger,
	}
}

// Search queries TMDB using the clean title. Returns cached metadata if present.
func (f *Fetcher) Search(title string) (MediaMetadata, error) {
	// 1. Thread-safe cached read
	f.mu.RLock()
	cached, exists := f.cache[title]
	f.mu.RUnlock()

	if exists {
		f.logger.Debug().Str("title", title).Msg("fetcher: Cache hit")
		return cached, nil
	}

	f.logger.Debug().Str("title", title).Msg("fetcher: TMDB search")

	// 2. Perform TMDB lookup
	// We'll search TV first, then Movie as a heuristic for KameHouse typical use cases.
	// For a truer multi-search, the TMDB client would need a MultiSearch method.
	// Since tmdb.go has SearchTV and SearchMovie, we'll try them sequentially.
	
	results, err := f.tmdbClient.SearchTV(context.Background(), title)
	mediaType := "tv"
	if err != nil || len(results) == 0 {
		results, err = f.tmdbClient.SearchMovie(context.Background(), title)
		mediaType = "movie"
	}
	
	if err != nil {
		return MediaMetadata{}, err
	}
	
	if len(results) == 0 {
		return MediaMetadata{}, fmt.Errorf("no results found on TMDB for: %s", title)
	}

	res := results[0]
	
	resolvedTitle := res.Name
	if resolvedTitle == "" {
		resolvedTitle = res.Title
	}

	poster := ""
	if res.PosterPath != "" {
		poster = "https://image.tmdb.org/t/p/w500" + res.PosterPath
	}
	
	background := ""
	if res.BackdropPath != "" {
		background = "https://image.tmdb.org/t/p/original" + res.BackdropPath
	}

	year := 0
	dateStr := res.FirstAirDate
	if dateStr == "" {
		dateStr = res.ReleaseDate
	}
	if len(dateStr) >= 4 {
		fmt.Sscanf(dateStr[:4], "%d", &year)
	}

	metadata := MediaMetadata{
		ID:            res.ID,
		Title:         resolvedTitle,
		Synopsis:      res.Overview,
		PosterURL:     poster,
		BackgroundURL: background,
		Score:         0, // Score not directly in SearchResult in current tmdb.go
		Year:          year,
		MediaType:     mediaType,
	}

	// 3. Thread-safe cached write
	f.mu.Lock()
	f.cache[title] = metadata
	f.mu.Unlock()

	return metadata, nil
}
