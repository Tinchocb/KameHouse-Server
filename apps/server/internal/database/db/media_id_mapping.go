package db

import (
	"kamehouse/internal/database/models"
	"strconv"
	"time"
)

func formatMediaIDMappingCacheKey(tmdbID int) string {
	return "tmdb:" + strconv.Itoa(tmdbID)
}

// GetMediaIDMappingByTMDB busca un mapeo por TMDB ID.
func (db *Database) GetMediaIDMappingByTMDB(tmdbID int) (*models.MediaIDMapping, bool) {
	cacheKey := formatMediaIDMappingCacheKey(tmdbID)
	if res, ok := db.MediaIDMappingCache.Get(cacheKey); ok {
		return res, true
	}

	var res models.MediaIDMapping
	err := db.gormdb.Where("tmdb_id = ?", tmdbID).First(&res).Error
	if err != nil {
		return nil, false
	}

	db.MediaIDMappingCache.Set(cacheKey, &res)
	return &res, true
}

// GetMediaIDMappingByJellyfin busca un mapeo por Jellyfin ID.
func (db *Database) GetMediaIDMappingByJellyfin(jellyfinID string) (*models.MediaIDMapping, bool) {
	var res models.MediaIDMapping
	err := db.gormdb.Where("jellyfin_id = ?", jellyfinID).First(&res).Error
	if err != nil {
		return nil, false
	}
	return &res, true
}

// GetMediaIDMappingByInternal busca un mapeo por Internal ID (KameHouse).
func (db *Database) GetMediaIDMappingByInternal(internalID int) (*models.MediaIDMapping, bool) {
	var res models.MediaIDMapping
	err := db.gormdb.Where("internal_id = ?", internalID).First(&res).Error
	if err != nil {
		return nil, false
	}
	return &res, true
}

// UpsertMediaIDMapping inserta o actualiza un mapeo de IDs.
func (db *Database) UpsertMediaIDMapping(mapping *models.MediaIDMapping) error {
	mapping.LastSyncAt = time.Now()

	// Invalidate cache
	cacheKey := formatMediaIDMappingCacheKey(mapping.TMDBID)
	db.MediaIDMappingCache.Delete(cacheKey)

	var existing models.MediaIDMapping
	result := db.gormdb.Where("tmdb_id = ? AND media_type = ?", mapping.TMDBID, mapping.MediaType).First(&existing)

	if result.Error != nil {
		return db.gormdb.Create(mapping).Error
	}

	updates := map[string]interface{}{
		"internal_id":  mapping.InternalID,
		"jellyfin_id":  mapping.JellyfinID,
		"mal_id":       mapping.MALID,
		"title":        mapping.Title,
		"last_sync_at": mapping.LastSyncAt,
	}
	return db.gormdb.Model(&existing).Updates(updates).Error
}

// ListMediaIDMappings retorna todos los mapeos conocidos.
func (db *Database) ListMediaIDMappings() ([]*models.MediaIDMapping, error) {
	var mappings []*models.MediaIDMapping
	err := db.gormdb.Find(&mappings).Error
	return mappings, err
}
