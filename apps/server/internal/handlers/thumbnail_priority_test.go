package handlers

import (
	"context"
	"errors"
	"image/jpeg"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"kamehouse/internal/core"
	"kamehouse/internal/util/resourcebudget"
)

type thumbnailWaitContext struct {
	context.Context
	waiting chan struct{}
	once    sync.Once
}

func (c *thumbnailWaitContext) Done() <-chan struct{} {
	c.once.Do(func() { close(c.waiting) })
	return c.Context.Done()
}

func TestThumbnailCacheBypassesPreviewQueueAndCancelledCallerDoesNotLoseSharedImage(t *testing.T) {
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg unavailable")
	}
	base := t.TempDir()
	src := filepath.Join(base, "source.mp4")
	fixture, err := exec.Command(ffmpeg, "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24", "-t", "2", "-c:v", "libx264", "-preset", "ultrafast", src).CombinedOutput()
	if err != nil {
		t.Fatalf("fixture: %v %s", err, fixture)
	}
	logger := zerolog.Nop()
	app := &core.App{}
	app.Logger = &logger
	app.Config = &core.Config{}
	app.Config.Cache.Dir = filepath.Join(base, "cache")
	h := &Handler{App: app}
	coordinator := resourcebudget.NewCoordinator(0, nil)
	previous := resourcebudget.Shared
	resourcebudget.Shared = coordinator
	defer func() { resourcebudget.Shared = previous }()
	hold, err := coordinator.Preview(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer hold()
	cacheDir := filepath.Join(app.Config.Cache.Dir, "thumbnails")
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		t.Fatal(err)
	}
	cached := filepath.Join(cacheDir, "already-cached.jpg")
	if err := os.WriteFile(cached, []byte("existing-image"), 0600); err != nil {
		t.Fatal(err)
	}
	hit, err := h.ensureThumbnailFile(t.Context(), src, "already-cached", nil)
	if err != nil || hit != cached {
		t.Fatalf("cache hit was blocked or lost: %s %v", hit, err)
	}

	caller, cancel := context.WithCancel(t.Context())
	defer cancel()
	waiting := &thumbnailWaitContext{Context: caller, waiting: make(chan struct{})}
	first := make(chan error, 1)
	offset := 0
	go func() { _, err := h.ensureThumbnailFile(waiting, src, "shared-priority", &offset); first <- err }()
	<-waiting.waiting
	cancel()
	if err := <-first; !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled caller: %v", err)
	}
	secondCtx, stop := context.WithTimeout(t.Context(), 5*time.Second)
	defer stop()
	type result struct {
		path string
		err  error
	}
	second := make(chan result, 1)
	go func() {
		path, err := h.ensureThumbnailFile(secondCtx, src, "shared-priority", &offset)
		second <- result{path, err}
	}()
	hold()
	got := <-second
	if got.err != nil {
		t.Fatal(got.err)
	}
	file, err := os.Open(got.path)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	cfg, err := jpeg.DecodeConfig(file)
	if err != nil || cfg.Width != 480 || cfg.Height != 270 {
		t.Fatalf("image changed or missing: %+v %v", cfg, err)
	}
	if thumbnailFailedRecently("shared-priority") {
		t.Fatal("cancelling one caller poisoned the shared image")
	}
}
