package resourcebudget

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestPreviewQueueLimitDoesNotBlockLiveOrLeakOnCancel(t *testing.T) {
	c := NewCoordinator(0, nil)
	first, err := c.Preview(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer first()
	ctx, cancel := context.WithTimeout(t.Context(), 20*time.Millisecond)
	defer cancel()
	queued, err := c.Preview(ctx)
	if err == nil {
		queued()
		t.Fatal("second preview was admitted while the first was active")
	}
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatal(err)
	}
	live, err := c.Live(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	live()
	first()
	next, err := c.Preview(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	next()
	c.mu.Lock()
	previews := c.previews
	c.mu.Unlock()
	if previews != 0 {
		t.Fatalf("queued preview leaked demand: %d", previews)
	}
}

func TestPreviewBurstHasOneActiveExtraction(t *testing.T) {
	c := NewCoordinator(0, nil)
	ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
	defer cancel()
	var active, peak atomic.Int32
	var workers sync.WaitGroup
	for range 8 {
		workers.Go(func() {
			release, err := c.Preview(ctx)
			if err != nil {
				t.Error(err)
				return
			}
			n := active.Add(1)
			for old := peak.Load(); n > old; old = peak.Load() {
				if peak.CompareAndSwap(old, n) {
					break
				}
			}
			time.Sleep(5 * time.Millisecond)
			active.Add(-1)
			release()
		})
	}
	workers.Wait()
	if n := peak.Load(); n != 1 {
		t.Fatalf("active preview extractions peaked at %d, want 1", n)
	}
}
