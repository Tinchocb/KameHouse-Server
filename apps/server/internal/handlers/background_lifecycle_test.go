package handlers

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"kamehouse/internal/core"
)

func TestBackgroundDelayCancelsWithoutWaiting(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan bool, 1)
	go func() { done <- waitBackground(ctx, time.Hour) }()
	cancel()
	select {
	case ok := <-done:
		if ok {
			t.Fatal("cancelled delay admitted work")
		}
	case <-time.After(time.Second):
		t.Fatal("delay did not cancel")
	}
	if waitBackground(ctx, 0) {
		t.Fatal("cancelled zero delay admitted work")
	}
}

func TestRejectedHandlerWorkReleasesReservations(t *testing.T) {
	logger := zerolog.Nop()
	app := &core.App{}
	app.Logger = &logger
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	app.Cleanup(ctx)
	h := &Handler{App: app}
	// A nil DB is intentional: rejected work must not touch shared services.
	started, total, err := h.startThumbnailWarm(1, true)
	if started || total != 0 || !errors.Is(err, context.Canceled) {
		t.Fatalf("rejected warm: %t %d %v", started, total, err)
	}
	warmingMu.Lock()
	retained := isThumbnailWarming.Load() || warmingCancel != nil
	warmingMu.Unlock()
	if retained {
		t.Fatal("rejected warm retained its reservation")
	}
	ClearAnimeEntryCache()
	defer ClearAnimeEntryCache()
	_, generation := cachedAnimeEntry(404)
	h.scheduleAnimeEnrichment(404, generation)
	if _, retained := enrichmentInFlight.Load(fmt.Sprintf("%d:%d", generation, 404)); retained {
		t.Fatal("rejected enrichment retained its reservation")
	}
}
