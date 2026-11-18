package core

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/rs/zerolog"
)

func TestCanceledLogTrimPreservesOldLogs(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"KameHouse-old.log", "KameHouse-current.log"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("log"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	path := filepath.Join(dir, "KameHouse-old.log")
	old := time.Now().Add(-30 * 24 * time.Hour)
	if err := os.Chtimes(path, old, old); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	logger := zerolog.Nop()
	TrimLogEntriesContext(ctx, dir, &logger)
	if _, err := os.Stat(path); err != nil {
		t.Fatal(err)
	}
}
