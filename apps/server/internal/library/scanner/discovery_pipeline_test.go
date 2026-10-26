package scanner

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/events"
	"kamehouse/internal/util"

	"github.com/rs/zerolog"
)

func TestDiscoveryPipelineDrainsBeyondBufferCapacity(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "Episode 01.mkv")
	info := writeFile(t, path, "video")
	scn := newPhaseScanner()
	scn.ExistingLocalFiles = []*dto.LocalFile{{
		Path: path, Name: "Episode 01.mkv", FileSize: info.Size(),
		FileModTime: info.ModTime().Unix(), ParsedData: &dto.LocalFileParsedData{},
	}}
	paths := make([]string, max(runtime.NumCPU()*2, 4)*8+1)
	for i := range paths {
		paths[i] = path
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	got := scn.createLocalFiles(ctx, paths, []string{dir}, nil)
	if err := ctx.Err(); err != nil {
		t.Fatalf("pipeline failed to drain: %v", err)
	}
	if len(got) != len(paths) {
		t.Fatalf("lost files: got %d want %d", len(got), len(paths))
	}
	for _, file := range got {
		if file.Path != path || file.FileSize != info.Size() {
			t.Fatalf("file changed: %+v", file)
		}
	}
}

func TestDiscoveryPipelineSkippedAndMissingFiles(t *testing.T) {
	dir := t.TempDir()
	keep := filepath.Join(dir, "Episode 01.mkv")
	skip := filepath.Join(dir, "Episode 02.mkv")
	writeFile(t, keep, "video")
	writeFile(t, skip, "video")
	scn := newPhaseScanner()
	got := scn.createLocalFiles(context.Background(), []string{keep, skip, filepath.Join(dir, "missing.mkv")}, []string{dir}, map[string]*dto.LocalFile{util.NormalizePath(skip): {Path: skip}})
	if len(got) != 1 || got[0].Path != keep {
		t.Fatalf("unexpected files: %+v", got)
	}
	if got := scn.createLocalFiles(context.Background(), nil, []string{dir}, nil); got == nil || len(got) != 0 {
		t.Fatalf("empty scan changed its result: %+v", got)
	}
}

func TestDiscoveryPipelineCancellationDrainsWorkers(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "Episode 01.mkv")
	writeFile(t, path, "video")
	for _, before := range []bool{true, false} {
		t.Run(map[bool]string{true: "before", false: "during"}[before], func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			scn := newPhaseScanner()
			scn.EventDispatcher = continuityDispatcher{onPublish: func(events.Event) { cancel() }}
			if before {
				cancel()
			}
			paths := make([]string, 2000)
			for i := range paths {
				paths[i] = path
			}
			done := make(chan struct{})
			go func() {
				defer close(done)
				scn.createLocalFiles(ctx, paths, []string{dir}, nil)
			}()
			select {
			case <-done:
			case <-time.After(5 * time.Second):
				t.Fatal("canceled pipeline left workers blocked")
			}
		})
	}
}

func BenchmarkCreateLocalFilesBufferedPipeline(b *testing.B) {
	dir := b.TempDir()
	path := filepath.Join(dir, "Episode 01.mkv")
	if err := os.WriteFile(path, []byte("video"), 0o600); err != nil {
		b.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil {
		b.Fatal(err)
	}
	logger := zerolog.Nop()
	scn := &Scanner{Logger: &logger, ExistingLocalFiles: []*dto.LocalFile{{
		Path: path, FileSize: info.Size(), FileModTime: info.ModTime().Unix(),
		ParsedData: &dto.LocalFileParsedData{}, Metadata: &dto.LocalFileMetadata{},
	}}}
	paths := make([]string, 4096)
	for i := range paths {
		paths[i] = path
	}
	b.ReportAllocs()
	b.ResetTimer()
	for b.Loop() {
		if got := scn.createLocalFiles(context.Background(), paths, []string{dir}, nil); len(got) != len(paths) {
			b.Fatalf("got %d files", len(got))
		}
	}
}
