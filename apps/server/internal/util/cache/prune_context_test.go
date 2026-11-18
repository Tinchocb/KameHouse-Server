package cache

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestPruneCanceledPreservesExpiredFiles(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "old.jpg")
	if err := os.WriteFile(path, []byte("image"), 0600); err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-48 * time.Hour)
	if err := os.Chtimes(path, old, old); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	freed, removed, err := PruneDirectoryContext(ctx, dir, ".jpg", time.Hour, 1)
	if !errors.Is(err, context.Canceled) || freed != 0 || removed != 0 {
		t.Fatalf("freed=%d removed=%d err=%v", freed, removed, err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatal(err)
	}
}
