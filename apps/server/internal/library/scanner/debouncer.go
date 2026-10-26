package scanner

import (
	"sync"
	"time"
)

// FileDebouncer is a thread-safe utility designed to deduplicate rapid,
// successive file system events for the same file path.
type FileDebouncer struct {
	mu     sync.Mutex
	timers map[string]*time.Timer
	closed bool
}

// NewFileDebouncer creates a new FileDebouncer instance.
func NewFileDebouncer() *FileDebouncer {
	return &FileDebouncer{
		timers: make(map[string]*time.Timer),
	}
}

// Add queues a callback to be executed after the specified delay for a given key.
// If Add is called again for the same key before the delay elapses, the timer is reset.
func (d *FileDebouncer) Add(key string, delay time.Duration, callback func()) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.closed {
		return
	}

	// If a timer already exists for this key, stop it and reset it.
	if timer, exists := d.timers[key]; exists {
		timer.Stop()
		timer.Reset(delay)
		return
	}

	// Create a new timer directly in the map
	d.timers[key] = time.AfterFunc(delay, func() {
		d.mu.Lock()
		closed := d.closed
		d.mu.Unlock()
		if closed {
			return
		}
		callback()

		// Safely remove the timer tracking after execution completes
		d.mu.Lock()
		delete(d.timers, key)
		d.mu.Unlock()
	})
}

// Close cancels pending callbacks and rejects future additions. Callbacks that
// already started may finish; callers must not rely on it to interrupt work.
func (d *FileDebouncer) Close() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.closed = true
	for key, timer := range d.timers {
		timer.Stop()
		delete(d.timers, key)
	}
}
