package resourcebudget

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestPreviewDoesNotWaitForPlayback(t *testing.T) {
	c := NewCoordinator(time.Hour, nil)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	live, err := c.Live(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer live()
	preview, err := c.Preview(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer preview()
	blocked, stop := context.WithTimeout(ctx, 10*time.Millisecond)
	defer stop()
	_, release, err := c.Background(blocked)
	if err == nil {
		release()
		t.Fatal("background admitted during playback/preview")
	}
	preview()
	preview()
}
func TestPreviewPreemptsBackgroundAndJoins(t *testing.T) {
	c := NewCoordinator(0, nil)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	bg, release, err := c.Background(ctx)
	if err != nil {
		t.Fatal(err)
	}
	ready := make(chan func(), 1)
	go func() { r, _ := c.Preview(ctx); ready <- r }()
	select {
	case <-bg.Done():
	case <-ctx.Done():
		t.Fatal("not preempted")
	}
	if !errors.Is(context.Cause(bg), ErrPlaybackPriority) {
		t.Fatal(context.Cause(bg))
	}
	select {
	case r := <-ready:
		if r != nil {
			r()
		}
		t.Fatal("admitted before cleanup")
	default:
	}
	release()
	r := <-ready
	if r == nil {
		t.Fatal("preview never admitted")
	}
	r()
	_, release, err = c.Background(ctx)
	if err != nil {
		t.Fatal(err)
	}
	release()
}
func TestDirectPlaybackBeatPreemptsAndExpires(t *testing.T) {
	c := NewCoordinator(30*time.Millisecond, nil)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	bg, release, _ := c.Background(ctx)
	c.NotePlayback()
	if !errors.Is(context.Cause(bg), ErrPlaybackPriority) {
		t.Fatal("direct playback did not preempt")
	}
	release()
	blocked, stop := context.WithTimeout(ctx, 5*time.Millisecond)
	defer stop()
	_, r, err := c.Background(blocked)
	if err == nil {
		r()
		t.Fatal("quiet period ignored")
	}
	// Signal after the short quiet period rather than waiting for the 1s polling tick.
	time.Sleep(35 * time.Millisecond)
	_, r, err = c.Background(ctx)
	if err != nil {
		t.Fatal(err)
	}
	r()
}
