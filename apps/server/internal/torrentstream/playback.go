package torrentstream

import (
	"context"
)

type (
	playback struct {
		mediaPlayerCtxCancelFunc context.CancelFunc
		// Stores the video duration returned by the media player
		// When this is greater than 0, the video is considered to be playing
		currentVideoDuration int
	}
)

func (r *Repository) listenToNativePlayerEvents() {
}
