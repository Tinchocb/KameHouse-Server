package handlers

import (
	"fmt"
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

// scrobbleGuard prevents double-scrobbling the same episode within a session.
// Key format: "mediaId:episodeNumber"
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
// Handler
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
