package metadata_provider

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"time"

	apiMetadata "kamehouse/internal/api/metadata"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/platforms/platform"

	"github.com/rs/zerolog"
)

// TMDBProviderImpl implements Provider using TMDB as the primary source
// for per-episode metadata (titles, thumbnails, overviews, air dates).
type TMDBProviderImpl struct {
	client *tmdb.Client
	db     *db.Database
	logger *zerolog.Logger

	mu          sync.Mutex
	cache       map[int]*tmdbCachedEntry
	seasonSlots chan struct{}
	publication sync.Mutex // invalidation and durable writes, independent of warm reads
	generation  uint64
	closed      bool
	workers     sync.WaitGroup
	ctx         context.Context
	cancel      context.CancelFunc
}

type tmdbCachedEntry struct {
	data      *apiMetadata.AnimeMetadata
	expiresAt time.Time
}

const tmdbMetadataTTL = 6 * time.Hour

// NewTMDBProviderImpl creates a new TMDB-backed metadata provider.
func NewTMDBProviderImpl(client *tmdb.Client, database *db.Database, logger *zerolog.Logger) *TMDBProviderImpl {
	ctx, cancel := context.WithCancel(context.Background())
	return &TMDBProviderImpl{
		ctx: ctx, cancel: cancel,
		client:      client,
		db:          database,
		logger:      logger,
		cache:       make(map[int]*tmdbCachedEntry),
		seasonSlots: make(chan struct{}, 4),
	}
}

// GetAnimeMetadata fetches full episode metadata for a media identified by its
// public library ID (movies use the public movie offset).
func (p *TMDBProviderImpl) GetAnimeMetadata(id int) (*apiMetadata.AnimeMetadata, error) {
	// 1. Check in-memory cache first
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return nil, context.Canceled
	}
	p.workers.Add(1)
	defer p.workers.Done()
	generation := p.generation
	if entry, ok := p.cache[id]; ok && time.Now().Before(entry.expiresAt) {
		p.mu.Unlock()
		if entry.data == nil {
			return nil, fmt.Errorf("tmdb_provider: cached metadata for ID %d is nil", id)
		}
		return entry.data, nil
	}
	p.mu.Unlock()

	if id <= 0 {
		return nil, fmt.Errorf("invalid public media ID %d", id)
	}
	tmdbID, isMovie := id, id >= 1_000_000
	if isMovie {
		tmdbID -= 1_000_000
	}
	if p.db != nil {
		m, err := db.ResolveLibraryMediaByPublicID(p.db, id)
		if err != nil {
			return nil, err
		}
		if m != nil {
			if m.TmdbID <= 0 {
				return nil, fmt.Errorf("media %d has no TMDB mapping", id)
			}
			tmdbID, isMovie = m.TmdbID, m.Type == "MOVIE"
		}
	}

	// 2. Check Database Persistent Cache
	if p.db != nil {
		var cachedData apiMetadata.AnimeMetadata
		found, err := db.GetMetadataCache(p.db, "tmdb-anime-episodes", p.metadataKey(id, tmdbID, isMovie), &cachedData)
		if err == nil && found {
			// Always re-apply enrichments to cached data to ensure local logic changes are reflected
			if !isMovie {
				p.applyEnrichments(tmdbID, &cachedData)
			}
			p.publishMetadata(generation, id, tmdbID, &cachedData, false, isMovie)

			return &cachedData, nil
		}
	}

	ctx, cancel := context.WithTimeout(p.ctx, 30*time.Second)
	defer cancel()
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	var episodes map[string]*apiMetadata.EpisodeMetadata
	var totalEpisodes, totalSpecials int
	var titles map[string]string
	var description string

	if isMovie {
		// --- MOVIE PATH ---
		movieDetails, err := p.client.GetMovieDetails(ctx, strconv.Itoa(tmdbID))
		if err != nil {
			return nil, fmt.Errorf("tmdb_provider: GetMovieDetails(%d): %w", tmdbID, err)
		}

		titles = buildTitleMapFromMovie(movieDetails)
		totalEpisodes = 1
		episodes = map[string]*apiMetadata.EpisodeMetadata{
			"1": {
				Title:    movieDetails.Title,
				Overview: movieDetails.Overview,
				Image:    "https://image.tmdb.org/t/p/original" + movieDetails.BackdropPath,
				AirDate:  movieDetails.ReleaseDate,
				Length:   0, // Movie details SearchResult doesn't have runtime
			},
		}
		description = movieDetails.Overview
	} else {
		// --- TV SHOW PATH ---
		// Fetch the TV show details to determine how many seasons exist.
		tvDetails, err := p.client.GetTVDetails(ctx, strconv.Itoa(tmdbID))
		if err != nil {
			return nil, fmt.Errorf("tmdb_provider: GetTVDetails(%d): %w", tmdbID, err)
		}

		titles = buildTitleMapFromTV(tvDetails)
		episodes = make(map[string]*apiMetadata.EpisodeMetadata)
		description = tvDetails.Overview

		// Fetch seasons 0 (specials) through NumberOfSeasons, tracking absolute episode counter
		maxSeasons := tvDetails.NumberOfSeasons
		if maxSeasons <= 0 {
			maxSeasons = 1
		}

		absEpCounter := 0 // running counter across seasons for the flat episode key
		for seasonNum, seasonDetails := range p.loadSeasons(ctx, tmdbID, maxSeasons) {
			if len(seasonDetails.Episodes) == 0 {
				if seasonNum > 1 {
					break
				}
				continue
			}

			for _, ep := range seasonDetails.Episodes {
				epMeta := tmdbEpisodeToMeta(ep, seasonNum)
				var key string
				if seasonNum == 0 {
					// Specials: use "S{n}" key so they don't collide with main episodes
					key = fmt.Sprintf("S%d", ep.EpisodeNumber)
					totalSpecials++
				} else {
					// Main episodes: use a flat absolute counter as the string key
					absEpCounter++
					key = strconv.Itoa(absEpCounter)
					epMeta.Episode = key // keep Episode field in sync with map key
					epMeta.AbsoluteEpisodeNumber = absEpCounter
					totalEpisodes++
				}
				episodes[key] = epMeta
			}
		}
	}

	if len(episodes) == 0 {
		return nil, fmt.Errorf("tmdb_provider: no episodes found for TMDB ID %d", tmdbID)
	}

	result := &apiMetadata.AnimeMetadata{
		Titles:       titles,
		Description:  description,
		Episodes:     episodes,
		EpisodeCount: totalEpisodes,
		SpecialCount: totalSpecials,
		Mappings:     &apiMetadata.AnimeMappings{},
	}

	// Apply Latin Spanish title overrides for Dragon Ball
	if !isMovie {
		p.applyEnrichments(tmdbID, result)
	}

	p.publishMetadata(generation, id, tmdbID, result, true, isMovie)

	if p.logger != nil {
		p.logger.Debug().
			Int("mediaID", id).
			Int("tmdbID", tmdbID).
			Int("episodes", totalEpisodes).
			Int("specials", totalSpecials).
			Msg("tmdb_provider: fetched episode metadata")
	}

	return result, nil
}

// Fetch at most four seasons concurrently across this provider. Results are
// consumed in season order, so absolute numbering and the first missing-season
// boundary remain identical to the sequential path. A failed season can cause
// speculative reads only within its current batch, never of the remaining show.
func (p *TMDBProviderImpl) loadSeasons(ctx context.Context, tmdbID, maxSeason int) []tmdb.TVSeasonDetails {
	const width = 4
	seasons := make([]tmdb.TVSeasonDetails, maxSeason+1)
	for start := 0; start <= maxSeason; start += width {
		if ctx.Err() != nil {
			break
		}
		end := min(start+width, maxSeason+1)
		var workers sync.WaitGroup
		for season := start; season < end; season++ {
			workers.Go(func() {
				if ctx.Err() != nil {
					return
				}
				select {
				case p.seasonSlots <- struct{}{}:
					defer func() { <-p.seasonSlots }()
				case <-ctx.Done():
					return
				}
				if ctx.Err() != nil {
					return
				}
				details, err := p.client.GetTVSeason(ctx, tmdbID, season)
				if err == nil {
					seasons[season] = details
				}
			})
		}
		workers.Wait()
		for season := start; season < end; season++ {
			if season > 1 && len(seasons[season].Episodes) == 0 {
				return seasons[:season+1]
			}
		}
		if ctx.Err() != nil {
			break
		}
	}
	return seasons
}

// GetAnimeMetadataWrapper returns a SimpleAnimeMetadataWrapper backed by the
// provided AnimeMetadata. This allows episode lookup by flat episode number key.
func (p *TMDBProviderImpl) GetAnimeMetadataWrapper(baseAnime *platform.UnifiedMedia, animeMetadata *apiMetadata.AnimeMetadata) AnimeMetadataWrapper {
	return NewSimpleAnimeMetadataWrapper(animeMetadata)
}

func (p *TMDBProviderImpl) ClearCache() {
	p.publication.Lock()
	defer p.publication.Unlock()
	p.mu.Lock()
	defer p.mu.Unlock()
	p.generation++
	p.cache = make(map[int]*tmdbCachedEntry)
}

func (p *TMDBProviderImpl) publishMetadata(generation uint64, id, tmdbID int, data *apiMetadata.AnimeMetadata, persist bool, movie ...bool) {
	p.publication.Lock()
	defer p.publication.Unlock()
	p.mu.Lock()
	if p.closed || generation != p.generation {
		p.mu.Unlock()
		return
	}
	p.cache[id] = &tmdbCachedEntry{data: data, expiresAt: time.Now().Add(tmdbMetadataTTL)}
	p.mu.Unlock()
	if persist && p.db != nil {
		// Use the same external TMDB key as the read path.
		_ = db.UpsertMetadataCache(p.db, "tmdb-anime-episodes", p.metadataKey(id, tmdbID, movie...), data, 7*24*time.Hour)
	}
}

func (p *TMDBProviderImpl) Close() error {
	p.mu.Lock()
	p.closed = true
	p.mu.Unlock()
	p.cancel()
	// The client's shared HTTP fetch may outlive cancellation; joining Get
	// also joins this provider's final cache writes before database teardown.
	p.workers.Wait()
	return nil
}

// ────────────────────────────────────────────────────────────────────────────

// tmdbEpisodeToMeta converts a TMDB TVEpisode into the canonical EpisodeMetadata.
func tmdbEpisodeToMeta(ep tmdb.TVEpisode, seasonNumber int) *apiMetadata.EpisodeMetadata {
	image := ""
	hasImage := false
	if ep.StillPath != "" {
		image = "https://image.tmdb.org/t/p/w780" + ep.StillPath
		hasImage = true
	}

	epStr := strconv.Itoa(ep.EpisodeNumber)
	// We store the original TMDB episode number as the string representation for identification
	// but we'll use season-aware logic for enrichment matching.

	return &apiMetadata.EpisodeMetadata{
		EpisodeNumber:         ep.EpisodeNumber,
		SeasonNumber:          seasonNumber,
		Episode:               epStr,
		Title:                 ep.Name,
		Overview:              ep.Overview,
		Summary:               ep.Overview,
		AirDate:               ep.AirDate,
		Length:                ep.Runtime,
		Image:                 image,
		HasImage:              hasImage,
		TvdbId:                ep.ID, // TMDB episode ID stored in TvdbId field
		AbsoluteEpisodeNumber: 0,     // Populated later by AniDB enrichment if available
	}
}

// buildTitleMapFromTV extracts title variants from a TMDB TVDetails.
func buildTitleMapFromTV(r *tmdb.TVDetails) map[string]string {
	titles := make(map[string]string)
	if r.Name != "" {
		titles["en"] = r.Name
	}
	if r.OriginalName != "" && r.OriginalName != r.Name {
		if r.OriginalLanguage == "ja" {
			titles["ja"] = r.OriginalName
		} else {
			titles["ro"] = r.OriginalName
		}
	}
	return titles
}

// buildTitleMapFromMovie extracts title variants from a TMDB MovieDetails.
func buildTitleMapFromMovie(r *tmdb.MovieDetails) map[string]string {
	titles := make(map[string]string)
	if r.Title != "" {
		titles["en"] = r.Title
	}
	if r.OriginalTitle != "" && r.OriginalTitle != r.Title {
		if r.OriginalLanguage == "ja" {
			titles["ja"] = r.OriginalTitle
		} else {
			titles["ro"] = r.OriginalTitle
		}
	}
	return titles
}

// applyEnrichments runs the Dragon Ball specific metadata pipeline.
func (p *TMDBProviderImpl) applyEnrichments(tmdbID int, metadata *apiMetadata.AnimeMetadata) {
	// Apply Latin Spanish title overrides for Dragon Ball
	EnrichWithLatinTitles(tmdbID, metadata)
	// Apply Filler episode marking for Dragon Ball
	EnrichWithFiller(tmdbID, metadata)
	// Apply canonical series titles for Dragon Ball
	EnrichWithSeriesTitles(tmdbID, metadata)
}

// Versioned keys exclude legacy rows that mixed public IDs, primary keys and types.
func (p *TMDBProviderImpl) metadataKey(publicID, tmdbID int, movie ...bool) string {
	kind := "SHOW"
	if (len(movie) > 0 && movie[0]) || (len(movie) == 0 && publicID >= 1_000_000) {
		kind = "MOVIE"
	}
	language := "es-MX"
	if p.client != nil {
		language = p.client.Language()
	}
	return fmt.Sprintf("public-v2:%s:%d:%s", kind, tmdbID, language)
}
