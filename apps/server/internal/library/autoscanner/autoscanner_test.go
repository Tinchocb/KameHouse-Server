package autoscanner

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"kamehouse/internal/util"
)

// Con Enabled=false, TriggerScan vuelve de inmediato: se testea la cola de
// Notify (filtro, agrupado y debounce) sin base de datos ni escáner real.
func newTestAutoScanner(t *testing.T, ctx context.Context, wait time.Duration) *AutoScanner {
	t.Helper()
	return New(&NewAutoScannerOptions{
		Logger:      util.NewLogger(),
		Enabled:     false,
		WaitTime:    wait,
		ShutdownCtx: ctx,
	})
}

func snapshot(as *AutoScanner) (waiting bool, pending []string) {
	as.mu.Lock()
	defer as.mu.Unlock()
	return as.waiting, append([]string(nil), as.pendingPaths...)
}

func waitUntil(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatal("condition not met in time")
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func TestNotifyIgnoresNonVideoFiles(t *testing.T) {
	as := newTestAutoScanner(t, context.Background(), time.Hour)
	dir := t.TempDir()

	as.Notify(filepath.Join(dir, "info.nfo"))
	as.Notify(filepath.Join(dir, "cover.jpg"))

	if waiting, pending := snapshot(as); waiting || len(pending) != 0 {
		t.Fatalf("non-video files must not schedule a scan: waiting=%v pending=%v", waiting, pending)
	}
}

func TestNotifyDebouncesIntoOneScan(t *testing.T) {
	as := newTestAutoScanner(t, context.Background(), 50*time.Millisecond)
	a, b := t.TempDir(), t.TempDir()

	as.Notify(filepath.Join(a, "ep01.mkv"))
	as.Notify(filepath.Join(b, "ep02.mp4"))
	as.Notify(b) // un directorio se agrega tal cual

	waiting, pending := snapshot(as)
	if !waiting {
		t.Fatal("expected a pending debounced scan")
	}
	if want := []string{a, b, b}; len(pending) != len(want) || pending[0] != a || pending[1] != b || pending[2] != b {
		t.Fatalf("pending = %v, want %v", pending, want)
	}

	// Al vencer el timer se consume la cola completa en un solo disparo.
	waitUntil(t, func() bool {
		w, p := snapshot(as)
		return !w && len(p) == 0
	})
}

func TestNotifyShutdownDropsPendingScan(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	as := newTestAutoScanner(t, ctx, time.Hour)

	as.Notify(filepath.Join(t.TempDir(), "ep01.mkv"))
	if waiting, _ := snapshot(as); !waiting {
		t.Fatal("expected a pending debounced scan")
	}

	cancel()
	waitUntil(t, func() bool {
		w, p := snapshot(as)
		return !w && len(p) == 0
	})
}
