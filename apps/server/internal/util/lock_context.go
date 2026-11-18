package util

import (
	"context"
	"sync"
	"time"
)

// LockContext acquires mu or returns the cancellation error. On error the
// caller owns no lock. Poll only on contention; no helper goroutine is left
// waiting on a mutex after the request has gone away.
func LockContext(ctx context.Context, mu *sync.Mutex) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if mu.TryLock() {
		return nil
	}
	ticker := time.NewTicker(5 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if mu.TryLock() {
				if err := ctx.Err(); err != nil {
					mu.Unlock()
					return err
				}
				return nil
			}
		}
	}
}
