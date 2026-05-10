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
	// Check in-memory cache first
	p.mu.Lock()
	if entry, ok := p.cache[id]; ok && time.Now().Before(entry.expiresAt) {
		p.mu.Unlock()
		return entry.data, nil
	}
	p.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Resolve the real TMDB ID and type from the database.
	tmdbId := id
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

		titles = buildTitleMap(movieDetails)
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

		titles = buildTitleMap(tvDetails)
		episodes = make(map[string]*apiMetadata.EpisodeMetadata)

		// Fetch seasons 0 (specials) through N
		maxSeasons := 5
		if tvDetails.NumberOfEpisodes > 0 {
			maxSeasons = (tvDetails.NumberOfEpisodes / 12) + 2
			if maxSeasons > 20 {
				maxSeasons = 20
			}
		}

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
					key = fmt.Sprintf("S%d", ep.EpisodeNumber)
					totalSpecials++
				} else {
					key = strconv.Itoa(ep.EpisodeNumber)
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

	// Store in cache
	p.mu.Lock()
	p.cache[id] = &tmdbCachedEntry{
		data:      result,
		expiresAt: time.Now().Add(tmdbMetadataTTL),
	}
	p.mu.Unlock()

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

// GetAnimeMetadataWrapper returns an AnimeMetadataWrapper for the given metadata.
// Delegates to ProviderImpl which already constructs AnimeWrapperImpl correctly.
func (p *TMDBProviderImpl) GetAnimeMetadataWrapper(baseAnime *platform.UnifiedMedia, animeMetadata *apiMetadata.AnimeMetadata) AnimeMetadataWrapper {
	stub := &ProviderImpl{}
	return stub.GetAnimeMetadataWrapper(baseAnime, animeMetadata)
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
		image = "https://image.tmdb.org/t/p/w500" + ep.StillPath
		hasImage = true
	}

	epStr := strconv.Itoa(ep.EpisodeNumber)
	if seasonNumber == 0 {
		epStr = "S" + epStr
	}

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

// buildTitleMap extracts title variants from a TMDB SearchResult.
func buildTitleMap(r tmdb.SearchResult) map[string]string {
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
