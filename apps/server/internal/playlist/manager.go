package playlist

import (
	"context"
	"encoding/json"
	"kamehouse/internal/database/db"

	debrid_client "kamehouse/internal/debrid/client"
	"kamehouse/internal/directstream"
	"kamehouse/internal/events"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/torrentstream"
	"kamehouse/internal/util"
	"sync"
	"sync/atomic"

	"github.com/rs/zerolog"
	"github.com/samber/mo"
)

type PlaylistClientEventType string

type ClientEvent struct {
	Type    PlaylistClientEventType `json:"type"`
	Payload interface{}             `json:"payload"`
}

const (
	ClientEventCurrentPlaylist PlaylistClientEventType = "current-playlist"
	ClientEventStart           PlaylistClientEventType = "start-playlist"
	ClientEventStop            PlaylistClientEventType = "stop-playlist"
	ClientEventPlayEpisode     PlaylistClientEventType = "play-episode"
	ClientEventReopenEpisode   PlaylistClientEventType = "reopen-episode"
)

type ClientPlaybackMethod string

const (
	ClientPlaybackMethodNone               ClientPlaybackMethod = ""
	ClientPlaybackMethodDefault            ClientPlaybackMethod = "default" // desktop media player
	ClientPlaybackMethodTranscode          ClientPlaybackMethod = "transcode"
	ClientPlaybackMethodExternalPlayerLink ClientPlaybackMethod = "externalPlayerLink"
	ClientPlaybackMethodNativePlayer       ClientPlaybackMethod = "nativePlayer"
)

func (m ClientPlaybackMethod) String() string {
	return string(m)
}

//--------------------------------------------------------------------------------------------------------------------------------------------------//

type PlaylistServerEventType string

type ServerEvent struct {
	Type    PlaylistServerEventType `json:"type"`
	Payload interface{}             `json:"payload"`
}

const (
	ServerEventCurrentPlaylist PlaylistServerEventType = "current-playlist"
	ServerEventPlayEpisode     PlaylistServerEventType = "play-episode"
	ServerEventPlayingEpisode  PlaylistServerEventType = "playing-episode"
)

//--------------------------------------------------------------------------------------------------------------------------------------------------//

type State string

const (
	StateIdle      State = "idle"
	StateStarted   State = "started"
	StateCompleted State = "completed"
	StateErrored   State = "errored"
	StateStopped   State = "stopped"
)

const (
	SystemPlayer       = "system"
	NativePlayer       = "native"
	ExternalPlayerLink = "externalPlayerLink"
	Transcode          = "transcode"
)

//--------------------------------------------------------------------------------------------------------------------------------------------------//

type playlistData struct {
	playlist *anime.Playlist
	options  *startPlaylistPayload
}

type (
	Manager struct {
		// Playlist being played currently
		clientId              string
		currentPlaylistData   mo.Option[*playlistData]
		currentEpisode        mo.Option[*anime.PlaylistEpisode]
		currentPlaybackMethod ClientPlaybackMethod
		db                    *db.Database
		platformRef           *util.Ref[platform.Platform]
		wsEventManager        events.WSEventManagerInterface

		directstreamManager     *directstream.Manager
		torrentstreamRepository *torrentstream.Repository
		debridClientRepository  *debrid_client.Repository

		mu     sync.Mutex
		logger *zerolog.Logger

		isStartingPlaylist   atomic.Bool
		isLoadingNextEpisode atomic.Bool

		currentPlaybackCtx    context.Context
		currentPlaybackCancel func()

		state      atomic.Value
		playerType atomic.Value

		ctx    context.Context
		cancel context.CancelFunc
	}

	NewManagerOptions struct {
		DirectStreamManager     *directstream.Manager
		TorrentstreamRepository *torrentstream.Repository
		DebridClientRepository  *debrid_client.Repository
		Logger                  *zerolog.Logger
		PlatformRef             *util.Ref[platform.Platform]
		WSEventManager          events.WSEventManagerInterface
		Database                *db.Database
	}
)

func NewManager(opts *NewManagerOptions) *Manager {
	ret := &Manager{
		directstreamManager:     opts.DirectStreamManager,
		logger:                  opts.Logger,
		torrentstreamRepository: opts.TorrentstreamRepository,
		debridClientRepository:  opts.DebridClientRepository,
		platformRef:             opts.PlatformRef,
		db:                      opts.Database,
		wsEventManager:          opts.WSEventManager,
	}

	ret.listenToEvents()

	return ret
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

type (
	startPlaylistPayload struct {
		DbId                    uint                 `json:"dbId"`
		LocalFilePlaybackMethod ClientPlaybackMethod `json:"localFilePlaybackMethod"`
		StreamPlaybackMethod    ClientPlaybackMethod `json:"streamPlaybackMethod"`
		ClientId                string               `json:"clientId"`
	}

	episodeRequestedPayload struct {
		Which              string `json:"which"`              // "next", "previous", or index
		IsCurrentCompleted bool   `json:"isCurrentCompleted"` // Whether to mark the current episode as completed
	}
)

func (m *Manager) sendCurrentPlaylistToClient() {
	playlistEpisode, _ := m.currentEpisode.Get()

	data, ok := m.currentPlaylistData.Get()
	if !ok {
		m.wsEventManager.SendEventTo(m.clientId, string(events.PlaylistEvent), ServerEvent{
			Type: ServerEventCurrentPlaylist,
			Payload: struct {
				PlaylistEpisode *anime.PlaylistEpisode `json:"playlistEpisode"`
				Playlist        *anime.Playlist        `json:"playlist"`
			}{
				PlaylistEpisode: playlistEpisode,
				Playlist:        nil,
			},
		})
		return
	}
	m.wsEventManager.SendEventTo(m.clientId, string(events.PlaylistEvent), ServerEvent{
		Type: ServerEventCurrentPlaylist,
		Payload: struct {
			PlaylistEpisode *anime.PlaylistEpisode `json:"playlistEpisode"`
			Playlist        *anime.Playlist        `json:"playlist"`
		}{
			PlaylistEpisode: playlistEpisode,
			Playlist:        data.playlist,
		},
	})
}

func (m *Manager) listenToEvents() {
	go func() {
		subscriber := m.wsEventManager.SubscribeToClientPlaylistEvents("playlist-manager")

		for clientEvent := range subscriber.Channel {
			marshaledPayload, err := json.Marshal(clientEvent.Payload)
			if err != nil {
				continue
			}
			event := ClientEvent{}
			err = json.Unmarshal(marshaledPayload, &event)
			if err != nil {
				continue
			}
			switch event.Type {
			case ClientEventCurrentPlaylist:
				// UI requested current playlist
				m.sendCurrentPlaylistToClient()
			case ClientEventStart:
				// User is starting a new playlist
				m.logger.Debug().Msg("playlist: New playlist requested")

				if m.isStartingPlaylist.Load() {
					continue
				}
				m.isStartingPlaylist.Store(true)

				// cancel any existing playback
				if m.cancel != nil {
					m.cancel()
				}
				payload := startPlaylistPayload{}
				if err := event.UnmarshalAs(&payload); err == nil {
					// Get the playlist
					m.clientId = payload.ClientId
					rawPlaylist, err := db.GetRawPlaylist(m.db, payload.DbId)
					if err != nil {
						m.logger.Error().Err(err).Msg("playlist: failed to get playlist")
						m.wsEventManager.SendEventTo(m.clientId, events.ErrorToast, "Failed to retrieve playlist info")
						m.isStartingPlaylist.Store(false)
						continue
					}
					var eps []*anime.PlaylistEpisode
					if err := json.Unmarshal(rawPlaylist.Value, &eps); err != nil {
						m.logger.Error().Err(err).Msg("playlist: failed to unmarshal playlist episodes")
						m.wsEventManager.SendEventTo(m.clientId, events.ErrorToast, "Failed to parse playlist")
						m.isStartingPlaylist.Store(false)
						continue
					}
					playlist := anime.NewPlaylist(rawPlaylist.Name)
					playlist.SetEpisodes(eps)
					playlist.DbId = rawPlaylist.ID
					// Start playlist
					go m.startPlaylist(playlist, &payload)
				}
				m.isStartingPlaylist.Store(false)
			case ClientEventStop:
				m.logger.Debug().Msg("playlist: Stop requested")
				m.StopPlaylist("Playlist stopped")
			case ClientEventPlayEpisode:
				payload := episodeRequestedPayload{}
				if err := event.UnmarshalAs(&payload); err == nil {
					m.PlayEpisode(payload.Which, payload.IsCurrentCompleted)
				}
			case ClientEventReopenEpisode:
				m.ReopenEpisode()
			default:
				m.logger.Error().Msgf("playlist: Unknown event type: %s", event.Type)
			}
		}
	}()
}

func (m *Manager) startPlaylist(playlist *anime.Playlist, options *startPlaylistPayload) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.cancel != nil {
		m.cancel()
	}

	m.logger.Debug().Uint("dbId", playlist.DbId).Msg("playlist: Starting playlist")

	// store the playlist
	m.currentPlaylistData = mo.Some(&playlistData{
		playlist: playlist,
		options:  options,
	})

	m.sendCurrentPlaylistToClient()

	// create a new context
	m.ctx, m.cancel = context.WithCancel(context.Background())

	// continue in goroutine
	go func() {
		<-m.ctx.Done()
		m.logger.Trace().Uint("dbId", playlist.DbId).Msg("playlist: Current playlist context done")
		m.resetPlaylist()
	}()

	// Continue playlist
	go m.playNextEpisode()

}

type (
	playEpisodePayload struct {
		PlaylistEpisode *anime.PlaylistEpisode `json:"playlistEpisode"`
	}
)

func (m *Manager) playNextEpisode() {
	if m.isLoadingNextEpisode.Load() {
		return
	}
	m.state.Store(StateIdle)
	m.isLoadingNextEpisode.Store(true)
	defer m.isLoadingNextEpisode.Store(false)
	m.mu.Lock()
	defer m.mu.Unlock()

	m.logger.Trace().Msg("playlist: Playing next episode")

	m.wsEventManager.SendEventTo(m.clientId, string(events.PlaylistEvent), ServerEvent{
		Type:    ServerEventPlayingEpisode,
		Payload: nil,
	})

	data, ok := m.currentPlaylistData.Get()
	if !ok {
		m.logger.Error().Msg("playlist: Cannot play next episode, no playlist is currently playing")
		return
	}

	var episode *anime.PlaylistEpisode

	currentEpisode, found := m.currentEpisode.Get()

	if !found {
		// find episode
		for _, playlistEp := range data.playlist.Episodes {
			if playlistEp.IsCompleted {
				continue
			}
			episode = playlistEp
			break
		}
	} else {
		episode, _ = data.playlist.NextEpisode(currentEpisode)
	}

	if episode == nil {
		m.logger.Error().Msg("playlist: Cannot play next episode, no episodes in playlist")
		return
	}

	m.playEpisode(episode)

	m.prepareNextEpisode()
}

func (m *Manager) hasNextEpisode() bool {
	data, ok := m.currentPlaylistData.Get()
	if !ok {
		return false
	}

	var found bool
	for _, playlistEp := range data.playlist.Episodes {
		if playlistEp.IsCompleted {
			continue
		}
		found = true
		break
	}

	return found
}

func (m *Manager) markCurrentAsCompleted() {
	m.logger.Trace().Msg("playlist: Marking current episode as completed")

	data, ok := m.currentPlaylistData.Get()
	if !ok {
		return
	}

	currentEpisode, ok := m.currentEpisode.Get()
	if !ok {
		return
	}

	if currentEpisode.IsCompleted {
		return
	}

	currentEpisode.IsCompleted = true

	_ = data
	go func(currentEpisode anime.PlaylistEpisode) {
		// update the playlist in db
		err := func() error {
			epsData, err := json.Marshal(data.playlist.Episodes)
			if err != nil {
				return err
			}
			raw, err := db.GetRawPlaylist(m.db, data.playlist.DbId)
			if err != nil {
				return err
			}
			raw.Name = data.playlist.Name
			raw.Value = epsData
			return db.UpdateRawPlaylist(m.db, raw)
		}()
		if err != nil {
			m.logger.Error().Err(err).Msg("playlist: Failed to update playlist")
		}
		// update the progress
		err = m.platformRef.Get().UpdateEntryProgress(context.Background(), int(currentEpisode.Episode.BaseAnime.ID), currentEpisode.Episode.ProgressNumber, currentEpisode.Episode.BaseAnime.Episodes())
		if err != nil {
			m.logger.Error().Err(err).Msg("playlist: Failed to update progress")
		}
	}(*currentEpisode)

	m.sendCurrentPlaylistToClient()

	return
}

func (m *Manager) resetPlaylist() {
	m.currentPlaylistData = mo.None[*playlistData]()
	m.currentEpisode = mo.None[*anime.PlaylistEpisode]()
	m.cancel = nil
	m.sendCurrentPlaylistToClient()
}

func (m *Manager) playEpisode(episode *anime.PlaylistEpisode) {
	_, ok := m.currentPlaylistData.Get()
	if !ok {
		return
	}

	m.logger.Trace().Int("mediaId", int(episode.Episode.BaseAnime.ID)).Str("aniDBEpisode", episode.Episode.AniDBEpisode).Msg("playlist: Playing episode")

	m.logger.Trace().Msg("playlist: Canceling media player events before playing episode")
	m.state.Store(StateIdle)

	m.wsEventManager.SendEventTo(m.clientId, string(events.PlaylistEvent), ServerEvent{
		Type:    ServerEventPlayingEpisode,
		Payload: nil,
	})

	m.state.Store(StateIdle)

	// store pointer to episode
	m.currentEpisode = mo.Some(episode)

	m.sendCurrentPlaylistToClient()

	// play the file
	// - if external player link, do nothing
	// - if nakama stream, launch it from client
	// - if local file & desktop player, launch it from server
	// - if torrent/debrid stream, launch it from client



	m.logger.Trace().Msg("playlist: Sending play episode event to client")

	m.wsEventManager.SendEventTo(m.clientId, string(events.PlaylistEvent), ServerEvent{
		Type: ServerEventPlayEpisode,
		Payload: playEpisodePayload{
			PlaylistEpisode: episode,
		},
	})
}

func (m *Manager) prepareNextEpisode() {
	m.logger.Trace().Msg("playlist: Preparing next episode")

	data, ok := m.currentPlaylistData.Get()
	if !ok {
		return
	}

	currentEpisode, ok := m.currentEpisode.Get()
	if !ok {
		return
	}

	_, found := data.playlist.NextEpisode(currentEpisode)
	if !found {
		return
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (m *Manager) StopPlaylist(reason string, isError ...bool) {
	m.logger.Trace().Str("reason", reason).Msg("playlist: Stopping current playlist")
	if m.cancel != nil {
		m.cancel()
	}
	// Delete playlist if all episodes are completed
	go func() {
		data, ok := m.currentPlaylistData.Get()
		if !ok {
			return
		}
		d := *data
		if len(d.playlist.Episodes) == 0 {
			return
		}
		var completedEpisodes int
		for _, episode := range d.playlist.Episodes {
			if episode.IsCompleted {
				completedEpisodes++
			}
		}
		if completedEpisodes == len(d.playlist.Episodes) {
			_ = db.DeletePlaylist(m.db, d.playlist.DbId)
			m.wsEventManager.SendEventTo(m.clientId, events.InvalidateQueries, []string{events.GetPlaylistsEndpoint})
		}
	}()
	m.isStartingPlaylist.Store(false)
	m.resetPlaylist()
	if len(isError) > 0 && isError[0] {
		m.wsEventManager.SendEventTo(m.clientId, events.ErrorToast, reason)
		return
	}
	m.wsEventManager.SendEventTo(m.clientId, events.InfoToast, reason)
}

// PlayEpisode plays the next episode in the playlist
// isEpisodeCompleted is true if the current episode is completed (used for manual tracking)
func (m *Manager) PlayEpisode(which string, isCurrentCompleted bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.logger.Debug().Str("which", which).Bool("isCurrentCompleted", isCurrentCompleted).Msg("playlist: Episode requested")

	if isCurrentCompleted {
		m.markCurrentAsCompleted()
	}

	data, ok := m.currentPlaylistData.Get()
	if !ok {
		return
	}

	currentEpisode, ok := m.currentEpisode.Get()
	if !ok {
		if which == "next" {
			m.logger.Debug().Msg("playlist: No episodes in playlist, playing next episode")
			m.playNextEpisode()
		}
		return
	}

	var episode *anime.PlaylistEpisode

	switch which {
	case "next":
		episode, _ = data.playlist.NextEpisode(currentEpisode)
	case "previous":
		episode, _ = data.playlist.PreviousEpisode(currentEpisode)
	}

	if episode == nil {
		m.logger.Error().Msgf("playlist: Episode not found for '%s'", which)
		return
	}

	m.logger.Debug().Str("which", which).Int("mediaId", int(episode.Episode.BaseAnime.ID)).Str("aniDBEpisode", episode.Episode.AniDBEpisode).Str("episode", episode.Episode.DisplayTitle).Msg("playlist: Episode found")

	m.playEpisode(episode)
}

func (m *Manager) ReopenEpisode() {
	m.mu.Lock()
	defer m.mu.Unlock()

	_, ok := m.currentPlaylistData.Get()
	if !ok {
		return
	}

	currentEpisode, ok := m.currentEpisode.Get()
	if !ok {
		return
	}

	m.playEpisode(currentEpisode)
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (e *ClientEvent) UnmarshalAs(dest interface{}) error {
	marshaled, _ := json.Marshal(e.Payload)
	return json.Unmarshal(marshaled, dest)
}

func (m *Manager) isSameEpisode(a *anime.Episode, b *anime.Episode) bool {
	if a == nil || b == nil {
		return false
	}

	// If one file is a local file, use progress number for comparison
	if a.LocalFile != nil || b.LocalFile != nil {
		return a.BaseAnime.ID == b.BaseAnime.ID && a.ProgressNumber == b.ProgressNumber
	}

	// Otherwise, use AniDB episode number for comparison
	return a.BaseAnime.ID == b.BaseAnime.ID && a.AniDBEpisode == b.AniDBEpisode
}
