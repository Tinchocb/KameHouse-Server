package videocore

import (
	"context"
	"kamehouse/internal/continuity"
	"kamehouse/internal/events"
	"kamehouse/internal/mkvparser"

	"github.com/samber/lo"
)

func (vc *VideoCore) setupEffects() {
	vc.setupSharedEffects()
	vc.setupOnlinestreamEffects()
}

func (vc *VideoCore) setupSharedEffects() {
	subscriber := vc.Subscribe("videocore:shared")

	go func(subscriber *Subscriber) {
		for e := range subscriber.Events() {
			switch event := e.(type) {
			case *VideoPausedEvent:
			case *VideoResumedEvent:
			case *VideoEndedEvent:
			case *VideoLoadedMetadataEvent:
				_, ok := vc.GetPlaybackState()
				if !ok {
					continue
				}
			case *VideoErrorEvent:
			case *VideoCompletedEvent:
				state, ok := vc.GetPlaybackState()
				if !ok {
					continue
				}
				shouldUpdateProgress := false
				vc.settingsMu.RLock()
				shouldUpdateProgress = vc.settings.Library.AutoUpdateProgress
				vc.settingsMu.RUnlock()
				if shouldUpdateProgress {
					// get the list entry
					collection, err := vc.platformRef.Get().GetAnimeCollection(context.Background(), false)
					if err != nil {
						vc.logger.Error().Err(err).Msg("videocore: Cannot update progress, failed to get anime collection")
						continue
					}

					// Helper to extract properties from various media types
					var mediaId int
					var totalEpisodes *int

					// Try to extract from common types or ignore if not possible
					// This is a temporary measure until a proper Media interface is used across Videocore
					if m, ok := state.PlaybackInfo.Media.(map[string]interface{}); ok {
						if id, ok := m["id"].(float64); ok {
							mediaId = int(id)
						}
						if eps, ok := m["episodes"].(float64); ok {
							te := int(eps)
							totalEpisodes = &te
						}
					} else if m, ok := state.PlaybackInfo.Media.(interface{ GetID() int }); ok {
						mediaId = m.GetID()
					}

					progress := state.PlaybackInfo.Episode.GetProgressNumber()

					if listEntry, hasEntry := collection.GetListEntryFromAnimeId(mediaId); hasEntry {
						if listEntry.Progress != nil && progress <= *listEntry.Progress {
							continue
						}
					}

					err = vc.platformRef.Get().UpdateEntryProgress(context.Background(), mediaId, progress, totalEpisodes)
					if err != nil {
						vc.logger.Error().Err(err).Msgf("videocore: Failed to update progress for media %d", mediaId)
					}
				}
			case *VideoTerminatedEvent:
			case *VideoStatusEvent:
				state, ok := vc.GetPlaybackState()
				if !ok {
					continue
				}
				if event.Duration != 0 {
						_ = vc.continuityManager.UpdateWatchHistoryItem(&continuity.UpdateWatchHistoryItemOptions{
							CurrentTime:   event.CurrentTime,
							Duration:      event.Duration,
							MediaId: func() int {
								if m, ok := state.PlaybackInfo.Media.(interface{ GetID() int }); ok {
									return m.GetID()
								}
								// Fallback/Placeholder
								return 0
							}(),
							EpisodeNumber: state.PlaybackInfo.Episode.GetEpisodeNumber(),
							Kind:          continuity.MediastreamKind,
						})
				}


			}
		}
	}(subscriber)
}

func (vc *VideoCore) setupOnlinestreamEffects() {
	subscriber := vc.Subscribe("videocore:onlinestream")

	go func(subscriber *Subscriber) {
		for e := range subscriber.Events() {
			if !e.IsOnlinestream() && !e.IsWebPlayer() {
				continue
			}
			switch event := e.(type) {
			case *SubtitleFileUploadedEvent:
				vc.logger.Trace().Msgf("videocore: Subtitle file uploaded: %s", event.Filename)
				mkvTrack, err := vc.GenerateMkvSubtitleTrack(GenerateSubtitleFileOptions{
					Filename:  event.Filename,
					Content:   event.Content,
					Number:    0,
					ConvertTo: mkvparser.SubtitleTypeASS,
				})
				if err != nil {
					vc.wsEventManager.SendEventTo(vc.GetCurrentClientId(), events.ErrorToast, "Failed to upload subtitle file: "+err.Error())
					continue
				}
				track := &VideoSubtitleTrack{
					Index:             0,
					Src:               nil,
					Content:           &mkvTrack.CodecPrivate,
					Label:             mkvTrack.Name,
					Language:          mkvTrack.Language,
					Type:              lo.ToPtr("ass"),
					Default:           lo.ToPtr(false),
					UseLibassRenderer: nil,
				}
				vc.AddExternalSubtitleTrack(track)
				vc.logger.Debug().Msgf("videocore: Sent converted subtitle tracks")
			}
		}
	}(subscriber)
}
