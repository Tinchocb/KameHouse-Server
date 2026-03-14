package directstream

import (
	"context"
	"kamehouse/internal/api/anilist"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/continuity"
	"kamehouse/internal/events"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/mkvparser"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"kamehouse/internal/util/result"
	"kamehouse/internal/videocore"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"github.com/samber/mo"
)

// Manager handles direct stream playback and progress tracking for the built-in video player.
// It is similar to playbackmanager.PlaybackManager.
type (
	Manager struct {
		Logger *zerolog.Logger

		// ------------ Modules ------------- //

		wsEventManager             events.WSEventManagerInterface
		continuityManager          *continuity.Manager
		metadataProviderRef        *util.Ref[metadata_provider.Provider]
		platformRef                *util.Ref[platform.Platform]
		refreshAnimeCollectionFunc func() // This function is called to refresh the AniList collection

		videoCore           *videocore.VideoCore
		videoCoreSubscriber *videocore.Subscriber

		// --------- Playback Context -------- //

		playbackMu            sync.Mutex
		playbackCtx           context.Context
		playbackCtxCancelFunc context.CancelFunc

		// ---------- Playback State ---------- //

		currentStream mo.Option[Stream] // The current stream being played

		// \/ Stream playback
		// This is set by [SetStreamEpisodeCollection]
		currentStreamEpisodeCollection mo.Option[*anime.EpisodeCollection]

		settings *Settings

		isOfflineRef    *util.Ref[bool]
		animeCollection mo.Option[*anilist.AnimeCollection]
		animeCache      *result.Cache[int, *anilist.BaseAnime]

		parserCache *result.Cache[string, *mkvparser.MetadataParser]
		//playbackStatusSubscribers *result.Map[string, *PlaybackStatusSubscriber]
	}

	Settings struct {
		AutoPlayNextEpisode bool
		AutoUpdateProgress  bool
	}

	NewManagerOptions struct {
		Logger                     *zerolog.Logger
		WSEventManager             events.WSEventManagerInterface
		MetadataProviderRef        *util.Ref[metadata_provider.Provider]
		ContinuityManager          *continuity.Manager
		PlatformRef                *util.Ref[platform.Platform]
		RefreshAnimeCollectionFunc func()
		IsOfflineRef               *util.Ref[bool]
		VideoCore                  *videocore.VideoCore
	}
)

func NewManager(options NewManagerOptions) *Manager {
	ret := &Manager{
		Logger:                     options.Logger,
		wsEventManager:             options.WSEventManager,
		metadataProviderRef:        options.MetadataProviderRef,
		continuityManager:          options.ContinuityManager,
		platformRef:                options.PlatformRef,
		refreshAnimeCollectionFunc: options.RefreshAnimeCollectionFunc,
		isOfflineRef:               options.IsOfflineRef,
		currentStream:              mo.None[Stream](),
		parserCache:                result.NewCache[string, *mkvparser.MetadataParser](),
		videoCore:                  options.VideoCore,
	}

	if ret.videoCore != nil {
		ret.videoCoreSubscriber = ret.videoCore.Subscribe("directstream")
	}

	ret.listenToPlayerEvents()

	return ret
}

func (m *Manager) SetAnimeCollection(ac *anilist.AnimeCollection) {
	m.animeCollection = mo.Some(ac)
}

func (m *Manager) SetSettings(s *Settings) {
	m.settings = s
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (m *Manager) getAnime(ctx context.Context, mediaId int) (*anilist.BaseAnime, error) {
	media, ok := m.animeCache.Get(mediaId)
	if ok {
		return media, nil
	}

	// Find in anime collection
	animeCollection, ok := m.animeCollection.Get()
	if ok {
		media, ok := animeCollection.FindAnime(mediaId)
		if ok {
			return media, nil
		}
	}

	// Find in platform
	media, err := m.platformRef.Get().GetAnime(ctx, mediaId)
	if err != nil {
		return nil, err
	}

	// Cache
	m.animeCache.SetT(mediaId, media, 1*time.Hour)

	return media, nil
}
