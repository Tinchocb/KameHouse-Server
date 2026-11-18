package resourcebudget

import (
	"context"
	"errors"
	"sync"
	"time"
)

var ErrPlaybackPriority = errors.New("background encode interrupted for playback")

// Shared spans transcoder rebuilds and all pretranscode managers in this process.
var Shared = NewCoordinator(15*time.Second, BackgroundAllowed)

type Coordinator struct {
	mu            sync.Mutex
	live          int
	previews      int
	previewActive bool
	background    context.CancelCauseFunc
	changed       chan struct{}
	idleAfter     time.Time
	quiet         time.Duration
	allowed       func() bool
}

func NewCoordinator(quiet time.Duration, allowed func() bool) *Coordinator {
	return &Coordinator{changed: make(chan struct{}), quiet: quiet, allowed: allowed}
}

func (c *Coordinator) signal() { close(c.changed); c.changed = make(chan struct{}) }

func (c *Coordinator) releaseLive() func() {
	var once sync.Once
	return func() {
		once.Do(func() {
			c.mu.Lock()
			defer c.mu.Unlock()
			c.live--
			if c.live == 0 {
				c.idleAfter = time.Now().Add(c.quiet)
			}
			c.signal()
		})
	}
}

// TryLive is for speculative segments: they must not interrupt background work.
func (c *Coordinator) TryLive() (func(), bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.background != nil {
		return nil, false
	}
	c.live++
	return c.releaseLive(), true
}

// Live announces demand before waiting for background cleanup. Cancellation
// releases that demand too, so disconnected requests cannot starve the queue.
func (c *Coordinator) Live(ctx context.Context) (func(), error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	c.mu.Lock()
	c.live++
	if c.background != nil {
		c.background(ErrPlaybackPriority)
	}
	c.signal()
	c.mu.Unlock()
	release := c.releaseLive()
	for {
		c.mu.Lock()
		ready, changed := c.background == nil, c.changed
		c.mu.Unlock()
		if err := ctx.Err(); err != nil {
			release()
			return nil, err
		}
		if ready {
			return release, nil
		}
		select {
		case <-ctx.Done():
			release()
			return nil, ctx.Err()
		case <-changed:
		}
	}
}

// Background grants one cancellable lease only after playback has been idle.
// The caller must finish subprocess cleanup before releasing it.
func (c *Coordinator) Background(ctx context.Context) (context.Context, func(), error) {
	for {
		if err := ctx.Err(); err != nil {
			return nil, nil, err
		}
		allowed := c.allowed == nil || c.allowed()
		c.mu.Lock()
		if allowed && c.live == 0 && c.previews == 0 && c.background == nil && !time.Now().Before(c.idleAfter) {
			child, cancel := context.WithCancelCause(ctx)
			c.background = cancel
			c.mu.Unlock()
			var once sync.Once
			return child, func() {
				once.Do(func() {
					cancel(nil)
					c.mu.Lock()
					defer c.mu.Unlock()
					c.background = nil
					c.signal()
				})
			}, nil
		}
		changed := c.changed
		c.mu.Unlock()
		timer := time.NewTimer(time.Second)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, nil, ctx.Err()
		case <-changed:
		case <-timer.C:
		}
		timer.Stop()
	}
}

// NotePlayback also covers direct playback, which has no live encoder lease.
// Repeated progress beats extend the quiet period without retaining a lease
// indefinitely when a browser disconnects.
func (c *Coordinator) NotePlayback() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.idleAfter = time.Now().Add(c.quiet)
	if c.background != nil {
		c.background(ErrPlaybackPriority)
	}
	c.signal()
}

// Preview admits one short, low-priority frame extraction alongside playback.
// It preempts bulk background work but never waits for a live encoder to finish.
// Callers must bound extraction time and release only after subprocess cleanup.
func (c *Coordinator) Preview(ctx context.Context) (func(), error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	c.mu.Lock()
	c.previews++
	if c.background != nil {
		c.background(ErrPlaybackPriority)
	}
	c.signal()
	c.mu.Unlock()
	var once sync.Once
	admitted := false
	release := func() {
		once.Do(func() {
			c.mu.Lock()
			defer c.mu.Unlock()
			c.previews--
			if admitted {
				c.previewActive = false
			}
			c.signal()
		})
	}
	for {
		c.mu.Lock()
		ready, changed := c.background == nil && !c.previewActive, c.changed
		if ready {
			c.previewActive = true
			admitted = true
		}
		c.mu.Unlock()
		if err := ctx.Err(); err != nil {
			release()
			return nil, err
		}
		if ready {
			return release, nil
		}
		select {
		case <-ctx.Done():
			release()
			return nil, ctx.Err()
		case <-changed:
		}
	}
}
