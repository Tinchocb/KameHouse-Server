package core

import (
	"os"
	"path/filepath"
	"strings"
	"time"

	"kamehouse/internal/continuity"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/autoscanner"
	"kamehouse/internal/library/fillermanager"
	"kamehouse/internal/library_explorer"
	"kamehouse/internal/mediastream"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/platforms/tmdb_platform"
	"kamehouse/internal/util"

	"github.com/cli/browser"
	"github.com/rs/zerolog"
)

// initModulesOnce will initialize modules that need to persist.
func (a *App) initModulesOnce() {

	// +---------------------+
	// |       Filler        |
	// +---------------------+

	a.FillerManager = fillermanager.New(&fillermanager.NewFillerManagerOptions{
		DB:     a.Database,
		Logger: a.Logger,
	})

	// +---------------------+
	// |    Media Stream     |
	// +---------------------+



	a.MediastreamRepository = mediastream.NewRepository(&mediastream.NewRepositoryOptions{
		Logger:         a.Logger,
		WSEventManager: a.WSEventManager,
		FileCacher:     a.FileCacher,
	})

a.AddCleanupFunction(func() {
		a.MediastreamRepository.OnCleanup()
	})

	// +---------------------+
	// | Transcode Cleanup   |
	// +---------------------+
	// Clean up old transcode directories periodically
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			cleanupTranscodeDirs(a.Logger)
		}
	}()



	// +---------------------+
	// |    Auto Scanner     |
	// +---------------------+

	a.AutoScanner = autoscanner.New(&autoscanner.NewAutoScannerOptions{
		Database:            a.Database,
		Logger:              a.Logger,
		WSEventManager:      a.WSEventManager,
		Enabled:             false, // Will be set in InitOrRefreshModules
		MetadataProviderRef: a.Metadata.ProviderRef,
		LogsDir:             a.Config.Logs.Dir,
		OnRefreshCollection: func() {
		},
		EventDispatcher: a.WSEventManager.Dispatcher(),
	})

	// +---------------------+
	// |   Anime Library     |
	// +---------------------+
	a.LibraryExplorer = library_explorer.NewLibraryExplorer(library_explorer.NewLibraryExplorerOptions{
		Logger:      a.Logger,
		Database:    a.Database,
	})

}

// HandleNewDatabaseEntries initializes essential database collections.
func HandleNewDatabaseEntries(database *db.Database, logger *zerolog.Logger) {
	if _, _, err := db.GetLocalFiles(database); err != nil {
		_, err := db.InsertLocalFiles(database, make([]*dto.LocalFile, 0))
		if err != nil {
			logger.Fatal().Err(err).Msgf("app: Failed to initialize local files in the database")
		}
	}
}

// InitOrRefreshModules will initialize or refresh modules that depend on settings.
func (a *App) InitOrRefreshModules() {
	a.moduleMu.Lock()
	defer a.moduleMu.Unlock()

	a.Logger.Debug().Msgf("app: Refreshing modules")

	if a.Watcher != nil {
		a.Watcher.StopWatching()
	}

	settings, err := a.Database.GetSettings()
	if err != nil || settings == nil {
		a.Logger.Warn().Msg("app: Did not initialize modules, no settings found")
		return
	}

	a.Settings = settings

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
		a.FeatureManager.UpdateFromSettings(&settings.Library)
	}

	if a.LibraryExplorer != nil {
		go util.HandlePanicInModuleThen("core/modules/SetLibraryPaths", func() {
			a.LibraryExplorer.SetLibraryPaths(settings.GetLibrary().GetAllPaths())
		})
	}

	if len(settings.GetLibrary().GetAllPaths()) > 0 {
		go util.HandlePanicInModuleThen("core/modules/InitWatcher", func() {
			a.initLibraryWatcher(settings.GetLibrary().GetAllPaths())
		})
	}

	a.ContinuityManager.SetSettings(&continuity.Settings{
		WatchContinuityEnabled: settings.Library.EnableWatchContinuity,
	})

	if !a.IsOffline() {
		a.Logger.Info().Msg("app: Using TMDb platform")
		tmdbApiKey := settings.Library.TmdbApiKey
		if tmdbApiKey == "" {
			tmdbApiKey = a.Config.Metadata.TMDBApiKey
		}
		tmdbLanguage := settings.Library.TmdbLanguage
		if tmdbLanguage == "" || tmdbLanguage == "en" || tmdbLanguage == "es" {
			tmdbLanguage = "es-MX"
		}
		if tmdbApiKey == "" {
			a.Logger.Warn().Msg("app: No TMDB API key configured — platform features will be limited")
		}
		a.Metadata.PlatformRef.Set(tmdb_platform.NewPlatform(tmdbApiKey, tmdbLanguage))
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

func (a *App) performActionsOnce() {
	go func() {
		if a.Settings == nil {
			return
		}

		if a.Settings.GetLibrary().OpenWebURLOnStart {
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



// cleanupTranscodeDirs removes transcode directories older than 1 hour.
func cleanupTranscodeDirs(logger *zerolog.Logger) {
	transcodeBaseDir := filepath.Join(os.TempDir(), "kamehouse", "transcodes")

	entries, err := os.ReadDir(transcodeBaseDir)
	if err != nil {
		if !os.IsNotExist(err) {
			logger.Warn().Err(err).Msg("app: failed to read transcode directory")
		}
		return
	}

	cutoff := time.Now().Add(-1 * time.Hour)
	removed := 0

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		if info.ModTime().Before(cutoff) {
			fullPath := filepath.Join(transcodeBaseDir, entry.Name())
			if err := os.RemoveAll(fullPath); err != nil {
				logger.Warn().Err(err).Str("path", fullPath).Msg("app: failed to remove old transcode directory")
			} else {
				removed++
			}
		}
	}

	if removed > 0 {
		logger.Info().Int("count", removed).Msg("app: cleaned up old transcode directories")
	}
}

