package core

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"kamehouse/internal/maintenance"
)

func cleanupTestApp() *App {
	logger := zerolog.Nop()
	ctx, cancel := context.WithCancel(context.Background())
	return &App{CoreServices: CoreServices{Logger: &logger}, shutdownCtx: ctx, shutdownCancel: cancel}
}

func waitCleanup(t *testing.T, done <-chan struct{}) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("cleanup did not complete")
	}
}

func TestCleanupDeadlineIncludesWatcherStop(t *testing.T) {
	a := cleanupTestApp()
	a.libraryWatcher.mu.Lock() // Model a watcher operation currently holding the publication lock.
	var unlock sync.Once
	defer unlock.Do(a.libraryWatcher.mu.Unlock)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	returned := make(chan struct{})
	go func() { a.Cleanup(ctx); close(returned) }()
	waitCleanup(t, returned)
	if a.ShutdownCtx().Err() == nil {
		t.Fatal("shutdown did not cancel app work")
	}
	unlock.Do(a.libraryWatcher.mu.Unlock)
	waitCleanup(t, a.cleanupDone)
}

func TestCleanupJoinsTasksAndRunsCallbacksOnce(t *testing.T) {
	a := cleanupTestApp()
	started, release := make(chan struct{}), make(chan struct{})
	var unlock sync.Once
	defer unlock.Do(func() { close(release) })
	a.startBackground(func() { close(started); <-a.ShutdownCtx().Done(); <-release })
	waitCleanup(t, started)
	var callbacks atomic.Int32
	a.AddCleanupFunction(func() { callbacks.Add(1) })
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	a.Cleanup(ctx)
	cancel()
	if callbacks.Load() != 0 {
		t.Fatal("cleanup closed resources before background work finished")
	}
	var late atomic.Bool
	a.startBackground(func() { late.Store(true) })
	unlock.Do(func() { close(release) })
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			a.Cleanup(ctx)
		}()
	}
	wg.Wait()
	if callbacks.Load() != 1 || late.Load() {
		t.Fatal("cleanup duplicated callbacks or admitted new work")
	}
}

func TestCleanupWaitsForMaintenanceAndSurvivesCallbackPanic(t *testing.T) {
	a := cleanupTestApp()
	scheduler := maintenance.NewScheduler(a.Logger)
	started, release := make(chan struct{}), make(chan struct{})
	var unlock sync.Once
	defer unlock.Do(func() { close(release) })
	scheduler.Add(maintenance.Job{Name: "blocked", Interval: time.Millisecond, Run: func(ctx context.Context) { close(started); <-ctx.Done(); <-release }})
	a.maintenanceScheduler = scheduler
	scheduler.Start(a.ShutdownCtx())
	waitCleanup(t, started)
	var closed atomic.Bool
	a.AddCleanupFunction(func() { panic("synthetic cleanup failure") })
	a.AddCleanupFunction(func() { closed.Store(true) })
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	a.Cleanup(ctx)
	cancel()
	if closed.Load() {
		t.Fatal("maintenance was not joined")
	}
	unlock.Do(func() { close(release) })
	waitCleanup(t, a.cleanupDone)
	if !closed.Load() {
		t.Fatal("panic skipped subsequent cleanup callbacks")
	}
}
