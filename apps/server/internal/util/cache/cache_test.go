package cache

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCacheBasicAndTTL(t *testing.T) {
	c := NewCache[string](50 * time.Millisecond)
	defer c.Close()

	c.Set("k1", "v1")
	val, ok := c.Get("k1")
	require.True(t, ok)
	assert.Equal(t, "v1", val)

	// Before expiry, Size should be 1
	assert.Equal(t, 1, c.Size())

	// Wait for TTL expiration
	time.Sleep(70 * time.Millisecond)
	_, ok = c.Get("k1")
	assert.False(t, ok, "key should be expired")
}

func TestCacheCleanup(t *testing.T) {
	c := NewCache[int](30 * time.Millisecond)
	defer c.Close()

	c.Set("k1", 100)
	c.Set("k2", 200)
	assert.Equal(t, 2, c.Size())

	time.Sleep(50 * time.Millisecond)
	c.Cleanup()
	assert.Equal(t, 0, c.Size(), "all entries should be purged after Cleanup")
}

func TestCacheMaxItemsBound(t *testing.T) {
	const capacity = 10
	c := NewCache[int](1*time.Hour, capacity)
	defer c.Close()

	assert.Equal(t, capacity, c.Capacity())

	// Insert 50 items
	for i := 0; i < 50; i++ {
		c.Set(fmt.Sprintf("key_%d", i), i)
		assert.LessOrEqual(t, c.Size(), capacity, "cache size must never exceed capacity")
	}

	assert.Equal(t, capacity, c.Size())

	// Overwriting an existing key must not grow or evict extra items
	for key := range c.entries {
		c.Set(key, 999)
		break
	}
	assert.Equal(t, capacity, c.Size())
}

func TestCacheEvictsExpiredFirstWhenAtCapacity(t *testing.T) {
	c := NewCache[string](20*time.Millisecond, 2)
	defer c.Close()

	c.Set("k1", "v1")
	c.Set("k2", "v2")
	assert.Equal(t, 2, c.Size())

	// Wait for both to expire
	time.Sleep(30 * time.Millisecond)

	// Now insert k3; eviction should purge expired entry first
	c.Set("k3", "v3")
	assert.LessOrEqual(t, c.Size(), 2)

	val, ok := c.Get("k3")
	require.True(t, ok)
	assert.Equal(t, "v3", val)
}

func TestCacheConcurrency(t *testing.T) {
	c := NewCache[int](500*time.Millisecond, 20)
	defer c.Close()

	var wg sync.WaitGroup
	workers := 8
	iterations := 100

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				key := fmt.Sprintf("k_%d_%d", workerID, i%15)
				c.Set(key, i)
				c.Get(key)
				if i%20 == 0 {
					c.Delete(key)
				}
				assert.LessOrEqual(t, c.Size(), 20)
			}
		}(w)
	}

	wg.Wait()
	assert.LessOrEqual(t, c.Size(), 20)
}
