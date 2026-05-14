package metadata_provider

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"time"

	"kamehouse/internal/api/anilist"
	apiMetadata "kamehouse/internal/api/metadata"
	"kamehouse/internal/database/db"
	"kamehouse/internal/platforms/platform"

	"github.com/rs/zerolog"
)

type AniListProviderImpl struct {
	client *anilist.Client
	db     *db.Database
	logger *zerolog.Logger

	mu    sync.Mutex
	cache map[int]*anilistCachedEntry
}

type anilistCachedEntry struct {
	data      *apiMetadata.AnimeMetadata
	expiresAt time.Time
}

const anilistMetadataTTL = 6 * time.Hour

func NewAniListProviderImpl(client *anilist.Client, database *db.Database, logger *zerolog.Logger) *AniListProviderImpl {
	return &AniListProviderImpl{
		client: client,
		db:     database,
		logger: logger,
		cache:  make(map[int]*anilistCachedEntry),
	}
}

func (p *AniListProviderImpl) GetAnimeMetadata(id int) (*apiMetadata.AnimeMetadata, error) {
	// 1. Check in-memory cache
	p.mu.Lock()
	if entry, ok := p.cache[id]; ok && time.Now().Before(entry.expiresAt) {
		p.mu.Unlock()
		return entry.data, nil
	}
	p.mu.Unlock()

	// 2. Check Database Persistent Cache
	if p.db != nil {
		var cachedData apiMetadata.AnimeMetadata
		found, err := db.GetMetadataCache(p.db, "anilist-anime-episodes", strconv.Itoa(id), &cachedData)
		if err == nil && found {
			p.mu.Lock()
			p.cache[id] = &anilistCachedEntry{
				data:      &cachedData,
				expiresAt: time.Now().Add(anilistMetadataTTL),
			}
			p.mu.Unlock()
			return &cachedData, nil
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Find the exact name from database
	if p.db == nil {
		return nil, fmt.Errorf("database required to map local ID to AniList")
	}

	media, err := db.GetLibraryMediaByTmdbId(p.db, id)
	if err != nil || media == nil {
		return nil, fmt.Errorf("media not found in library for ID %d", id)
	}

	titleToSearch := media.TitleOriginal
	if titleToSearch == "" {
		titleToSearch = media.TitleEnglish
	}
	if titleToSearch == "" {
		titleToSearch = media.TitleRomaji
	}

	anilistMedia, err := p.client.SearchAnimeByTitle(ctx, titleToSearch)
	if err != nil {
		return nil, fmt.Errorf("anilist_provider: SearchAnimeByTitle failed for '%s': %w", titleToSearch, err)
	}

	titles := map[string]string{
		"en": anilistMedia.Title.English,
		"ja": anilistMedia.Title.Romaji,
	}
	if titles["en"] == "" {
		titles["en"] = anilistMedia.Title.Romaji
	}

	result := &apiMetadata.AnimeMetadata{
		Titles:       titles,
		Episodes:     make(map[string]*apiMetadata.EpisodeMetadata),
		EpisodeCount: anilistMedia.Episodes,
		SpecialCount: 0,
		Mappings:     &apiMetadata.AnimeMappings{AnilistId: anilistMedia.ID},
	}

	// For AniList we map all episodes to a single structure unless we fetch episode lists via another API
	if anilistMedia.Episodes > 0 {
		for i := 1; i <= anilistMedia.Episodes; i++ {
			epStr := strconv.Itoa(i)
			result.Episodes[epStr] = &apiMetadata.EpisodeMetadata{
				EpisodeNumber: i,
				SeasonNumber:  1,
				Episode:       epStr,
				Title:         fmt.Sprintf("Episode %d", i),
				Overview:      anilistMedia.Description, // Fallback to series description
				Image:         anilistMedia.CoverImage.ExtraLarge,
				HasImage:      true,
			}
		}
	} else if anilistMedia.Format == "MOVIE" || anilistMedia.Format == "SPECIAL" {
		result.Episodes["1"] = &apiMetadata.EpisodeMetadata{
			EpisodeNumber: 1,
			SeasonNumber:  1,
			Episode:       "1",
			Title:         titles["en"],
			Overview:      anilistMedia.Description,
			Image:         anilistMedia.CoverImage.ExtraLarge,
			HasImage:      true,
		}
		result.EpisodeCount = 1
	}

	// Apply Dragon Ball specific enrichments (reusing the same logic as TMDB)
	EnrichWithLatinTitles(id, result)
	EnrichWithSagas(id, result)
	EnrichWithFiller(id, result)
	EnrichWithSeriesTitles(id, result)

	// Store in cache
	p.mu.Lock()
	p.cache[id] = &anilistCachedEntry{
		data:      result,
		expiresAt: time.Now().Add(anilistMetadataTTL),
	}
	p.mu.Unlock()

	// 3. Save to Database Persistent Cache
	if p.db != nil {
		_ = db.UpsertMetadataCache(p.db, "anilist-anime-episodes", strconv.Itoa(id), result, 7*24*time.Hour)
	}

	return result, nil
}

func (p *AniListProviderImpl) GetAnimeMetadataWrapper(baseAnime *platform.UnifiedMedia, animeMetadata *apiMetadata.AnimeMetadata) AnimeMetadataWrapper {
	return NewSimpleAnimeMetadataWrapper(animeMetadata)
}

func (p *AniListProviderImpl) SetUseFallbackProvider(v bool) {}

func (p *AniListProviderImpl) ClearCache() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.cache = make(map[int]*anilistCachedEntry)
}

func (p *AniListProviderImpl) Close() error { return nil }
