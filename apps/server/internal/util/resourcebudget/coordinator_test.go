package resourcebudget

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestPlaybackPreemptsBackgroundAndWaitsForCleanup(t *testing.T) {
	c := NewCoordinator(0, nil)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	bg, releaseBG, err := c.Background(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer releaseBG()
	if release, ok := c.TryLive(); ok {
		release()
		t.Fatal("speculation interrupted background")
	}
	ready := make(chan func(), 1)
	go func() { r, _ := c.Live(ctx); ready <- r }()
	select {
	case <-bg.Done():
	case <-ctx.Done():
		t.Fatal("background was not cancelled")
	}
	if !errors.Is(context.Cause(bg), ErrPlaybackPriority) {
		t.Fatal(context.Cause(bg))
	}
	select {
	case r := <-ready:
		if r != nil {
			r()
		}
		t.Fatal("live admitted before cleanup")
	default:
	}
	releaseBG()
	var releaseLive func()
	select {
	case releaseLive = <-ready:
	case <-ctx.Done():
		t.Fatal("live blocked after cleanup")
	}
	if releaseLive == nil {
		t.Fatal("live cancelled")
	}
	defer releaseLive()
	waitCtx, stop := context.WithCancel(ctx)
	stop()
	if _, _, err := c.Background(waitCtx); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	releaseLive()
	releaseLive() // idempotence
	_, releaseNext, err := c.Background(ctx)
	if err != nil {
		t.Fatal(err)
	}
	releaseNext()
}

func TestCancelledLiveDemandDoesNotLeak(t *testing.T) {
	c := NewCoordinator(0, nil)
	bg, releaseBG, _ := c.Background(context.Background())
	defer releaseBG()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	result := make(chan error, 1)
	go func() {
		r, err := c.Live(ctx)
		if r != nil {
			r()
		}
		result <- err
	}()
	select {
	case <-bg.Done():
	case <-ctx.Done():
		t.Fatal("no live demand")
	}
	cancel()
	if err := <-result; !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled admission: %v", err)
	}
	releaseBG()
	c.mu.Lock()
	live := c.live
	c.mu.Unlock()
	if live != 0 {
		t.Fatal("leaked live demand", live)
	}
}

func TestBackgroundHonorsPressureAndQuietPeriod(t *testing.T) {
	for _, c := range []*Coordinator{
		NewCoordinator(0, func() bool { return false }),
		NewCoordinator(time.Hour, nil),
	} {
		r, _ := c.Live(context.Background())
		r()
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
		_, release, err := c.Background(ctx)
		cancel()
		if err == nil {
			release()
			t.Fatal("background admitted under pressure or cooldown")
		}
	}
}
