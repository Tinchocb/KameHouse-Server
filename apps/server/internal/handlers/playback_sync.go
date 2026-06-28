package handlers

import (
	"kamehouse/internal/events"

	"github.com/labstack/echo/v4"
)

// HandlePlaybackSync ...
//
//	@summary receives playback telemetry from the frontend.
//	@desc    Updates continuity watch history and, when progress >= 85%,
//	         automatically scrobbles the episode as watched to Platform.
//	@route /api/v1/playback/sync [POST]
//	@returns bool
func (h *Handler) HandlePlaybackSync(c echo.Context) error {
	var b PlaybackHeartbeatPayload
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	if h.App.ContinuityManager != nil && h.App.ContinuityManager.TelemetryManager != nil {
		accountID := uint(0)
		if acc, err := h.App.Database.GetAccount(); err == nil && acc != nil {
			accountID = acc.ID
		}
		h.App.ContinuityManager.TelemetryManager.UpdateProgress(accountID, b.MediaID, b.EpisodeNumber, b.CurrentTime, b.Duration)
	}

	return h.RespondWithData(c, true)
}

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
	dispatcher := h.App.WSEventManager.Dispatcher()
	if dispatcher == nil {
		return
	}

	ch := dispatcher.Subscribe(events.PlaybackHeartbeatProgress)

	go func() {
		for event := range ch {
			heartbeat, ok := event.Payload.(PlaybackHeartbeatPayload)
			if !ok {
				continue
			}

			if h.App.ContinuityManager == nil || h.App.ContinuityManager.TelemetryManager == nil {
				continue
			}

			accountID := uint(0)
			if acc, err := h.App.Database.GetAccount(); err == nil && acc != nil {
				accountID = acc.ID
			}

			h.App.ContinuityManager.TelemetryManager.UpdateProgress(accountID, heartbeat.MediaID, heartbeat.EpisodeNumber, heartbeat.CurrentTime, heartbeat.Duration)
		}
	}()
}
