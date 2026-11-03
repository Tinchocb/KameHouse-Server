package pretranscode

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDeleteRejectsUnsafeHashes(t *testing.T) {
	base := t.TempDir()
	m := testManager(t, filepath.Join(base, "optimized"))
	if err := os.MkdirAll(m.opts.OutputDir, 0755); err != nil {
		t.Fatal(err)
	}
	marker := filepath.Join(base, "keep")
	if err := os.WriteFile(marker, []byte("keep"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, hash := range []string{"", ".", "..", "../sibling", `..\sibling`, "/", `C:\`, "%2e%2e", strings.Repeat("a", 39), strings.Repeat("a", 41), strings.Repeat("g", 40), strings.Repeat("a", 39) + ":"} {
		t.Run(hash, func(t *testing.T) {
			if err := m.Delete(hash); err == nil {
				t.Fatalf("accepted invalid hash %q", hash)
			}
			if _, err := os.Stat(marker); err != nil {
				t.Fatalf("parent marker changed: %v", err)
			}
			if _, err := os.Stat(m.opts.OutputDir); err != nil {
				t.Fatalf("output root changed: %v", err)
			}
		})
	}
}

func TestDeleteRemovesOnlyRequestedHash(t *testing.T) {
	base := t.TempDir()
	m := testManager(t, base)
	hash, sibling := strings.Repeat("a", 40), strings.Repeat("b", 40)
	writePlaylist(t, m, hash)
	writePlaylist(t, m, sibling)
	if err := m.Delete(hash); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(base, hash)); !os.IsNotExist(err) {
		t.Fatalf("target still exists: %v", err)
	}
	if !m.IsAvailable(sibling) {
		t.Fatal("sibling was removed")
	}
	if err := m.Delete(hash); err != nil {
		t.Fatalf("repeated delete: %v", err)
	}
	missing := testManager(t, filepath.Join(base, "missing"))
	if err := missing.Delete(hash); err != nil {
		t.Fatalf("missing output root: %v", err)
	}
}

func TestDeleteDoesNotFollowOutputSymlinks(t *testing.T) {
	base := t.TempDir()
	m := testManager(t, filepath.Join(base, "optimized"))
	outside := filepath.Join(base, "outside")
	if err := os.MkdirAll(outside, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(m.opts.OutputDir, 0755); err != nil {
		t.Fatal(err)
	}
	marker := filepath.Join(outside, "keep")
	if err := os.WriteFile(marker, []byte("keep"), 0600); err != nil {
		t.Fatal(err)
	}
	hash := strings.Repeat("a", 40)
	target := filepath.Join(m.opts.OutputDir, hash)
	if err := os.MkdirAll(target, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(target, "linked")); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}
	if err := m.Delete(hash); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(marker); err != nil {
		t.Fatalf("followed nested symlink: %v", err)
	}
	if err := os.Symlink(outside, target); err != nil {
		t.Fatal(err)
	}
	if err := m.Delete(hash); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(marker); err != nil {
		t.Fatalf("followed output symlink: %v", err)
	}
}
