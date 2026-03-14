package torrentstream

type TorrentStatus struct {
	ProgressPercentage float64
}

const (
	eventTorrentStartedPlaying = "started"
	eventTorrentStopped        = "stopped"
	eventTorrentLoaded         = "loaded"
	eventLoadingFailed        = "failed"
	TLSStateSendingStreamToMediaPlayer TLSState = "sending_to_player"
)
