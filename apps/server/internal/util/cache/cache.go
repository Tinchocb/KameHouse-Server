package cache

import (
	"crypto/md5"
	"encoding/hex"
	"os"
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
}

func NewCache[T any](ttl time.Duration) *Cache[T] {
	c := &Cache[T]{
		entries: make(map[string]*CacheEntry[T]),
		ttl:     ttl,
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
		for range ticker.C {
			c.Cleanup()
		}
	}()

	return c
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

func FileHash(filepath string) (string, error) {
	info, err := os.Stat(filepath)
	if err != nil {
		return "", err
	}

	hash := md5.New()
	hash.Write([]byte(filepath))
	hash.Write([]byte(info.ModTime().String()))
	hash.Write([]byte(int64ToBytes(info.Size())))

	return hex.EncodeToString(hash.Sum(nil)), nil
}

func int64ToBytes(n int64) []byte {
	return []byte{
		byte(n >> 56),
		byte(n >> 48),
		byte(n >> 40),
		byte(n >> 32),
		byte(n >> 24),
		byte(n >> 16),
		byte(n >> 8),
		byte(n),
	}
}
