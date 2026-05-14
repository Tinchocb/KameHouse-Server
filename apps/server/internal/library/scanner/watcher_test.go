package scanner

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"kamehouse/internal/events"

	"github.com/rs/zerolog"
)

func TestWatcher_StopWatching_NoError(t *testing.T) {
	logger := zerolog.New(zerolog.NewTestWriter(t))
	wsEvents := events.NewMockWSEventManager(&logger)

	w, err := NewWatcher(&NewWatcherOptions{
		Logger:         &logger,
		WSEventManager: wsEvents,
	})
	if err != nil {
		t.Fatal("failed to create watcher:", err)
	}

	// StopWatching on a valid watcher should succeed without error
	w.StopWatching()
}

func TestWatcher_DynamicDirRegistration(t *testing.T) {
	// Create a temporary directory to watch
	tmpDir := t.TempDir()

	logger := zerolog.New(zerolog.NewTestWriter(t))
	wsEvents := events.NewMockWSEventManager(&logger)

	w, err := NewWatcher(&NewWatcherOptions{
		Logger:         &logger,
		WSEventManager: wsEvents,
	})
	if err != nil {
		t.Fatal("failed to create watcher:", err)
	}
	defer w.StopWatching()

	// Initialize watching on the tmp directory
	err = w.InitLibraryFileWatcher(&WatchLibraryFilesOptions{
		LibraryPaths: []string{tmpDir},
	})
	if err != nil {
		t.Fatal("failed to init library watcher:", err)
	}

	// Track if onFileAction was called
	actionCalled := make(chan struct{}, 10)
	w.StartWatching(func(path string) {
		actionCalled <- struct{}{}
	})

	// Create a new subdirectory — the watcher should dynamically register it
	subDir := filepath.Join(tmpDir, "New Series")
	if err := os.MkdirAll(subDir, 0o755); err != nil {
		t.Fatal("failed to create subdir:", err)
	}

	// Wait for the watcher to pick up the directory creation event
	select {
	case <-actionCalled:
		// Good — action was triggered
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for file action from directory creation")
	}

	// Now create a file in the new subdirectory — if dynamic registration works,
	// the watcher should detect this file creation too
	testFile := filepath.Join(subDir, "episode01.mkv")
	if err := os.WriteFile(testFile, []byte("test"), 0o644); err != nil {
		t.Fatal("failed to create test file:", err)
	}

	select {
	case <-actionCalled:
		// Good — action was triggered for file in dynamically-registered dir
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for file action in dynamically-registered directory")
	}
}
