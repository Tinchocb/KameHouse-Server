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

	mu    sync.Mutex
	cache map[int]*tmdbCachedEntry
}

type tmdbCachedEntry struct {
	data      *apiMetadata.AnimeMetadata
	expiresAt time.Time
}

const tmdbMetadataTTL = 6 * time.Hour

// NewTMDBProviderImpl creates a new TMDB-backed metadata provider.
func NewTMDBProviderImpl(client *tmdb.Client, database *db.Database, logger *zerolog.Logger) *TMDBProviderImpl {
	return &TMDBProviderImpl{
		client: client,
		db:     database,
		logger: logger,
		cache:  make(map[int]*tmdbCachedEntry),
	}
}

// GetAnimeMetadata fetches full episode metadata for a media identified by its
// internal media ID (which maps to a TMDB TV show ID stored in LibraryMedia).
func (p *TMDBProviderImpl) GetAnimeMetadata(id int) (*apiMetadata.AnimeMetadata, error) {
	// 1. Check in-memory cache first
	p.mu.Lock()
	if entry, ok := p.cache[id]; ok && time.Now().Before(entry.expiresAt) {
		p.mu.Unlock()
		if entry.data == nil {
			return nil, fmt.Errorf("tmdb_provider: cached metadata for ID %d is nil", id)
		}
		return entry.data, nil
	}
	p.mu.Unlock()

	// Resolve the real TMDB ID and type from the database.
	tmdbId := id
	
	// 2. Check Database Persistent Cache
	if p.db != nil {
		var cachedData apiMetadata.AnimeMetadata
		found, err := db.GetMetadataCache(p.db, "tmdb-anime-episodes", strconv.Itoa(tmdbId), &cachedData)
		if err == nil && found {
			// Store in memory cache too for subsequent lookups in this session
			p.mu.Lock()
			p.cache[id] = &tmdbCachedEntry{
				data:      &cachedData,
				expiresAt: time.Now().Add(tmdbMetadataTTL),
			}
			p.mu.Unlock()
			
			// Always re-apply enrichments to cached data to ensure local logic changes are reflected
			p.applyEnrichments(tmdbId, &cachedData)
			
			return &cachedData, nil
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Resolve the real TMDB ID and type from the database.
	isMovie := false
	if p.db != nil {
		if m, err := db.GetLibraryMediaByTmdbId(p.db, id); err == nil && m != nil {
			if m.TmdbId > 0 {
				tmdbId = m.TmdbId
			}
			isMovie = m.Format == "MOVIE"
		}
	}

	var episodes map[string]*apiMetadata.EpisodeMetadata
	var totalEpisodes, totalSpecials int
	var titles map[string]string

	if isMovie {
		// --- MOVIE PATH ---
		movieDetails, err := p.client.GetMovieDetails(ctx, strconv.Itoa(tmdbId))
		if err != nil {
			return nil, fmt.Errorf("tmdb_provider: GetMovieDetails(%d): %w", tmdbId, err)
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
	} else {
		// --- TV SHOW PATH ---
		// Fetch the TV show details to determine how many seasons exist.
		tvDetails, err := p.client.GetTVDetails(ctx, strconv.Itoa(tmdbId))
		if err != nil {
			return nil, fmt.Errorf("tmdb_provider: GetTVDetails(%d): %w", tmdbId, err)
		}

		titles = buildTitleMapFromTV(tvDetails)
		episodes = make(map[string]*apiMetadata.EpisodeMetadata)

		// Fetch seasons 0 (specials) through N, tracking absolute episode counter
		maxSeasons := 5
		if tvDetails.NumberOfEpisodes > 0 {
			maxSeasons = (tvDetails.NumberOfEpisodes / 12) + 2
			if maxSeasons > 20 {
				maxSeasons = 20
			}
		}

		absEpCounter := 0 // running counter across seasons for the flat episode key
		for seasonNum := 0; seasonNum <= maxSeasons; seasonNum++ {
			seasonDetails, err := p.client.GetTVSeason(ctx, tmdbId, seasonNum)
			if err != nil || len(seasonDetails.Episodes) == 0 {
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
		return nil, fmt.Errorf("tmdb_provider: no episodes found for TMDB ID %d", tmdbId)
	}

	result := &apiMetadata.AnimeMetadata{
		Titles:       titles,
		Episodes:     episodes,
		EpisodeCount: totalEpisodes,
		SpecialCount: totalSpecials,
		Mappings:     &apiMetadata.AnimeMappings{},
	}

	// Apply Latin Spanish title overrides for Dragon Ball
	p.applyEnrichments(tmdbId, result)

	// Store in cache
	p.mu.Lock()
	p.cache[id] = &tmdbCachedEntry{
		data:      result,
		expiresAt: time.Now().Add(tmdbMetadataTTL),
	}
	p.mu.Unlock()

	// 3. Save to Database Persistent Cache
	if p.db != nil {
		_ = db.UpsertMetadataCache(p.db, "tmdb-anime-episodes", strconv.Itoa(id), result, 7*24*time.Hour) // 1 week TTL
	}

	if p.logger != nil {
		p.logger.Debug().
			Int("mediaId", id).
			Int("tmdbId", tmdbId).
			Int("episodes", totalEpisodes).
			Int("specials", totalSpecials).
			Msg("tmdb_provider: fetched episode metadata")
	}

	return result, nil
}

// GetAnimeMetadataWrapper returns a SimpleAnimeMetadataWrapper backed by the
// provided AnimeMetadata. This allows episode lookup by flat episode number key.
func (p *TMDBProviderImpl) GetAnimeMetadataWrapper(baseAnime *platform.UnifiedMedia, animeMetadata *apiMetadata.AnimeMetadata) AnimeMetadataWrapper {
	return NewSimpleAnimeMetadataWrapper(animeMetadata)
}

func (p *TMDBProviderImpl) SetUseFallbackProvider(v bool) {}

func (p *TMDBProviderImpl) ClearCache() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.cache = make(map[int]*tmdbCachedEntry)
}

func (p *TMDBProviderImpl) Close() error { return nil }

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
func (p *TMDBProviderImpl) applyEnrichments(tmdbId int, metadata *apiMetadata.AnimeMetadata) {
	// Apply Latin Spanish title overrides for Dragon Ball
	EnrichWithLatinTitles(tmdbId, metadata)
	// Apply Saga metadata for Dragon Ball
	EnrichWithSagas(tmdbId, metadata)
	// Apply Filler episode marking for Dragon Ball
	EnrichWithFiller(tmdbId, metadata)
	// Apply canonical series titles for Dragon Ball
	EnrichWithSeriesTitles(tmdbId, metadata)
}
