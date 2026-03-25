package core

import (
	"context"
	"os"
	"strings"

	"kamehouse/internal/continuity"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/directstream"
	"kamehouse/internal/hook"
	"kamehouse/internal/hook_resolver"
	"kamehouse/internal/library/autodownloader"
	"kamehouse/internal/library/autoscanner"
	"kamehouse/internal/library/fillermanager"
	"kamehouse/internal/library_explorer"
	"kamehouse/internal/mediastream"
	"kamehouse/internal/streaming"
	itorrent "kamehouse/internal/torrents/torrent"
	"kamehouse/internal/torrentstream"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/platforms/tmdb_platform"

	"github.com/cli/browser"
	"github.com/rs/zerolog"
)


// initModulesOnce will initialize modules that need to persist.
// This function is called once after the App instance is created.
// The settings of these modules will be set/refreshed in InitOrRefreshModules.
func (a *App) initModulesOnce() {

	// +---------------------+
	// |       Filler        |
	// +---------------------+

	a.FillerManager = fillermanager.New(&fillermanager.NewFillerManagerOptions{
		DB:     a.Database,
		Logger: a.Logger,
	})

	// +---------------------+
	// |     Continuity      |
	// +---------------------+

	// ContinuityManager is now initialized in app.go (Phase 2)

	// +---------------------+
	// | Torrent Repository  |
	// +---------------------+

	a.TorrentRepository = itorrent.NewRepository(&itorrent.NewRepositoryOptions{
		Logger:              a.Logger,
		MetadataProviderRef: nil,
	})

	// +---------------------+
	// |    Media Stream     |
	// +---------------------+

	a.StreamOrchestrator = streaming.NewStreamOrchestrator(
		a.Database,
		a.Logger,
		a.FileCacher,
		&streaming.StreamingOptions{
			FfmpegPath: "ffmpeg",
		},
	)

	a.MediastreamRepository = mediastream.NewRepository(&mediastream.NewRepositoryOptions{
		Logger:         a.Logger,
		WSEventManager: a.WSEventManager,
		FileCacher:     a.FileCacher,
	})

	a.AddCleanupFunction(func() {
		a.MediastreamRepository.OnCleanup()
	})

	// NativePlayer has been removed. VideoCore handles orchestration logic safely in Phase 2.

	// +---------------------+
	// |   Direct Stream     |
	// +---------------------+

	a.DirectStreamManager = directstream.NewManager(directstream.NewManagerOptions{
		Logger:              a.Logger,
		WSEventManager:      a.WSEventManager,
		ContinuityManager:   a.ContinuityManager,
		MetadataProviderRef: a.Metadata.ProviderRef,
		RefreshAnimeCollectionFunc: func() {
			// No-op for now
		},
		IsOfflineRef: a.IsOfflineRef(),
		VideoCore:    a.VideoCore,
	})

	// +---------------------+
	// |   Torrent Stream    |
	// +---------------------+

	a.TorrentstreamRepository = torrentstream.NewRepository(&torrentstream.NewRepositoryOptions{
		Logger:              a.Logger,
		MetadataProviderRef: a.Metadata.ProviderRef,
		TorrentRepository:   a.TorrentRepository,
		WSEventManager:      a.WSEventManager,
		Database:            a.Database,
		DirectStreamManager: a.DirectStreamManager,
	})

	// +---------------------+
	// |   Auto Downloader   |
	// +---------------------+

	a.AutoDownloader = autodownloader.New(a.Logger, a.Database, a.WSEventManager)

	// This is run in a goroutine
	a.AutoDownloader.Start(context.Background())

	// +---------------------+
	// |   Predictive Cache  |
	// +---------------------+

	hook.GlobalHookManager.OnPredictiveCacheEpisodeRequested().BindFunc(func(resolver hook_resolver.Resolver) error {
		event := resolver.(*continuity.PredictiveCacheEpisodeRequestedEvent)
		a.Logger.Info().Int("mediaId", event.MediaId).Int("episode", event.EpisodeNumber).Msg("app: Received predictive cache request")
		go func() {
			// Find rules that match this media ID
			rules, err := db.GetAutoDownloaderRules(a.Database)
			if err != nil {
				return
			}
			var ruleIDs []uint
			for _, r := range rules {
				// Fire a check for rules that match this Media Id
				if r.MediaId == event.MediaId && r.Enabled {
					ruleIDs = append(ruleIDs, r.DbID)
				}
			}
			if len(ruleIDs) > 0 {
				a.AutoDownloader.RunCheck()
			}
		}()
		return event.Next()
	})

	// +---------------------+
	// |    Auto Scanner     |
	// +---------------------+

	a.AutoScanner = autoscanner.New(&autoscanner.NewAutoScannerOptions{
		Database:            a.Database,
		Logger:              a.Logger,
		WSEventManager:      a.WSEventManager,
		Enabled:             false, // Will be set in InitOrRefreshModules
		AutoDownloader:      a.AutoDownloader,
		MetadataProviderRef: a.Metadata.ProviderRef,
		LogsDir:             a.Config.Logs.Dir,
		OnRefreshCollection: func() {
			// No-op for now
		},
		EventDispatcher: a.WSEventManager.Dispatcher(),
	})

	// AutoScanner is event-driven now, no Start method.

	// +---------------------+
	// |   Anime Library     |
	// +---------------------+
	a.LibraryExplorer = library_explorer.NewLibraryExplorer(library_explorer.NewLibraryExplorerOptions{
		Logger:      a.Logger,
		Database:    a.Database,
	})

}

// HandleNewDatabaseEntries initializes essential database collections.
// It creates an empty local files collection if one does not already exist.
func HandleNewDatabaseEntries(database *db.Database, logger *zerolog.Logger) {

	// Create initial empty local files collection if none exists
	if _, _, err := db.GetLocalFiles(database); err != nil {
		_, err := db.InsertLocalFiles(database, make([]*dto.LocalFile, 0))
		if err != nil {
			logger.Fatal().Err(err).Msgf("app: Failed to initialize local files in the database")
		}
	}

}

// InitOrRefreshModules will initialize or refresh modules that depend on settings.
// This function is called:
//   - After the App instance is created
//   - After settings are updated.
//
// DEVNOTE: Make sure there's no blocking code in this function.
func (a *App) InitOrRefreshModules() {
	a.moduleMu.Lock()
	defer a.moduleMu.Unlock()

	a.Logger.Debug().Msgf("app: Refreshing modules")

	// Stop watching if already watching
	if a.Watcher != nil {
		a.Watcher.StopWatching()
	}

	// Get settings from database
	settings, err := a.Database.GetSettings()
	if err != nil || settings == nil { // Keep original check for settings object itself
		a.Logger.Warn().Msg("app: Did not initialize modules, no settings found")
		return
	}

	a.Settings = settings // Store settings instance in app

	// Environment variable overrides
	if envSeries := os.Getenv("KAMEHOUSE_SERIES_PATHS"); envSeries != "" {
		settings.Library.SeriesPaths = strings.Split(envSeries, ",")
	}
	if envMovies := os.Getenv("KAMEHOUSE_MOVIE_PATHS"); envMovies != "" {
		settings.Library.MoviePaths = strings.Split(envMovies, ",")
	}
	if envTmdb := os.Getenv("KAMEHOUSE_TMDB_TOKEN"); envTmdb != "" {
		settings.Library.TmdbApiKey = envTmdb
	}
	if envTmdbLang := os.Getenv("KAMEHOUSE_TMDB_LANGUAGE"); envTmdbLang != "" {
		settings.Library.TmdbLanguage = envTmdbLang
	}

	allPaths := settings.GetLibrary().GetAllPaths()
	if len(allPaths) > 0 {
		a.LibraryDir = allPaths[0]

		// Update feature toggles from settings
		a.FeatureManager.UpdateFromSettings(&settings.Library)
	}

	// +---------------------+
	// |   Module settings   |
	// +---------------------+
	// Refresh settings of modules that were initialized in initModulesOnce

	// Refresh updater settings
	if a.LibraryExplorer != nil {
		// Update the library paths for the library explorer (thread safe)
		go a.LibraryExplorer.SetLibraryPaths(settings.GetLibrary().GetAllPaths())
	}

	// +---------------------+
	// |   AutoDownloader    |
	// +---------------------+

	// Update Auto Downloader
	go a.AutoDownloader.SetSettings(settings.AutoDownloader)

	// +---------------------+
	// |   Library Watcher   |
	// +---------------------+

	// Initialize library watcher
	if len(settings.GetLibrary().GetAllPaths()) > 0 {
		go a.initLibraryWatcher(settings.GetLibrary().GetAllPaths())
	}
	// +---------------------+
	// |     Continuity      |
	// +---------------------+

	a.ContinuityManager.SetSettings(&continuity.Settings{
		WatchContinuityEnabled: settings.Library.EnableWatchContinuity,
	})

	// +---------------------+
	// |      Platform       |
	// +---------------------+

	// Refresh active platform from settings
	if !a.IsOffline() {
		a.Logger.Info().Msg("app: Using TMDb platform")
		tmdbApiKey := "0584d4437be4d13174085bc9b4435985"
		tmdbLanguage := "es-MX"
		a.Metadata.PlatformRef.Set(tmdb_platform.NewPlatform(tmdbApiKey, tmdbLanguage))
		// Also update the TMDB client used by the scanner
		a.Metadata.TMDBClient = tmdb.NewClient(tmdbApiKey, tmdbLanguage)
	}

	a.Logger.Info().Msg("app: Refreshed modules")

}

func (a *App) InitOrRefreshMediastreamSettings() {
	var settings *models.MediastreamSettings
	var found bool
	settings, found = a.Database.GetMediastreamSettings()
	if !found {
		var err error
		settings, err = a.Database.UpsertMediastreamSettings(&models.MediastreamSettings{
			BaseModel: models.BaseModel{
				ID: 1,
			},
			TranscodeEnabled:    false,
			TranscodeHwAccel:    "cpu",
			TranscodePreset:     "fast",
			PreTranscodeEnabled: false,
		})
		if err != nil {
			a.Logger.Error().Err(err).Msg("app: Failed to initialize mediastream module")
			return
		}
	}

	a.MediastreamRepository.InitializeModules(settings, a.Config.Cache.Dir, a.Config.Cache.TranscodeDir)

	go func() {
		if settings.TranscodeEnabled {
			_ = a.FileCacher.TrimMediastreamVideoFiles()
		} else {
			_ = a.FileCacher.ClearMediastreamVideoFiles()
		}
	}()

	a.SecondarySettings.Mediastream = settings
}

func (a *App) InitOrRefreshTorrentstreamSettings() {
	var settings *models.TorrentstreamSettings
	var found bool
	settings, found = a.Database.GetTorrentstreamSettings()
	if !found {
		var err error
		settings, err = a.Database.UpsertTorrentstreamSettings(&models.TorrentstreamSettings{
			BaseModel: models.BaseModel{
				ID: 1,
			},
			Enabled:             false,
			AutoSelect:          true,
			PreferredResolution: "",
			DisableIPV6:         false,
			DownloadDir:         "",
			AddToLibrary:        false,
			TorrentClientHost:   "",
			TorrentClientPort:   43213,
			StreamingServerHost: "0.0.0.0",
			StreamingServerPort: 43214,
			IncludeInLibrary:    false,
			StreamUrlAddress:    "",
			SlowSeeding:         false,
			PreloadNextStream:   false,
			TorrentioUrl:        "",
			CacheLimitGB:        5,
			CachePath:           "",
		})
		if err != nil {
			a.Logger.Error().Err(err).Msg("app: Failed to initialize torrentstream module")
			return
		}
	}

	err := a.TorrentstreamRepository.InitModules(settings)
	if err != nil && settings.Enabled {
		a.Logger.Error().Err(err).Msg("app: Failed to initialize Torrent streaming module")
	}

	a.Cleanups = append(a.Cleanups, func() {
		_ = a.TorrentstreamRepository.Shutdown()
	})

	a.SecondarySettings.Torrentstream = settings
}

func (a *App) performActionsOnce() {

	go func() {
		if a.Settings == nil {
			return
		}

		if a.Settings.GetLibrary().OpenWebURLOnStart {
			// Open the web URL
			err := browser.OpenURL(a.Config.GetServerURI("127.0.0.1"))
			if err != nil {
				a.Logger.Warn().Err(err).Msg("app: Failed to open web URL, please open it manually in your browser")
			} else {
				a.Logger.Info().Msg("app: Opened web URL")
			}
		}

		if a.Settings.GetLibrary().RefreshLibraryOnStart {
			go func() {
				a.Logger.Debug().Msg("app: Refreshing library")
				a.AutoScanner.TriggerScan()
			}()
		}
	}()

}
