package result

import (
	"kamehouse/internal/util"
)

type Map[K interface{}, V any] struct {
	store util.RWMutexMap
}

type mapItem[K interface{}, V any] struct {
	value V
}

func NewMap[K interface{}, V any]() *Map[K, V] {
	return &Map[K, V]{}
}

func (c *Map[K, V]) Set(key K, value V) {
	c.store.Store(key, &mapItem[K, V]{value})
}

func (c *Map[K, V]) Get(key K) (V, bool) {
	item, ok := c.store.Load(key)
	if !ok {
		return (&mapItem[K, V]{}).value, false
	}
	ci := item.(*mapItem[K, V])
	return ci.value, true
}

func (c *Map[K, V]) Delete(key K) {
	c.store.Delete(key)
}

func (c *Map[K, V]) Clear() {
	c.store.Range(func(key interface{}, value interface{}) bool {
		c.store.Delete(key)
		return true
	})
}

func (c *Map[K, V]) Range(callback func(key K, value V) bool) {
	c.store.Range(func(key, value interface{}) bool {
		ci := value.(*mapItem[K, V])
		return callback(key.(K), ci.value)
	})
}

func (c *Map[K, V]) Values() []V {
	values := make([]V, 0)
	c.store.Range(func(key, value interface{}) bool {
		item := value.(*mapItem[K, V]) // Correct type assertion
		values = append(values, item.value)
		return true
	})
	return values
}

func (c *Map[K, V]) Keys() []K {
	keys := make([]K, 0)
	c.store.Range(func(key, value interface{}) bool {
		keys = append(keys, key.(K))
		return true
	})
	return keys
}
