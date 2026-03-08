package metadata_cache

import (
	"fmt"
	"kamehouse/internal/util/cache"
	"sync"
	"time"
)

type CachedResponse struct {
	Provider string
	Query    string
	Data     any
}

type MetadataCache struct {
	mu       sync.RWMutex
	provider map[string]*cache.Cache[any]
	ttl      time.Duration
}

func NewMetadataCache(ttl time.Duration) *MetadataCache {
	return &MetadataCache{
		provider: make(map[string]*cache.Cache[any]),
		ttl:      ttl,
	}
}

func (mc *MetadataCache) getProviderCache(provider string) *cache.Cache[any] {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	if _, ok := mc.provider[provider]; !ok {
		mc.provider[provider] = cache.NewCache[any](mc.ttl)
	}

	return mc.provider[provider]
}

func (mc *MetadataCache) Get(provider, query string) (any, bool) {
	key := mc.makeKey(provider, query)
	return mc.getProviderCache(provider).Get(key)
}

func (mc *MetadataCache) Set(provider, query string, data any) {
	key := mc.makeKey(provider, query)
	mc.getProviderCache(provider).Set(key, data)
}

func (mc *MetadataCache) makeKey(provider, query string) string {
	return fmt.Sprintf("%s:%s", provider, query)
}

func (mc *MetadataCache) Clear(provider string) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	if provider == "" {
		mc.provider = make(map[string]*cache.Cache[any])
	} else {
		delete(mc.provider, provider)
	}
}

func (mc *MetadataCache) Cleanup() {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	for _, c := range mc.provider {
		c.Cleanup()
	}
}

func (mc *MetadataCache) Size() int {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	total := 0
	for _, c := range mc.provider {
		total += c.Size()
	}
	return total
}

var (
	globalCache     *MetadataCache
	globalCacheOnce sync.Once
)

func GlobalCache() *MetadataCache {
	globalCacheOnce.Do(func() {
		globalCache = NewMetadataCache(30 * time.Minute)
	})
	return globalCache
}
