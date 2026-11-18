package util

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWriteFileAtomicReplacementAndFailedRenameCleanup(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "cache")
	for _, data := range []string{"old", "replacement"} {
		if err := WriteFileAtomic(path, []byte(data)); err != nil {
			t.Fatal(err)
		}
		got, err := os.ReadFile(path)
		if err != nil || string(got) != data {
			t.Fatalf("got=%q err=%v", got, err)
		}
	}
	if err := WriteFileAtomic(dir, []byte("cannot replace a directory")); err == nil {
		t.Fatal("expected rename failure")
	}
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) != 1 || entries[0].Name() != "cache" {
		t.Fatalf("temporary files leaked: %v err=%v", entries, err)
	}
}
