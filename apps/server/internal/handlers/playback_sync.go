package handlers

import (
	"kamehouse/internal/events"

	"github.com/labstack/echo/v4"
)

// validPlaybackBeat es fail-soft para telemetría fire-and-forget (heartbeat 5s):
// los beats sin identidad o fuera de rango se descartan en silencio en vez de
// ensuciar el historial o devolver 400 en el hot path.
func validPlaybackBeat(mediaID, episodeNumber int, currentTime, duration float64) bool {
	if mediaID <= 0 || episodeNumber < 0 {
		return false
	}
	if currentTime < 0 || duration < 0 {
		return false
	}
	if duration > 0 && currentTime > duration {
		return false
	}
	// Beat vacío (reproductor abierto sin video cargado, p. ej. archivo
	// inexistente): no aporta nada y el upsert pisaría el progreso real con 0.
	if currentTime == 0 && duration == 0 {
		return false
	}
	return true
}

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

	if !validPlaybackBeat(b.MediaID, b.EpisodeNumber, b.CurrentTime, b.Duration) {
		return h.RespondWithData(c, true)
	}

	if h.App.ContinuityManager != nil && h.App.ContinuityManager.TelemetryManager != nil {
		h.App.ContinuityManager.TelemetryManager.UpdateProgress(currentAccountID(c), b.MediaID, b.EpisodeNumber, b.CurrentTime, b.Duration)
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
	if h.App.WSEventManager == nil {
		return
	}
	dispatcher := h.App.WSEventManager.Dispatcher()
	if dispatcher == nil {
		return
	}

	ch := dispatcher.Subscribe(events.PlaybackHeartbeatProgress)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				h.App.Logger.Error().Interface("panic", r).Msg("playback_sync: panic in playback heartbeat subscriber")
			}
		}()
		for {
			select {
			case <-h.App.ShutdownCtx().Done():
				return
			case event, ok := <-ch:
				if !ok {
					return
				}
				heartbeat, ok := event.Payload.(PlaybackHeartbeatPayload)
				if !ok {
					continue
				}

				if !validPlaybackBeat(heartbeat.MediaID, heartbeat.EpisodeNumber, heartbeat.CurrentTime, heartbeat.Duration) {
					continue
				}

				if h.App.ContinuityManager == nil || h.App.ContinuityManager.TelemetryManager == nil {
					continue
				}

				// Los eventos WS no traen contexto HTTP: cuenta local.
				h.App.ContinuityManager.TelemetryManager.UpdateProgress(localAccountID, heartbeat.MediaID, heartbeat.EpisodeNumber, heartbeat.CurrentTime, heartbeat.Duration)
			}
		}
	}()
}
