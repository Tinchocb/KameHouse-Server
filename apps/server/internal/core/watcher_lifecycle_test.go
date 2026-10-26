package core

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/rs/zerolog"
	"kamehouse/internal/events"
	"kamehouse/internal/library/scanner"
)

func watcherTestApp(t *testing.T) *App {
	t.Helper()
	l := zerolog.Nop()
	a := &App{CoreServices: CoreServices{Logger: &l, WSEventManager: events.NewWSEventManager(&l, nil, context.Background())}}
	t.Cleanup(a.stopLibraryWatcher)
	return a
}

func testLibraryWatcher(t *testing.T, a *App, dir string) *scanner.Watcher {
	t.Helper()
	w, err := scanner.NewWatcher(&scanner.NewWatcherOptions{Logger: a.Logger, WSEventManager: a.WSEventManager})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(w.StopWatching)
	if err := w.InitLibraryFileWatcher(&scanner.WatchLibraryFilesOptions{LibraryPaths: []string{dir}}); err != nil {
		t.Fatal(err)
	}
	return w
}

func assertLibraryWatcherClosed(t *testing.T, w *scanner.Watcher, dir string) {
	t.Helper()
	if err := w.Watcher.Add(dir); !errors.Is(err, fsnotify.ErrClosed) {
		t.Fatalf("watcher not closed: %v", err)
	}
}

func waitWatcherTest(t *testing.T, done <-chan struct{}) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatal("watcher initialization timed out")
	}
}

func TestLibraryWatcherLateInitializationCannotReplaceNewer(t *testing.T) {
	a := watcherTestApp(t)
	dir := t.TempDir()
	late, latest := testLibraryWatcher(t, a, dir), testLibraryWatcher(t, a, dir)
	first, _ := a.beginLibraryWatcherRefresh()
	started, release, done := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var releaseOnce sync.Once
	defer releaseOnce.Do(func() { close(release) })
	go func() {
		defer close(done)
		a.initializeLibraryWatcher(first, []string{dir}, func([]string) (*scanner.Watcher, uint64, error) { close(started); <-release; return late, 111, nil })
	}()
	waitWatcherTest(t, started)
	second, _ := a.beginLibraryWatcherRefresh()
	a.initializeLibraryWatcher(second, []string{dir}, func([]string) (*scanner.Watcher, uint64, error) { return latest, 222, nil })
	releaseOnce.Do(func() { close(release) })
	waitWatcherTest(t, done)
	if a.Watcher != latest || a.GetTotalLibrarySize() != 222 {
		t.Fatal("late initialization replaced current watcher or size")
	}
	assertLibraryWatcherClosed(t, late, dir)
	if err := latest.Watcher.Add(dir); err != nil {
		t.Fatalf("current watcher closed: %v", err)
	}
	a.stopLibraryWatcher()
	assertLibraryWatcherClosed(t, latest, dir)
}

func TestLibraryWatcherInvalidationClosesPendingResult(t *testing.T) {
	for _, reason := range []string{"disabled", "no paths", "shutdown"} {
		t.Run(reason, func(t *testing.T) {
			a := watcherTestApp(t)
			dir := t.TempDir()
			pending := testLibraryWatcher(t, a, dir)
			generation, _ := a.beginLibraryWatcherRefresh()
			started, release, done := make(chan struct{}), make(chan struct{}), make(chan struct{})
			var releaseOnce sync.Once
			defer releaseOnce.Do(func() { close(release) })
			go func() {
				defer close(done)
				a.initializeLibraryWatcher(generation, []string{dir}, func([]string) (*scanner.Watcher, uint64, error) { close(started); <-release; return pending, 99, nil })
			}()
			waitWatcherTest(t, started)
			switch reason {
			case "disabled":
				a.refreshLibraryWatcher([]string{dir}, false)
			case "no paths":
				a.refreshLibraryWatcher(nil, true)
			case "shutdown":
				a.stopLibraryWatcher()
			}
			releaseOnce.Do(func() { close(release) })
			waitWatcherTest(t, done)
			if a.Watcher != nil || a.GetTotalLibrarySize() != 0 {
				t.Fatal("invalidated initialization published")
			}
			assertLibraryWatcherClosed(t, pending, dir)
			if reason == "shutdown" {
				if _, open := a.beginLibraryWatcherRefresh(); open {
					t.Fatal("shutdown permitted another refresh")
				}
			}
		})
	}
}

func TestLibraryWatcherConcurrentPublicationAndSizeReads(t *testing.T) {
	a := watcherTestApp(t)
	dir := t.TempDir()
	const count = 8
	watchers := make([]*scanner.Watcher, count)
	var wg sync.WaitGroup
	ready, release := make(chan struct{}, count), make(chan struct{})
	for i := range count {
		watchers[i] = testLibraryWatcher(t, a, dir)
		generation, _ := a.beginLibraryWatcherRefresh()
		wg.Go(func() {
			a.initializeLibraryWatcher(generation, []string{dir}, func([]string) (*scanner.Watcher, uint64, error) {
				ready <- struct{}{}
				<-release
				return watchers[i], uint64(i + 1), nil
			})
		})
	}
	for range count {
		select {
		case <-ready:
		case <-time.After(10 * time.Second):
			close(release)
			t.Fatal("initializers not ready")
		}
	}
	for range count {
		wg.Go(func() {
			for range 1000 {
				_ = a.GetTotalLibrarySize()
			}
		})
	}
	close(release)
	wg.Wait()
	if a.GetTotalLibrarySize() != count || a.Watcher != watchers[count-1] {
		t.Fatal("last scheduled refresh did not win")
	}
	for _, w := range watchers[:count-1] {
		assertLibraryWatcherClosed(t, w, dir)
	}
}

func TestLibraryWatcherReplacementAndBuildFailureCloseResources(t *testing.T) {
	a := watcherTestApp(t)
	dir := t.TempDir()
	previous := testLibraryWatcher(t, a, dir)
	first, _ := a.beginLibraryWatcherRefresh()
	a.initializeLibraryWatcher(first, []string{dir}, func([]string) (*scanner.Watcher, uint64, error) { return previous, 12, nil })
	next, _ := a.beginLibraryWatcherRefresh()
	assertLibraryWatcherClosed(t, previous, dir)
	failed := testLibraryWatcher(t, a, dir)
	a.initializeLibraryWatcher(next, []string{dir}, func([]string) (*scanner.Watcher, uint64, error) {
		return failed, 0, errors.New("initialization failed")
	})
	assertLibraryWatcherClosed(t, failed, dir)
	if a.Watcher != nil {
		t.Fatal("failed initialization published watcher")
	}
}

func TestLibraryWatcherBuildPublishesDirectorySize(t *testing.T) {
	a := watcherTestApp(t)
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "size.txt"), []byte("12345"), 0600); err != nil {
		t.Fatal(err)
	}
	generation, _ := a.beginLibraryWatcherRefresh()
	a.initializeLibraryWatcher(generation, []string{dir}, a.buildLibraryWatcher)
	t.Cleanup(a.stopLibraryWatcher)
	if a.GetTotalLibrarySize() != 5 {
		t.Fatalf("size=%d, want 5", a.GetTotalLibrarySize())
	}
}
