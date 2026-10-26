package mediastream

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"kamehouse/internal/mkvsubs"
)

// Observes when a caller has actually joined the existing openCall select.
type driveOpenWaitContext struct {
	context.Context
	waiting chan struct{}
	once    sync.Once
}

func (c *driveOpenWaitContext) Done() <-chan struct{} {
	c.once.Do(func() { close(c.waiting) })
	return c.Context.Done()
}

func TestDriveWindowFirstCallerCanCancelSharedOpen(t *testing.T) {
	r := newDriveSubsRepo(t, "ffmpeg")
	started, release := make(chan struct{}), make(chan struct{})
	var releaseOnce sync.Once
	unblock := func() { releaseOnce.Do(func() { close(release) }) }
	defer unblock()
	var calls atomic.Int32
	r.SetDriveSourceFactory(func(ctx context.Context, _ string) (mkvsubs.Source, error) {
		if calls.Add(1) == 1 {
			close(started)
		}
		select {
		case <-release:
			return nil, mkvsubs.ErrNotMatroska
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	})
	path := "gdrive://shared-open/episode.mkv"
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	first := make(chan error, 1)
	go func() { _, err := r.driveWindowSession(ctx, path); first <- err }()
	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("shared open did not start")
	}
	r.driveWin.mu.Lock()
	call := r.driveWin.opening[DriveSubtitleHash(path)]
	r.driveWin.mu.Unlock()
	cancel()
	select {
	case err := <-first:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("caller cancellation lost: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("first caller cannot leave the shared open")
	}
	select {
	case <-call.done:
		t.Fatal("canceling first caller stopped the shared open")
	default:
	}
	second := make(chan error, 1)
	secondCtx := &driveOpenWaitContext{Context: context.Background(), waiting: make(chan struct{})}
	go func() { _, err := r.driveWindowSession(secondCtx, path); second <- err }()
	select {
	case <-secondCtx.waiting:
	case <-time.After(3 * time.Second):
		t.Fatal("second caller did not join the shared open")
	}
	unblock()
	select {
	case err := <-second:
		if !errors.Is(err, mkvsubs.ErrNotMatroska) {
			t.Fatalf("second caller did not receive shared result: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("second caller blocked")
	}
	if calls.Load() != 1 {
		t.Fatalf("shared open was duplicated: %d calls", calls.Load())
	}
}

func TestDriveWindowOpenPanicReleasesWaiters(t *testing.T) {
	r := newDriveSubsRepo(t, "ffmpeg")
	r.SetDriveSourceFactory(func(context.Context, string) (mkvsubs.Source, error) { panic("factory failure") })
	path := "gdrive://panic-open/episode.mkv"
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if _, err := r.driveWindowSession(ctx, path); err == nil || errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("panic did not release caller with an error: %v", err)
	}
	r.driveWin.mu.Lock()
	defer r.driveWin.mu.Unlock()
	if len(r.driveWin.opening) != 0 || len(r.driveWin.sessions) != 0 {
		t.Fatal("failed open retained an unfinished call or session")
	}
}

func TestDriveWindowCanceledCallerDoesNotStartOpen(t *testing.T) {
	r := newDriveSubsRepo(t, "ffmpeg")
	var calls atomic.Int32
	r.SetDriveSourceFactory(func(context.Context, string) (mkvsubs.Source, error) {
		calls.Add(1)
		return nil, mkvsubs.ErrNotMatroska
	})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := r.driveWindowSession(ctx, "gdrive://canceled/episode.mkv")
	if !errors.Is(err, context.Canceled) || calls.Load() != 0 {
		t.Fatalf("canceled call started work: err=%v calls=%d", err, calls.Load())
	}
}
