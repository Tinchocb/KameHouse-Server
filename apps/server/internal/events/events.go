package events

type WebsocketClientEventType string

const (
	NativePlayerEventType WebsocketClientEventType = "native-player"
)

type WebsocketClientEvent struct {
	ClientID string                   `json:"clientID"`
	Type     WebsocketClientEventType `json:"type"`
	Payload  interface{}              `json:"payload"`
}

const (
	ServerReady = "server-ready" // The platform data has been loaded

	EventScanProgress         = "scan-progress"              // Progress of the scan
	EventScanProgressDetailed = "scan-progress-detailed"     // Optional detailed scan progress (structured payload)
	EventScanStatus           = "scan-status"                // Status text of the scan
	RefreshedAnimeCollection  = "refreshed-anime-collection" // The anime collection has been refreshed

	LibraryWatcherFileAdded   = "library-watcher-file-added"   // A new file has been added to the library
	LibraryWatcherFileRemoved = "library-watcher-file-removed" // A file has been removed from the library

	AutoScanCompleted = "auto-scan-completed" // The auto scan has stopped

	PlaybackManagerProgressPlaybackState = "playback-manager-progress-playback-state" // Dispatches the current playback state

	ErrorToast   = "error-toast"
	SuccessToast = "success-toast"

	NotificationReceived = "notification-received" // A new in-app notification was created (payload: models.Notification)

	MediastreamShutdownStream = "mediastream-shutdown-stream"

	PlaybackHeartbeatProgress = "playback-heartbeat-progress" // 5-second WS heartbeat for real-time progress sync

	InvalidateQueries = "invalidate-queries"
)
