package handlers

import (
	"kamehouse/internal/events"
	"kamehouse/internal/util/resourcebudget"
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
		defer dispatcher.Unsubscribe(events.PlaybackHeartbeatProgress, ch)
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
				resourcebudget.Shared.NotePlayback()

				if h.App.ContinuityManager == nil || h.App.ContinuityManager.TelemetryManager == nil {
					continue
				}

				// Los eventos WS no traen contexto HTTP: cuenta local.
				h.App.ContinuityManager.TelemetryManager.UpdateProgress(localAccountID, heartbeat.MediaID, heartbeat.EpisodeNumber, heartbeat.CurrentTime, heartbeat.Duration)
			}
		}
	}()
}
