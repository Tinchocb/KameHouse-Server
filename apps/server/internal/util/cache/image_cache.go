package cache

import (
	lru "github.com/hashicorp/golang-lru/v2"
)

// ThumbnailCache provides a concurrent-safe, memory-bounded LRU cache
// dedicated to avoiding disk I/O when serving grid images/thumbnails.
type ThumbnailCache struct {
	cache *lru.Cache[string, []byte]
}

// NewThumbnailCache initializes the LRU caching layer with a strict item ceiling.
// A common ceiling is 1000 items to balance instantaneous UX with safe memory bounds.
func NewThumbnailCache(maxItems int) (*ThumbnailCache, error) {
	c, err := lru.New[string, []byte](maxItems)
	if err != nil {
		return nil, err
	}

	return &ThumbnailCache{
		cache: c,
	}, nil
}

// Get safely retrieves the byte slice representing an image using its unique key.
func (c *ThumbnailCache) Get(key string) ([]byte, bool) {
	return c.cache.Get(key)
}

// Set stores the byte slice representation of an image alongside its unique key.
func (c *ThumbnailCache) Set(key string, data []byte) bool {
	return c.cache.Add(key, data)
}

// Purge completely flushes the cache, releasing the GC to recycle the memory.
func (c *ThumbnailCache) Purge() {
	c.cache.Purge()
}
