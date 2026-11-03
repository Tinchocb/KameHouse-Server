package pretranscode

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// Directory junctions do not require the symlink privilege on Windows.
func TestDeleteDoesNotFollowOutputJunctions(t *testing.T) {
	base := t.TempDir()
	m := testManager(t, filepath.Join(base, "optimized"))
	outside := filepath.Join(base, "outside")
	if err := os.MkdirAll(outside, 0755); err != nil {
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
	junction := func(link string) {
		t.Helper()
		if out, err := exec.Command("cmd.exe", "/c", "mklink", "/J", link, outside).CombinedOutput(); err != nil {
			t.Fatalf("create temporary junction: %v: %s", err, out)
		}
	}
	junction(filepath.Join(target, "linked"))
	if err := m.Delete(hash); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(marker); err != nil {
		t.Fatalf("followed nested junction: %v", err)
	}
	junction(target)
	if err := m.Delete(hash); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(marker); err != nil {
		t.Fatalf("followed output junction: %v", err)
	}
}
