package scanner

import (
	"sync"
	"time"
)

// DirCacheEntry holds the cached API result for a directory.
// All files in the same directory are assumed to belong to the same media,
// so we only need to resolve the media identity once per directory.
type DirCacheEntry struct {
	MediaID    int
	Title      string
	Confidence float64
	FetchedAt  time.Time
}

// DirCache is a thread-safe, lock-free directory-level cache that prevents
// redundant API calls when multiple episodes share the same folder.
//
// Example: 50 Dragon Ball Z episodes in /anime/Dragon Ball Z/
// → First file triggers a metadata lookup, remaining 49 hit the cache.
type DirCache struct {
	m sync.Map // map[string]*DirCacheEntry (key = directory path)
}

// NewDirCache creates a new directory cache.
func NewDirCache() *DirCache {
	return &DirCache{}
}

// GetOrFetch returns a cached entry for the directory, or calls fetchFn to populate it.
// This is safe to call from multiple goroutines — only the first caller for a given
// directory will execute fetchFn; subsequent callers block until the result is ready.
func (c *DirCache) GetOrFetch(dir string, fetchFn func() *DirCacheEntry) *DirCacheEntry {
	// Fast path: already cached (may be *DirCacheEntry or *onceCacheEntry)
	if val, ok := c.m.Load(dir); ok {
		switch v := val.(type) {
		case *DirCacheEntry:
			return v
		case *onceCacheEntry:
			v.once.Do(func() {}) // wait for in-flight fetch
			return v.result
		}
	}

	// Slow path: use LoadOrStore with a sync.Once to ensure fetchFn runs exactly once.
	// We store a *onceCacheEntry as a placeholder to coordinate concurrent callers.
	placeholder := &onceCacheEntry{}
	actual, loaded := c.m.LoadOrStore(dir, placeholder)

	if loaded {
		// Another goroutine got here first. Wait for their result.
		switch v := actual.(type) {
		case *DirCacheEntry:
			return v
		case *onceCacheEntry:
			v.once.Do(func() {}) // no-op, just wait
			return v.result
		}
	}

	// We won the race — execute the fetch
	placeholder.once.Do(func() {
		placeholder.result = fetchFn()
	})

	// Replace the placeholder with the actual *DirCacheEntry for future fast-path hits
	if placeholder.result != nil {
		c.m.Store(dir, placeholder.result)
	}

	return placeholder.result
}

// onceCacheEntry is an internal type used to coordinate exactly-once fetch execution.
type onceCacheEntry struct {
	once   sync.Once
	result *DirCacheEntry
}

// Load returns the cached entry for a directory, if present.
// Returns nil if no entry exists.
func (c *DirCache) Load(dir string) *DirCacheEntry {
	val, ok := c.m.Load(dir)
	if !ok {
		return nil
	}
	switch v := val.(type) {
	case *DirCacheEntry:
		return v
	case *onceCacheEntry:
		return v.result
	}
	return nil
}

// Size returns an approximate count of cached directories (for telemetry).
func (c *DirCache) Size() int {
	count := 0
	c.m.Range(func(_, _ any) bool {
		count++
		return true
	})
	return count
}
