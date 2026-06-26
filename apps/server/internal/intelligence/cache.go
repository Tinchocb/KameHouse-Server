package intelligence

import (
	"sync"
	"time"
)

// ResultCache es una caché en memoria para resultados de selección.
// Evita re-evaluar los mismos archivos repetidamente.
type ResultCache struct {
	mu      sync.RWMutex
	entries map[string]*cacheEntry
	maxAge  time.Duration
	maxSize int
}

type cacheEntry struct {
	result    *SelectionResult
	createdAt time.Time
}

// NewResultCache crea una nueva caché con un TTL y tamaño máximo.
func NewResultCache(maxAge time.Duration, maxSize int) *ResultCache {
	c := &ResultCache{
		entries: make(map[string]*cacheEntry),
		maxAge:  maxAge,
		maxSize: maxSize,
	}

	// Limpieza periódica de entradas expiradas
	go c.cleanupLoop()

	return c
}

// Get busca un resultado en la caché por key.
func (c *ResultCache) Get(key string) (*SelectionResult, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.entries[key]
	if !ok {
		return nil, false
	}

	if time.Since(entry.createdAt) > c.maxAge {
		return nil, false
	}

	return entry.result, true
}

// Set almacena un resultado en la caché.
func (c *ResultCache) Set(key string, result *SelectionResult) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Si la caché está llena, eliminar la entrada más antigua
	if len(c.entries) >= c.maxSize {
		c.evictOldest()
	}

	c.entries[key] = &cacheEntry{
		result:    result,
		createdAt: time.Now(),
	}
}

// Delete elimina una entrada de la caché.
func (c *ResultCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.entries, key)
}

// Clear limpia toda la caché.
func (c *ResultCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]*cacheEntry)
}

// evictOldest elimina la entrada más antigua de la caché.
func (c *ResultCache) evictOldest() {
	var oldestKey string
	var oldestTime time.Time

	for key, entry := range c.entries {
		if oldestKey == "" || entry.createdAt.Before(oldestTime) {
			oldestKey = key
			oldestTime = entry.createdAt
		}
	}

	if oldestKey != "" {
		delete(c.entries, oldestKey)
	}
}

// cleanupLoop elimina entradas expiradas periódicamente.
func (c *ResultCache) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		c.mu.Lock()
		now := time.Now()
		for key, entry := range c.entries {
			if now.Sub(entry.createdAt) > c.maxAge {
				delete(c.entries, key)
			}
		}
		c.mu.Unlock()
	}
}

// Stats retorna estadísticas de la caché.
func (c *ResultCache) Stats() CacheStats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return CacheStats{
		Size:    len(c.entries),
		MaxSize: c.maxSize,
		MaxAge:  c.maxAge,
	}
}

// CacheStats estadísticas de la caché.
type CacheStats struct {
	Size    int           `json:"size"`
	MaxSize int           `json:"maxSize"`
	MaxAge  time.Duration `json:"maxAge"`
}
