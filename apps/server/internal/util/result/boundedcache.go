package result

import (
	"container/list"
	"sync"
	"time"
)

// BoundedCache implements an LRU cache with a maximum capacity
type BoundedCache[K comparable, V any] struct {
	mu       sync.RWMutex
	capacity int
	items    map[K]*list.Element
	order    *list.List
}

type boundedCacheItem[K comparable, V any] struct {
	key        K
	value      V
	expiration time.Time
}

// NewBoundedCache creates a new bounded cache with the specified capacity
func NewBoundedCache[K comparable, V any](capacity int) *BoundedCache[K, V] {
	return &BoundedCache[K, V]{
		capacity: capacity,
		items:    make(map[K]*list.Element),
		order:    list.New(),
	}
}

// Set adds or updates an item in the cache with a default TTL
func (c *BoundedCache[K, V]) Set(key K, value V) {
	c.SetT(key, value, time.Hour) // Default TTL of 1 hour
}

// SetT adds or updates an item in the cache with a specific TTL
func (c *BoundedCache[K, V]) SetT(key K, value V, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	expiration := time.Now().Add(ttl)
	item := &boundedCacheItem[K, V]{
		key:        key,
		value:      value,
		expiration: expiration,
	}

	// If key already exists, update it and move to front
	if elem, exists := c.items[key]; exists {
		elem.Value = item
		c.order.MoveToFront(elem)
		return
	}

	// If at capacity, remove oldest item
	if len(c.items) >= c.capacity {
		c.evictOldest()
	}

	// Add new item to front
	elem := c.order.PushFront(item)
	c.items[key] = elem
}

// Get retrieves an item from the cache and marks it as recently used
func (c *BoundedCache[K, V]) Get(key K) (V, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	var zero V
	elem, exists := c.items[key]
	if !exists {
		return zero, false
	}

	item := elem.Value.(*boundedCacheItem[K, V])

	// Check if expired
	if time.Now().After(item.expiration) {
		c.delete(key)
		return zero, false
	}

	// Move to front (mark as recently used)
	c.order.MoveToFront(elem)
	return item.value, true
}

// Delete removes an item from the cache
func (c *BoundedCache[K, V]) Delete(key K) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.delete(key)
}

// delete removes an item from the cache (internal, assumes lock is held)
func (c *BoundedCache[K, V]) delete(key K) {
	if elem, exists := c.items[key]; exists {
		c.order.Remove(elem)
		delete(c.items, key)
	}
}

// Clear removes all items from the cache
func (c *BoundedCache[K, V]) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items = make(map[K]*list.Element)
	c.order.Init()
}

// Size returns the current number of items in the cache
func (c *BoundedCache[K, V]) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.items)
}

// evictOldest removes the least recently used item (assumes lock is held)
func (c *BoundedCache[K, V]) evictOldest() {
	if c.order.Len() == 0 {
		return
	}

	elem := c.order.Back()
	if elem != nil {
		item := elem.Value.(*boundedCacheItem[K, V])
		c.delete(item.key)
	}
}
