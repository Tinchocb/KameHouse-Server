package core

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLibraryWatcherEnabledRefreshActuallyStarts(t *testing.T) {
	a := watcherTestApp(t)
	dir := t.TempDir()
	t.Cleanup(a.stopLibraryWatcher)
	if err := os.WriteFile(filepath.Join(dir, "size.txt"), []byte("12345"), 0600); err != nil {
		t.Fatal(err)
	}
	a.refreshLibraryWatcher([]string{dir}, true)
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if a.GetTotalLibrarySize() == 5 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("enabled refresh never initialized the library watcher")
}
