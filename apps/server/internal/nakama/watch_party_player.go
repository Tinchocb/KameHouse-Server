package nakama

import (
	"kamehouse/internal/util"
	"kamehouse/internal/util/result"
	"kamehouse/internal/videocore"
	"sync"

	"go.uber.org/atomic"
)

// WatchPartyGenericPlayerType is the type of player that the WatchPartyGenericPlayer is actively using.
type WatchPartyGenericPlayerType string

const (
	WatchPartyVideoCore WatchPartyGenericPlayerType = "videocore"
)

// WatchPartyGenericPlayer is a player-agnostic interface for controlling
// the videocore.VideoCore.
type WatchPartyGenericPlayer struct {
	manager       *Manager
	current       atomic.String
	defaultPlayer atomic.String
	subscribers   *result.Map[string, *WatchPartyPlaybackSubscriber]
}

func NewWatchPartyGenericPlayer(manager *Manager) *WatchPartyGenericPlayer {
	ret := &WatchPartyGenericPlayer{
		manager:     manager,
		subscribers: result.NewMap[string, *WatchPartyPlaybackSubscriber](),
	}
	ret.defaultPlayer.Store(string(WatchPartyVideoCore))
	ret.current.Store("")
	return ret
}

// SetType sets the current player type.
func (m *WatchPartyGenericPlayer) SetType(t WatchPartyGenericPlayerType) {
	m.current.Store(string(t))
}

// SetDefaultType sets the default player type.
// It is called periodically in NewManager to update the default player type (Video Playback setting) used by the client.
func (m *WatchPartyGenericPlayer) SetDefaultType(t WatchPartyGenericPlayerType) {
	m.defaultPlayer.Store(string(t))
}

func (m *WatchPartyGenericPlayer) getCurrentType() WatchPartyGenericPlayerType {
	if m.current.Load() != "" {
		return WatchPartyGenericPlayerType(m.current.Load())
	}
	return WatchPartyGenericPlayerType(m.defaultPlayer.Load())
}

func (m *WatchPartyGenericPlayer) Reset() {
	m.current.Store("")
}

// PullStatus returns the current playback status of whatever media player is currently in use.
// For videocore.VideoCore it'll return the last known status.
func (m *WatchPartyGenericPlayer) PullStatus() (*WatchPartyPlaybackStatus, bool) {
	// VideoCore
	status, ok := m.manager.videoCore.PullStatus()
	if !ok {
		return nil, false
	}

	return &WatchPartyPlaybackStatus{
		Paused:      status.Paused,
		CurrentTime: status.CurrentTime,
		Duration:    status.Duration,
	}, true
}

func (m *WatchPartyGenericPlayer) Pause() {
	m.manager.videoCore.Pause()
}

func (m *WatchPartyGenericPlayer) Resume() {
	m.manager.videoCore.Resume()
}

func (m *WatchPartyGenericPlayer) Cancel() {
	defer m.Reset()
	m.manager.videoCore.Terminate()
}

func (m *WatchPartyGenericPlayer) SeekTo(time float64) {
	m.manager.videoCore.SeekTo(time)
}

type (
	WatchPartyPlaybackEvent interface {
		IsWatchPartyPlaybackEvent() bool
		Type() string
	}
	WatchPartyPlaybackSubscriber struct {
		id                  string
		EventCh             chan WatchPartyPlaybackEvent
		closeOnce           sync.Once
		videoCoreSubscriber *videocore.Subscriber
	}

	WatchPartyPlayerBaseEvent struct{}

	WatchPartyPlayerVideoStarted struct {
		WatchPartyPlayerBaseEvent
		StreamType WatchPartyStreamType
	}
	WatchPartyPlayerVideoStatus struct {
		WatchPartyPlayerBaseEvent
		Status   *WatchPartyPlaybackStatus
		State    *WatchPartyPlaybackState
		Filename string
		Filepath string
	}
	WatchPartyPlayerVideoEnded struct {
		WatchPartyPlayerBaseEvent
	}
)

func (e *WatchPartyPlayerBaseEvent) IsWatchPartyPlaybackEvent() bool {
	return true
}

func (e *WatchPartyPlayerVideoStarted) Type() string {
	return "video-started"
}

func (e *WatchPartyPlayerVideoStatus) Type() string {
	return "video-status"
}

func (e *WatchPartyPlayerVideoEnded) Type() string {
	return "video-ended"
}

func (m *WatchPartyGenericPlayer) Unsubscribe(id string) {
	defer util.HandlePanicInModuleThen("nakama/UnsubscribeToPlaybackStatus", func() {})

	if subscriber, ok := m.subscribers.Pop(id); ok {
		// Video core
		if subscriber.videoCoreSubscriber != nil {
			m.manager.videoCore.Unsubscribe(subscriber.id)
		}
		subscriber.closeOnce.Do(func() {
			close(subscriber.EventCh)
		})
	}
}

func fromVideoCoreStatus(event *videocore.VideoStatusEvent, state *videocore.PlaybackState) *WatchPartyPlayerVideoStatus {
	streamType := WatchPartyStreamTypeFile
	filename := ""
	filepath := ""
	if event.PlaybackType == videocore.PlaybackTypeLocalFile {
		streamType = WatchPartyStreamTypeFile
		if state.PlaybackInfo.LocalFile != nil {
			filename = state.PlaybackInfo.LocalFile.Name
			filepath = state.PlaybackInfo.LocalFile.Path
		}
	} else if event.PlaybackType == videocore.PlaybackTypeTorrent {
		streamType = WatchPartyStreamTypeTorrent
	} else if event.PlaybackType == videocore.PlaybackTypeDebrid {
		streamType = WatchPartyStreamTypeDebrid
	} else if event.PlaybackType == videocore.PlaybackTypeOnlinestream {
		streamType = WatchPartyStreamTypeOnlinestream
	}

	return &WatchPartyPlayerVideoStatus{
		Status: &WatchPartyPlaybackStatus{
			Paused:      event.Paused,
			CurrentTime: event.CurrentTime,
			Duration:    event.Duration,
		},
		State: &WatchPartyPlaybackState{
			MediaId:       state.PlaybackInfo.Media.GetID(),
			EpisodeNumber: state.PlaybackInfo.Episode.EpisodeNumber,
			AniDBEpisode:  state.PlaybackInfo.Episode.AniDBEpisode,
			StreamType:    streamType,
		},
		Filename: filename,
		Filepath: filepath,
	}
}

// Subscribe is a generic subscriber to both playbackmanager.PlaybackManager and videocore.VideoCore.
func (m *WatchPartyGenericPlayer) Subscribe(id string) *WatchPartyPlaybackSubscriber {
	defer util.HandlePanicInModuleThen("nakama/Subscribe", func() {})
	subscriber := &WatchPartyPlaybackSubscriber{
		id:      id,
		EventCh: make(chan WatchPartyPlaybackEvent, 100),
	}

	m.subscribers.Set(id, subscriber)

	videoCoreSubscriber := m.manager.videoCore.Subscribe(id)
	subscriber.videoCoreSubscriber = videoCoreSubscriber

	go func() {
		defer util.HandlePanicInModuleThen("nakama/Subscribe", func() {})
		for e := range videoCoreSubscriber.Events() {
			switch event := e.(type) {
			case *videocore.VideoLoadedMetadataEvent:
				// Convert the stream type
				streamType := WatchPartyStreamTypeFile
				if event.PlaybackType == videocore.PlaybackTypeLocalFile {
					streamType = WatchPartyStreamTypeFile
				} else if event.PlaybackType == videocore.PlaybackTypeTorrent {
					streamType = WatchPartyStreamTypeTorrent
				} else if event.PlaybackType == videocore.PlaybackTypeDebrid {
					streamType = WatchPartyStreamTypeDebrid
				} else if event.PlaybackType == videocore.PlaybackTypeOnlinestream {
					streamType = WatchPartyStreamTypeOnlinestream
				}

				subscriber.EventCh <- &WatchPartyPlayerVideoStarted{
					StreamType: streamType,
				}
			case *videocore.VideoStatusEvent:
				state, ok := m.manager.videoCore.GetPlaybackState()
				if !ok {
					continue
				}
				// Convert status
				subscriber.EventCh <- fromVideoCoreStatus(event, state)
			case *videocore.VideoEndedEvent:
				subscriber.EventCh <- &WatchPartyPlayerVideoEnded{}
			}
		}
	}()

	return subscriber
}
