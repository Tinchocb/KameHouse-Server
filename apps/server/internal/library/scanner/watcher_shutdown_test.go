package scanner

import (
	"testing"
	"time"

	"github.com/rs/zerolog"
)

func TestWatcherStopCancelsPendingActions(t *testing.T) {
	l := zerolog.Nop()
	w, err := NewWatcher(&NewWatcherOptions{Logger: &l})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(w.StopWatching)
	called := make(chan struct{}, 2)
	w.Debouncer.Add("pending", 30*time.Millisecond, func() { called <- struct{}{} })
	w.StopWatching()
	// A shutdown watcher must also reject timers queued by a last filesystem event.
	w.Debouncer.Add("late", 30*time.Millisecond, func() { called <- struct{}{} })
	select {
	case <-called:
		t.Fatal("stopped watcher dispatched a delayed action")
	case <-time.After(150 * time.Millisecond):
	}
}
