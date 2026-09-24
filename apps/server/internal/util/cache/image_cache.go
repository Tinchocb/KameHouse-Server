package cache

import (
	"sync/atomic"

	lru "github.com/hashicorp/golang-lru/v2"
)

// ThumbnailCache provides a concurrent-safe, memory-bounded LRU cache
// dedicated to avoiding disk I/O when serving grid images/thumbnails.
type ThumbnailCache struct {
	cache        *lru.Cache[string, []byte]
	currentBytes atomic.Int64
	maxBytes     int64
	hits         atomic.Uint64
	misses       atomic.Uint64
}

// NewThumbnailCache initializes the LRU caching layer with both item count
// and optional byte ceilings (e.g. 256MB).
func NewThumbnailCache(maxItems int, maxBytes ...int64) (*ThumbnailCache, error) {
	if maxItems <= 0 {
		maxItems = 1000
	}
	var byteLimit int64
	if len(maxBytes) > 0 {
		byteLimit = maxBytes[0]
	}

	tc := &ThumbnailCache{
		maxBytes: byteLimit,
	}

	evictCb := func(key string, value []byte) {
		tc.currentBytes.Add(-int64(len(value)))
	}

	c, err := lru.NewWithEvict[string, []byte](maxItems, evictCb)
	if err != nil {
		return nil, err
	}
	tc.cache = c

	return tc, nil
}

// Get safely retrieves the byte slice representing an image using its unique key.
func (c *ThumbnailCache) Get(key string) ([]byte, bool) {
	val, found := c.cache.Get(key)
	if found {
		c.hits.Add(1)
	} else {
		c.misses.Add(1)
	}
	return val, found
}

// Set stores the byte slice representation of an image alongside its unique key,
// enforcing the byte limit by evicting oldest entries when necessary.
func (c *ThumbnailCache) Set(key string, data []byte) bool {
	dataSize := int64(len(data))
	if c.maxBytes > 0 && dataSize > c.maxBytes {
		return false
	}

	// If byte limit is set, evict oldest until room is available
	if c.maxBytes > 0 {
		for c.currentBytes.Load()+dataSize > c.maxBytes && c.cache.Len() > 0 {
			c.cache.RemoveOldest()
		}
	}

	c.currentBytes.Add(dataSize)
	return c.cache.Add(key, data)
}

// Purge completely flushes the cache, releasing the GC to recycle the memory.
func (c *ThumbnailCache) Purge() {
	c.cache.Purge()
	c.currentBytes.Store(0)
}

// Stats returns the number of cache hits, misses, and current item count.
func (c *ThumbnailCache) Stats() (hits uint64, misses uint64, count int) {
	return c.hits.Load(), c.misses.Load(), c.cache.Len()
}

// BytesUsed returns the approximate memory occupied by cached image bytes.
func (c *ThumbnailCache) BytesUsed() int64 {
	return c.currentBytes.Load()
}

// Len returns the current number of items in the cache.
func (c *ThumbnailCache) Len() int {
	return c.cache.Len()
}
