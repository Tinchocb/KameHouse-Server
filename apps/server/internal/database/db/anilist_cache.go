package db

import (
	"kamehouse/internal/database/models"
	"time"

	"gorm.io/gorm/clause"
)

// GetAnilistCache retrieves a non-expired cache entry by its cache key.
// Returns nil if no fresh entry exists.
func GetAnilistCache(d *Database, cacheKey string) (*models.AnilistCacheEntry, error) {
	var entry models.AnilistCacheEntry
	err := d.Gorm().
		Where("cache_key = ? AND expires_at > ?", cacheKey, time.Now()).
		First(&entry).Error
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

// UpsertAnilistCache creates or updates a cache entry.
// Uses ON CONFLICT on cache_key to perform an atomic upsert within SQLite.
func UpsertAnilistCache(d *Database, entry *models.AnilistCacheEntry) error {
	return d.Gorm().Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "cache_key"}},
		DoUpdates: clause.AssignmentColumns([]string{"data", "expires_at", "updated_at"}),
	}).Create(entry).Error
}

// GetStaleAnilistCache retrieves a cache entry by key regardless of expiration.
// Used as a last-resort fallback when the AniList API is unavailable (rate limit / network failure).
func GetStaleAnilistCache(d *Database, cacheKey string) (*models.AnilistCacheEntry, error) {
	var entry models.AnilistCacheEntry
	err := d.Gorm().
		Where("cache_key = ?", cacheKey).
		First(&entry).Error
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

// PurgeExpiredAnilistCache removes all cache entries past their expiration time.
func PurgeExpiredAnilistCache(d *Database) error {
	return d.Gorm().
		Where("expires_at < ?", time.Now()).
		Delete(&models.AnilistCacheEntry{}).Error
}
