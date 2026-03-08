package models

import "time"

// AnilistCacheEntry stores serialized AniList API responses in SQLite
// to avoid hitting AniList rate limits. Keyed by a deterministic cache key
// derived from the query parameters (sort, genre, season, etc.)
type AnilistCacheEntry struct {
	BaseModel
	CacheKey  string    `gorm:"column:cache_key;uniqueIndex;not null" json:"cacheKey"`
	Data      []byte    `gorm:"column:data;type:blob;not null" json:"-"`           // JSON-serialized response
	ExpiresAt time.Time `gorm:"column:expires_at;index;not null" json:"expiresAt"` // When this entry becomes stale
}
