package scanner

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"testing"
	"time"

	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/events"
	"kamehouse/internal/library/summary"
)

type continuityDispatcher struct {
	events.Dispatcher
	onPublish func(events.Event)
}

func (d continuityDispatcher) Publish(e events.Event) { d.onPublish(e) }

func TestScannerContinuityCancellation(t *testing.T) {
	for _, when := range []string{"before-start", "during-start"} {
		t.Run(when, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			scn := newPhaseScanner()
			scn.DirPath = t.TempDir()
			finished := false
			scn.EventDispatcher = continuityDispatcher{onPublish: func(e events.Event) {
				status := e.Payload.(map[string]any)["status"]
				if status == "START" && when == "during-start" {
					cancel()
				}
				if status == "FINISH" {
					finished = true
				}
			}}
			if when == "before-start" {
				cancel()
			}
			files, err := scn.Scan(ctx)
			if !errors.Is(err, context.Canceled) || files != nil || finished {
				t.Fatalf("canceled scan: files=%v err=%v FINISH=%v", files, err, finished)
			}
		})
	}
}

func TestScannerContinuityDisappearedAfterDiscovery(t *testing.T) {
	scn := newPhaseScanner()
	scn.DirPath = t.TempDir()
	path := filepath.Join(scn.DirPath, "Show - 01.mkv")
	writeFile(t, path, "synthetic")
	paths, roots, _ := scn.discoverFilePaths(context.Background(), time.Time{})
	if len(paths) != 1 {
		t.Fatalf("discovered %v", paths)
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if files := scn.createLocalFiles(context.Background(), paths, roots, nil); len(files) != 0 {
		t.Fatalf("disappeared file became a local file: %+v", files[0])
	}
}

func TestScannerContinuityFinalizeSkipped(t *testing.T) {
	for _, disappears := range []bool{false, true} {
		t.Run(map[bool]string{false: "present-once", true: "disappeared-not-restored"}[disappears], func(t *testing.T) {
			scn := newPhaseScanner()
			scn.ScanSummaryLogger = summary.NewScanSummaryLogger()
			dir := t.TempDir()
			path := filepath.Join(dir, "Show - 01.mkv")
			writeFile(t, path, "synthetic")
			known := dto.NewLocalFileS(path, []string{dir})
			skipped := map[string]*dto.LocalFile{known.GetNormalizedPath(): known}
			if disappears {
				if err := os.Remove(path); err != nil {
					t.Fatal(err)
				}
			}
			merged := scn.mergeSkippedFiles(nil, skipped)
			got := scn.scanFinalizePhase(merged, skipped, []string{dir}, &MediaContainer{}, &MediaFetcher{})
			want := 1
			if disappears {
				want = 0
			}
			if len(got) != want {
				t.Fatalf("finalized %d files, want %d", len(got), want)
			}
		})
	}
}

func TestScannerContinuityRootSliceIsReadOnly(t *testing.T) {
	scn := newPhaseScanner()
	dir := t.TempDir()
	roots := []string{dir, filepath.Join(dir, "nested")}
	want := append([]string(nil), roots...)
	scn.createLocalFiles(context.Background(), nil, roots, nil)
	if !reflect.DeepEqual(roots, want) {
		t.Fatalf("caller roots reordered: %v", roots)
	}
}

func TestScannerContinuityConcurrentRoots(t *testing.T) {
	dir := t.TempDir()
	roots := []string{dir, filepath.Join(dir, "nested")}
	var wg sync.WaitGroup
	start := make(chan struct{})
	for range 8 {
		wg.Go(func() {
			scn := newPhaseScanner()
			<-start
			scn.createLocalFiles(context.Background(), nil, roots, nil)
		})
	}
	close(start)
	wg.Wait()
}

func TestScannerContinuityCanceledHydration(t *testing.T) {
	scn := newPhaseScanner()
	scn.prepareScanConfig()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	files, err := scn.hydrateAndPersist(ctx, nil, nil, nil, &MediaFetcher{}, &MediaContainer{}, newScanTelemetry(nil, 256))
	if !errors.Is(err, context.Canceled) || files != nil {
		t.Fatalf("canceled hydration: files=%v err=%v", files, err)
	}
}

func TestScannerContinuityDisappearedBeforeFinalize(t *testing.T) {
	scn := newPhaseScanner()
	scn.prepareScanConfig()
	dir := t.TempDir()
	path := filepath.Join(dir, "Show - 01.mkv")
	writeFile(t, path, "synthetic")
	files := scn.createLocalFiles(context.Background(), []string{path}, []string{dir}, nil)
	if len(files) != 1 {
		t.Fatalf("created %d files", len(files))
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	got := scn.scanFinalizePhase(files, nil, []string{dir}, &MediaContainer{}, &MediaFetcher{})
	if len(got) != 0 {
		t.Fatalf("finalized a disappeared file: %+v", got[0])
	}
}

func TestScannerContinuityFinalizePreservesRemoteReference(t *testing.T) {
	scn := newPhaseScanner()
	scn.prepareScanConfig()
	remote := &dto.LocalFile{Path: "gdrive://synthetic-id/episode.mkv"}
	skipped := map[string]*dto.LocalFile{remote.GetNormalizedPath(): remote}
	for _, files := range [][]*dto.LocalFile{nil, {remote}} {
		got := scn.scanFinalizePhase(files, skipped, nil, &MediaContainer{}, &MediaFetcher{})
		if len(got) != 1 || got[0] != remote {
			t.Fatalf("remote reference lost or duplicated: %v", got)
		}
	}
}

func TestScannerContinuityFinalizeShelvesDisappearedLocked(t *testing.T) {
	scn := newPhaseScanner()
	scn.prepareScanConfig()
	scn.WithShelving = true
	dir := t.TempDir()
	path := filepath.Join(dir, "Show - 01.mkv")
	writeFile(t, path, "synthetic")
	known := dto.NewLocalFileS(path, []string{dir})
	known.Locked = true
	skipped := map[string]*dto.LocalFile{known.GetNormalizedPath(): known}
	merged := scn.mergeSkippedFiles(nil, skipped)
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	got := scn.scanFinalizePhase(merged, skipped, []string{dir}, &MediaContainer{}, &MediaFetcher{})
	if len(got) != 0 || len(scn.GetShelvedLocalFiles()) != 1 || scn.GetShelvedLocalFiles()[0] != known {
		t.Fatalf("missing locked file: active=%v shelved=%v", got, scn.GetShelvedLocalFiles())
	}
}
