package cache

import (
	"sync"
	"time"
)

type CacheEntry[T any] struct {
	Value     T
	ExpiresAt time.Time
}

type Cache[T any] struct {
	mu      sync.RWMutex
	entries map[string]*CacheEntry[T]
	ttl     time.Duration
	stop    chan struct{}
}

func NewCache[T any](ttl time.Duration) *Cache[T] {
	c := &Cache[T]{
		entries: make(map[string]*CacheEntry[T]),
		ttl:     ttl,
		stop:    make(chan struct{}),
	}

	// Background reaper: periodically prune expired entries to prevent
	// slow memory leaks from stale cache items that are never accessed again.
	go func() {
		interval := ttl
		if interval < time.Minute {
			interval = time.Minute
		}
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				c.Cleanup()
			case <-c.stop:
				return
			}
		}
	}()

	return c
}

func (c *Cache[T]) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	select {
	case <-c.stop:
		// already closed
	default:
		close(c.stop)
	}
}

func (c *Cache[T]) Get(key string) (T, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var zero T
	entry, ok := c.entries[key]
	if !ok {
		return zero, false
	}

	if time.Now().After(entry.ExpiresAt) {
		return zero, false
	}

	return entry.Value, true
}

func (c *Cache[T]) Set(key string, value T) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.entries[key] = &CacheEntry[T]{
		Value:     value,
		ExpiresAt: time.Now().Add(c.ttl),
	}
}

func (c *Cache[T]) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.entries, key)
}

func (c *Cache[T]) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]*CacheEntry[T])
}

func (c *Cache[T]) Cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	for key, entry := range c.entries {
		if now.After(entry.ExpiresAt) {
			delete(c.entries, key)
		}
	}
}

func (c *Cache[T]) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.entries)
}
