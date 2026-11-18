package filecache

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRemoveAllByCancellationKeepsUnprocessedBuckets(t *testing.T) {
	c, err := NewCacher(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"a", "b"} {
		if err := os.WriteFile(filepath.Join(c.dir, name+".cache"), []byte("{}"), 0600); err != nil {
			t.Fatal(err)
		}
		c.stores[name] = &CacheStore{}
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	err = c.RemoveAllByContext(ctx, func(name string) bool {
		if name == "b.cache" {
			cancel()
		}
		return true
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("got %v", err)
	}
	if _, err := os.Stat(filepath.Join(c.dir, "a.cache")); !os.IsNotExist(err) {
		t.Fatalf("processed file still present: %v", err)
	}
	if _, exists := c.stores["a"]; exists {
		t.Fatal("processed bucket still in memory")
	}
	if _, err := os.Stat(filepath.Join(c.dir, "b.cache")); err != nil {
		t.Fatal(err)
	}
	if _, exists := c.stores["b"]; !exists {
		t.Fatal("unprocessed bucket evicted")
	}
}

func TestVideoPruneCancellationPreservesDirectories(t *testing.T) {
	c, err := NewCacher(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(c.dir, "videofiles", "hash")
	if err := os.MkdirAll(path, 0700); err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-48 * time.Hour)
	if err := os.Chtimes(path, old, old); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	freed, err := c.PruneMediastreamVideoFilesByAge(ctx, time.Hour, func(string) bool { cancel(); return false })
	if !errors.Is(err, context.Canceled) || freed != 0 {
		t.Fatalf("freed=%d err=%v", freed, err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatal(err)
	}
}
