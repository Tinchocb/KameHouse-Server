package handlers

import (
	"kamehouse/internal/continuity"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
)

func TestCurrentAccountID(t *testing.T) {
	newCtx := func() echo.Context {
		return echo.New().NewContext(httptest.NewRequest("GET", "/", nil), httptest.NewRecorder())
	}

	if got := currentAccountID(nil); got != localAccountID {
		t.Errorf("nil ctx = %d, want %d", got, localAccountID)
	}
	if got := currentAccountID(newCtx()); got != localAccountID {
		t.Errorf("sin user_id = %d, want %d", got, localAccountID)
	}

	c := newCtx()
	c.Set("user_id", uint(7))
	if got := currentAccountID(c); got != 7 {
		t.Errorf("user_id=7 -> %d", got)
	}

	c = newCtx()
	c.Set("user_id", uint(0))
	if got := currentAccountID(c); got != localAccountID {
		t.Errorf("user_id=0 debe caer a la cuenta local, got %d", got)
	}

	c = newCtx()
	c.Set("user_id", 7) // int, no uint
	if got := currentAccountID(c); got != localAccountID {
		t.Errorf("user_id de tipo incorrecto debe ignorarse, got %d", got)
	}
}

func TestContinueWatchingHistory(t *testing.T) {
	base := time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC)
	wh := continuity.WatchHistory{
		10: {MediaID: 10, EpisodeNumber: 3, CurrentTime: 300, Duration: 1400, TimeUpdated: base},
		20: {MediaID: 20, EpisodeNumber: 1, CurrentTime: 50, Duration: 1400, TimeUpdated: base.Add(time.Minute)},
		// Basura de pruebas: beat vacío (0/0), debe descartarse.
		30: {MediaID: 30, EpisodeNumber: 0, CurrentTime: 0, Duration: 0, TimeUpdated: base.Add(time.Hour)},
		40: nil,
	}

	got := continueWatchingHistory(wh, 5)
	if len(got) != 2 {
		t.Fatalf("len = %d, want 2 (%+v)", len(got), got)
	}
	if got[0].MediaID != 20 || got[1].MediaID != 10 {
		t.Errorf("orden por recencia incorrecto: %d, %d", got[0].MediaID, got[1].MediaID)
	}
	for _, r := range got {
		if r.AccountID != 5 {
			t.Errorf("media %d con account %d, want 5", r.MediaID, r.AccountID)
		}
	}
	if got[1].EpisodeNumber != 3 || got[1].CurrentTime != 300 || got[1].Duration != 1400 {
		t.Errorf("campos no copiados: %+v", got[1])
	}
}

func TestContinueWatchingHistoryLimit(t *testing.T) {
	base := time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC)
	wh := continuity.WatchHistory{}
	for i := 1; i <= continueWatchingMaxItems+5; i++ {
		wh[i] = &continuity.WatchHistoryItem{MediaID: i, EpisodeNumber: 1, CurrentTime: 10, Duration: 100, TimeUpdated: base.Add(time.Duration(i) * time.Second)}
	}
	got := continueWatchingHistory(wh, localAccountID)
	if len(got) != continueWatchingMaxItems {
		t.Fatalf("len = %d, want %d", len(got), continueWatchingMaxItems)
	}
	if got[0].MediaID != continueWatchingMaxItems+5 {
		t.Errorf("primero debe ser el más reciente, got %d", got[0].MediaID)
	}
}
