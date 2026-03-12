package torrentstream

import (
	"context"
	"kamehouse/internal/videocore"
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
	if r.nativePlayer == nil {
		r.logger.Debug().Msg("Native player or VideoCore is nil, skipping torrent event subscription")
		return
	}

	videoCore := r.nativePlayer.VideoCore()
	if videoCore == nil {
		r.logger.Debug().Msg("Native player or VideoCore is nil, skipping torrent event subscription")
		return
	}

	videoCore.Unsubscribe("torrentstream")
	r.logger.Trace().Msg("torrentstream: Subscribing to video core events")
	videoCoreSubscriber := videoCore.Subscribe("torrentstream")

	go func(sub *videocore.Subscriber) {
		defer func() {
			r.logger.Trace().Msg("torrentstream: Stopping video core listener")
		}()
		for e := range sub.Events() {
			// get the player type from the event instead of the instance
			if e.GetPlayerType() != videocore.NativePlayer {
				continue
			}

			switch event := e.(type) {
			case *videocore.VideoLoadedEvent:
				r.logger.Debug().Msg("torrentstream: Native player loaded event received")
				r.playback.currentVideoDuration = 0
				if settings, ok := r.settings.Get(); ok {
					r.shouldPreloadStream.Store(settings.PreloadNextStream)
				}
			case *videocore.VideoLoadedMetadataEvent:
				go func() {
					if r.client.currentFile.IsPresent() && r.playback.currentVideoDuration == 0 {
						// If the stored video duration is 0 but the media player status shows a duration that is not 0
						// we know that the video has been loaded and is playing
						if r.playback.currentVideoDuration == 0 && event.Duration > 0 {
							// The media player has started playing the video
							r.logger.Debug().Msg("torrentstream: Media player started playing the video, sending event")
							r.sendStateEvent(eventTorrentStartedPlaying)
							// Update the stored video duration
							r.playback.currentVideoDuration = int(event.Duration)
						}
					}
				}()
			case *videocore.VideoStatusEvent:
				if event.CurrentTime/event.Duration >= 0.5 && r.shouldPreloadStream.Load() {
					r.shouldPreloadStream.Store(false)
					r.sendStateEvent(eventPreloadNextStream)
				}
			case *videocore.VideoTerminatedEvent:
				r.logger.Debug().Msg("torrentstream: Native player terminated event received")
				r.playback.currentVideoDuration = 0
				// Only handle the event if we actually have a current torrent to avoid unnecessary cleanup
				if r.client.currentTorrent.IsPresent() {
					go func() {
						defer func() {
							if rec := recover(); rec != nil {
								r.logger.Error().Msg("torrentstream: Recovered from panic in VideoTerminatedEvent handler")
							}
						}()
						r.logger.Debug().Msg("torrentstream: Stopping stream due to native player termination")
						// Stop the stream
						_ = r.StopStream()
					}()
				}
			}

		}
	}(videoCoreSubscriber)
}
