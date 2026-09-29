package core

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCleanupTranscodeDirsKeepsCassetteDirs(t *testing.T) {
	base := t.TempDir()
	old := time.Now().Add(-2 * time.Hour)

	for _, name := range []string{"streams", "keyframes", "legacy"} {
		dir := filepath.Join(base, name)
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(dir, old, old); err != nil {
			t.Fatal(err)
		}
	}

	cleanupTranscodeDirs(testLogger(), base)

	for _, name := range []string{"streams", "keyframes"} {
		if _, err := os.Stat(filepath.Join(base, name)); err != nil {
			t.Errorf("%s was removed: in-use segments/keyframe cache must survive", name)
		}
	}
	if _, err := os.Stat(filepath.Join(base, "legacy")); !os.IsNotExist(err) {
		t.Errorf("stale legacy dir should have been removed, stat err = %v", err)
	}
}
