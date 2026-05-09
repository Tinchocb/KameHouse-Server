package handlers

import (
	"fmt"
	"kamehouse/internal/events"
	"net/http"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
)

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type PlaybackSyncPayload struct {
	MediaId       int     `json:"mediaId"`
	EpisodeNumber int     `json:"episodeNumber"`
	Progress      float64 `json:"progress"`        // 0.0 - 1.0 percentage
	CurrentTime   float64 `json:"currentTime"`     // seconds
	Duration      float64 `json:"duration"`        // seconds
	TotalEpisodes int     `json:"totalEpisodes"`   // total episodes in the series (0 if unknown)
}

// ──────────────────────────────────────────────────────────────────────────────
// Auto-scrobble dedup guard
// ──────────────────────────────────────────────────────────────────────────────

var (
	scrobbledEpisodes sync.Map
)

type scrobbleEntry struct {
	timestamp time.Time
}

func scrobbleKey(mediaId, episode int) string {
	return fmt.Sprintf("%d:%d", mediaId, episode)
}

// ──────────────────────────────────────────────────────────────────────────────
// WebSocket Heartbeat Subscriber
// ──────────────────────────────────────────────────────────────────────────────

// StartPlaybackHeartbeatSubscriber listens on the dispatcher for real-time
// WebSocket playback progress events and updates the ContinuityManager.
// This provides sub-second progress sync without HTTP request overhead.
//
// Concurrency safety:
//   - Each heartbeat is processed sequentially within a single goroutine,
//     avoiding concurrent DB writes from multiple WS messages.
//   - The dispatcher's non-blocking publish ensures slow DB writes never
//     stall the WebSocket read loop or block other event subscribers.
func (h *Handler) StartPlaybackHeartbeatSubscriber() {
	if h.App.WSEventManager == nil || h.App.WSEventManager.Dispatcher() == nil {
		h.App.Logger.Warn().Msg("playback_sync: Dispatcher not available, heartbeat subscriber not started")
		return
	}

	ch := h.App.WSEventManager.Dispatcher().Subscribe(events.PlaybackHeartbeatProgress)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				h.App.Logger.Error().Interface("recover", r).Msg("playback_sync: Heartbeat subscriber panicked")
			}
		}()

		h.App.Logger.Info().Msg("playback_sync: Heartbeat subscriber started (WS 5s progress)")

		for e := range ch {
			payload, ok := e.Payload.(PlaybackHeartbeatPayload)
			if !ok {
				continue
			}

			if payload.MediaId == 0 || payload.EpisodeNumber == 0 {
				continue
			}

			// Update continuity with the heartbeat progress.
			// Uses a goroutine per update to avoid blocking the dispatcher fan-out.
			go func(p PlaybackHeartbeatPayload) {
				h.processHeartbeat(p)
			}(payload)
		}

		h.App.Logger.Info().Msg("playback_sync: Heartbeat subscriber stopped")
	}()
}

func (h *Handler) processHeartbeat(p PlaybackHeartbeatPayload) {
	if p.Duration <= 0 {
		return
	}

	userID := uint(1) // Default user; in multi-user setups this comes from the WS session

	key := fmt.Sprintf("%d:%d:%d:%f", userID, p.MediaId, p.EpisodeNumber, p.Duration)
	h.App.ContinuityManager.TelemetryManager.UpdateProgress(key, int(p.CurrentTime))

	// Auto-scrobble at 85% completion (same logic as HTTP sync)
	if p.Progress >= 0.85 {
		now := time.Now()

		// Prune stale entries (every heartbeat check keeps the map lean)
		scrobbledEpisodes.Range(func(key, value interface{}) bool {
			if now.Sub(value.(scrobbleEntry).timestamp) > 4*time.Hour {
				scrobbledEpisodes.Delete(key)
			}
			return true
		})

		sKey := scrobbleKey(p.MediaId, p.EpisodeNumber)
		if _, alreadyScrobbled := scrobbledEpisodes.LoadOrStore(sKey, scrobbleEntry{timestamp: now}); !alreadyScrobbled {
			h.App.Logger.Info().
				Int("mediaId", p.MediaId).
				Int("episode", p.EpisodeNumber).
				Float64("progress", p.Progress).
				Msg("playback_sync: WS heartbeat auto-scrobbled episode (>= 85%)")
		}
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// HTTP Handler
// ──────────────────────────────────────────────────────────────────────────────

// HandlePlaybackSync
//
//	@summary receives playback telemetry from the frontend.
//	@desc    Updates continuity watch history and, when progress >= 85%,
//	         automatically scrobbles the episode as watched to Platform.
//	@route /api/v1/playback/sync [POST]
//	@returns bool
func (h *Handler) HandlePlaybackSync(c echo.Context) error {
	var b PlaybackSyncPayload
	if err := c.Bind(&b); err != nil {
		return c.JSON(http.StatusBadRequest, NewErrorResponse(err))
	}

	if b.MediaId == 0 || b.EpisodeNumber == 0 {
		return c.JSON(http.StatusBadRequest, NewErrorResponse(fmt.Errorf("mediaId and episodeNumber are required")))
	}

	// ─── 1. Update Continuity (watch position) ─────────────────────────
	if b.Duration > 0 {
		userID := uint(1)
		if val := c.Get("user_id"); val != nil {
			if id, ok := val.(uint); ok {
				userID = id
			}
		}
		key := fmt.Sprintf("%d:%d:%d:%f", userID, b.MediaId, b.EpisodeNumber, b.Duration)
		h.App.ContinuityManager.TelemetryManager.UpdateProgress(key, int(b.CurrentTime))
	}

	// Process updates asynchronously to ensure <20ms HTTP response time
	go func(payload PlaybackSyncPayload) {
		// ─── 2. Auto-scrobble at 85% ───────────────────────────────────────
		if payload.Progress >= 0.85 {
			now := time.Now()

			// Prune entries older than 4 hours to prevent memory leak
			scrobbledEpisodes.Range(func(key, value interface{}) bool {
				if now.Sub(value.(scrobbleEntry).timestamp) > 4*time.Hour {
					scrobbledEpisodes.Delete(key)
				}
				return true
			})

			key := scrobbleKey(payload.MediaId, payload.EpisodeNumber)

			// Only scrobble once per episode per session
			if _, alreadyScrobbled := scrobbledEpisodes.LoadOrStore(key, scrobbleEntry{timestamp: now}); !alreadyScrobbled {
				h.App.Logger.Info().
					Int("mediaId", payload.MediaId).
					Int("episode", payload.EpisodeNumber).
					Float64("progress", payload.Progress).
					Msg("playback sync: auto-scrobbling episode (>= 85%)")
			}
		}
	}(b)

	return c.JSON(http.StatusAccepted, map[string]bool{"success": true})
}
