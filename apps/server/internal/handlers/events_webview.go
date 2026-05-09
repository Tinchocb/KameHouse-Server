package handlers

import (
	"kamehouse/internal/events"
)

// PlaybackHeartbeatPayload is the payload sent by the frontend every 5 seconds.
type PlaybackHeartbeatPayload struct {
	EventType     string  `json:"eventType"`
	MediaId       int     `json:"mediaId"`
	EpisodeNumber int     `json:"episodeNumber"`
	CurrentTime   float64 `json:"currentTime"`
	Duration      float64 `json:"duration"`
	Progress      float64 `json:"progress"`
}

func (h *Handler) HandleClientEvents(event *events.WebsocketClientEvent) {

	// ─── Playback Heartbeat via WebSocket ─────────────────────────────────
	// Process incoming native-player heartbeat events for real-time progress sync.
	if event.Type == events.NativePlayerEventType {
		if payload, ok := event.Payload.(map[string]interface{}); ok {
			if eventType, ok := payload["eventType"]; ok && eventType == events.PlaybackHeartbeatProgress {
				heartbeat := PlaybackHeartbeatPayload{
					EventType: events.PlaybackHeartbeatProgress,
				}
				if v, ok := payload["mediaId"].(float64); ok {
					heartbeat.MediaId = int(v)
				}
				if v, ok := payload["episodeNumber"].(float64); ok {
					heartbeat.EpisodeNumber = int(v)
				}
				if v, ok := payload["currentTime"].(float64); ok {
					heartbeat.CurrentTime = v
				}
				if v, ok := payload["duration"].(float64); ok {
					heartbeat.Duration = v
				}
				if v, ok := payload["progress"].(float64); ok {
					heartbeat.Progress = v
				}

				// Publish through the dispatcher for concurrent-safe processing.
				// Subscribers (e.g. playback_sync, continuity) can listen on this topic
				// without blocking the WebSocket read loop.
				if h.App.WSEventManager != nil && h.App.WSEventManager.Dispatcher() != nil {
					h.App.WSEventManager.Dispatcher().Publish(events.Event{
						Topic:   events.PlaybackHeartbeatProgress,
						Payload: heartbeat,
					})
				}

				return
			}
		}
	}

	if h.App.WSEventManager != nil {
		h.App.WSEventManager.OnClientEvent(event)
	}
}
