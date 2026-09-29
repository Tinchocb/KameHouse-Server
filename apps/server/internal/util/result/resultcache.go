package result

import (
	"kamehouse/internal/util"
	"time"
)

type Cache[K interface{}, V any] struct {
	store util.RWMutexMap
}

type cacheItem[K interface{}, V any] struct {
	value      V
	expiration time.Time
}

func NewCache[K interface{}, V any]() *Cache[K, V] {
	return &Cache[K, V]{}
}

func (c *Cache[K, V]) SetT(key K, value V, ttl time.Duration) {
	c.store.Store(key, &cacheItem[K, V]{value, time.Now().Add(ttl)})
}

func (c *Cache[K, V]) Get(key K) (V, bool) {
	item, ok := c.store.Load(key)
	if !ok {
		var zero V
		return zero, false
	}
	ci := item.(*cacheItem[K, V])
	if time.Now().After(ci.expiration) {
		c.Delete(key)
		var zero V
		return zero, false
	}
	return ci.value, true
}

func (c *Cache[K, V]) Delete(key K) {
	c.store.Delete(key)
}

func (c *Cache[K, V]) Clear() {
	c.store.Range(func(key interface{}, value interface{}) bool {
		c.store.Delete(key)
		return true
	})
}
