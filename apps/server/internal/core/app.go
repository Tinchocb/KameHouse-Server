package core

import (
	"context"
	"os"
	"runtime"
	"sync"
	"sync/atomic"

	"github.com/rs/zerolog"

	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/constants"
	"kamehouse/internal/continuity"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/events"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/library/autoscanner"
	"kamehouse/internal/library/fillermanager"
	"kamehouse/internal/library/metadata"
	"kamehouse/internal/library/scanner"
	"kamehouse/internal/library_explorer"
	"kamehouse/internal/local"
	"kamehouse/internal/mediastream"
	"kamehouse/internal/platforms/offline_platform"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/platforms/simulated_platform"
	"kamehouse/internal/user"
	"kamehouse/internal/util"
	"kamehouse/internal/util/cache"
	"kamehouse/internal/util/filecache"
	"kamehouse/internal/videocore"
)

type (
	MetadataProviders struct {
		TMDBClient *tmdb.Client
		Provider   *metadata_provider.DynamicProvider
		Platform   *platform.DynamicPlatform
		FanArt     *metadata.FanArtEnricher
		OMDb       *metadata.OMDbEnricher
		OpenSubs   *metadata.OpenSubtitlesEnricher
	}

	CoreServices struct {
		Config           *Config
		Database         *db.Database
		Logger           *zerolog.Logger
		WSEventManager   *events.WSEventManager
		FileCacher       *filecache.Cacher
		ThumbnailCache   *cache.ThumbnailCache
	}

	StreamingServices struct {
		MediastreamRepository *mediastream.Repository
		VideoCore             *videocore.VideoCore
	}

	LibraryServices struct {
		FillerManager       *fillermanager.FillerManager
		AutoScanner         *autoscanner.AutoScanner
		LibraryExplorer     *library_explorer.LibraryExplorer
		IntelligenceService *anime.IntelligenceService
		BackgroundQueue     *scanner.BackgroundQueue
	}

	KameHouse struct {
		CoreServices
		StreamingServices
		LibraryServices

		Watcher *scanner.Watcher

		Metadata MetadataProviders

		LocalManager local.Manager

		ContinuityManager *continuity.Manager
		TelemetryManager  *continuity.TelemetryManager

		Cleanups    []func()
		OnFlushLogs func()

		FeatureFlags   FeatureFlags
		FeatureManager *FeatureManager
		Settings       *models.Settings
		SecondarySettings struct {
			Mediastream *models.MediastreamSettings
		}

		Version          string
		TotalLibrarySize uint64
		LibraryDir       string
		IsDesktopSidecar bool
		Flags            KameHouseFlags

		user               *user.User
		previousVersion    string
		moduleMu           sync.Mutex
		ServerReady        bool
		isOffline          atomic.Bool
		ServerPasswordHash string

		shutdownCtx    context.Context
		shutdownCancel context.CancelFunc

		ShowTour string
	}

	App = KameHouse
)

type AppOption func(*KameHouse)

func WithConfig(cfg *Config) AppOption            { return func(a *KameHouse) { a.Config = cfg } }
func WithLogger(logger *zerolog.Logger) AppOption { return func(a *KameHouse) { a.Logger = logger } }
func WithDatabase(database *db.Database) AppOption { return func(a *KameHouse) { a.Database = database } }
func WithWSEventManager(ws *events.WSEventManager) AppOption {
	return func(a *KameHouse) { a.WSEventManager = ws }
}

// NewKameHouse crea una nueva instancia del servidor.
func NewKameHouse(configOpts *ConfigOptions) *App {
	logger := initLogger()
	initSystemInfo(logger)

	previousVersion := constants.Version
	configOpts.OnVersionChange = append(configOpts.OnVersionChange, func(oldVersion string, newVersion string) {
		logger.Info().Str("prev", oldVersion).Str("current", newVersion).Msg("app: Version change detected")
		previousVersion = oldVersion
	})

	cfg := initConfig(configOpts, logger)
	serverPasswordHash := initServerPassword(cfg)
	initLogsDir(cfg, logger)
	startLogTrimmer(cfg, logger)

	database := initDatabase(cfg, logger)
	initAppDatabaseEntries(database, logger)

	tmdbClient := initTMDBClient(cfg, database)
	_, wsEventManager := initEventSystem(logger, database)
	enrichers := initMetadataEnrichers(cfg)
	fileCacher := initFileCacher(cfg, logger)
	metadataProvider := initMetadataProvider(logger, fileCacher, database, tmdbClient)

	localManager := initLocalManager(cfg, database, logger, wsEventManager)

	// DynamicProvider envuelve el provider activo con conmutación atómica
	dynamicProvider := metadata_provider.NewDynamicProvider(resolveInitialProvider(cfg, localManager, metadataProvider))

	offlinePlatform := initOfflinePlatform(localManager, logger)
	simulatedPlatform := initSimulatedPlatform(logger, database)

	// DynamicPlatform envuelve la plataforma activa con conmutación atómica
	dynamicPlatform := platform.NewDynamicPlatform(resolveInitialPlatform(cfg, offlinePlatform, simulatedPlatform))

	isOffline := atomic.Bool{}
	isOffline.Store(cfg.Server.Offline)

	continuityManager := initContinuityManager(fileCacher, logger, database)

	videoCore := initVideoCore(wsEventManager, logger, dynamicProvider, continuityManager, dynamicPlatform, &isOffline)
	thumbnailCache := initThumbnailCache(logger)

	shutdownCtx, shutdownCancel := context.WithCancel(context.Background())

	app := &KameHouse{
		CoreServices: CoreServices{
			Config:         cfg,
			Database:       database,
			Logger:         logger,
			WSEventManager: wsEventManager,
			FileCacher:     fileCacher,
			ThumbnailCache: thumbnailCache,
		},
		StreamingServices: StreamingServices{
			VideoCore:             videoCore,
			MediastreamRepository: nil,
		},
		LibraryServices: LibraryServices{
			FillerManager:   nil,
			AutoScanner:     nil,
			LibraryExplorer: nil,
			BackgroundQueue: nil,
		},
		Flags:          configOpts.Flags,
		FeatureManager: NewFeatureManager(logger, configOpts.Flags),
		Metadata: MetadataProviders{
			TMDBClient: tmdbClient,
			Provider:   dynamicProvider,
			Platform:   dynamicPlatform,
			FanArt:     enrichers.FanArt,
			OMDb:       enrichers.OMDb,
			OpenSubs:   enrichers.OpenSubs,
		},
		Version:           constants.Version,
		ContinuityManager: continuityManager,
		TelemetryManager:  continuityManager.TelemetryManager,
		previousVersion:   previousVersion,
		FeatureFlags:      NewFeatureFlags(cfg, logger),
		IsDesktopSidecar:  configOpts.Flags.IsDesktopSidecar,
		SecondarySettings: struct {
			Mediastream *models.MediastreamSettings
		}{Mediastream: nil},
		moduleMu:           sync.Mutex{},
		isOffline:          isOffline,
		ServerPasswordHash: serverPasswordHash,
		shutdownCtx:        shutdownCtx,
		shutdownCancel:     shutdownCancel,
	}

	app.initModulesOnce()
	app.InitOrRefreshModules()
	app.ServerReady = true
	app.InitOrRefreshMediastreamSettings()
	app.performActionsOnce()

	return app
}

func initLogger() *zerolog.Logger {
	return util.NewLogger()
}

func initSystemInfo(logger *zerolog.Logger) {
	logger.Info().Msgf("app: KameHouse %s-%s", constants.Version, constants.VersionName)
	logger.Info().Msgf("app: OS: %s", runtime.GOOS)
	logger.Info().Msgf("app: Arch: %s", runtime.GOARCH)
	logger.Info().Msgf("app: Processor count: %d", runtime.NumCPU())
}

func initConfig(configOpts *ConfigOptions, logger *zerolog.Logger) *Config {
	cfg, err := NewConfig(configOpts, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("app: Failed to initialize config")
	}
	logger.Info().Msgf("app: Data directory: %s", cfg.Data.AppDataDir)
	logger.Info().Msgf("app: Working directory: %s", cfg.Data.WorkingDir)
	if configOpts.Flags.IsDesktopSidecar {
		logger.Info().Msg("app: Desktop sidecar mode enabled")
	}
	return cfg
}

func initServerPassword(cfg *Config) string {
	if cfg.Server.Password != "" {
		return util.HashSHA256Hex(cfg.Server.Password)
	}
	return ""
}

func initLogsDir(cfg *Config, logger *zerolog.Logger) {
	_ = os.MkdirAll(cfg.Logs.Dir, 0755)
}

func startLogTrimmer(cfg *Config, logger *zerolog.Logger) {
	go func() {
		defer util.HandlePanicInModuleThen("core/TrimLogEntries", func() {})
		TrimLogEntries(cfg.Logs.Dir, logger)
	}()
}

func initDatabase(cfg *Config, logger *zerolog.Logger) *db.Database {
	database, err := db.NewDatabase(context.Background(), cfg.Data.AppDataDir, cfg.Database.Name, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("app: Failed to initialize database")
	}
	return database
}

func initAppDatabaseEntries(database *db.Database, logger *zerolog.Logger) {
	HandleNewDatabaseEntries(database, logger)
	database.RunDatabaseCleanup()
	_, _ = database.GetAllLibraryPathsFromSettings()
}

func initTMDBClient(cfg *Config, database *db.Database) *tmdb.Client {
	tmdbToken := cfg.Metadata.TMDBApiKey
	tmdbClient := tmdb.NewClient(tmdbToken)
	if database != nil {
		tmdbClient.SetPersistentCache(&TMDbCacheAdapter{db: database})
	}
	return tmdbClient
}

func initEventSystem(logger *zerolog.Logger, database *db.Database) (events.Dispatcher, *events.WSEventManager) {
	dispatcher := events.NewDispatcher()
	wsEventManager := events.NewWSEventManager(logger, dispatcher)
	database.SetOnError(func(err error) {
		if wsEventManager != nil {
			wsEventManager.SendEvent(events.ErrorToast, "DB Error: "+err.Error())
		}
	})
	return dispatcher, wsEventManager
}

type metadataEnrichers struct {
	FanArt   *metadata.FanArtEnricher
	OMDb     *metadata.OMDbEnricher
	OpenSubs *metadata.OpenSubtitlesEnricher
}

func initMetadataEnrichers(cfg *Config) metadataEnrichers {
	fanartEnricher := metadata.NewFanArtEnricher(cfg.Metadata.FanArtApiKey)
	omdbEnricher := metadata.NewOMDbEnricher(cfg.Metadata.OMDbApiKey)
	openSubsLangs := cfg.Metadata.OpenSubsLanguages
	if len(openSubsLangs) == 0 {
		openSubsLangs = []string{"es", "en"}
	}
	openSubsEnricher := metadata.NewOpenSubtitlesEnricher(cfg.Metadata.OpenSubsApiKey, openSubsLangs...)
	return metadataEnrichers{
		FanArt:   fanartEnricher,
		OMDb:     omdbEnricher,
		OpenSubs: openSubsEnricher,
	}
}

func initFileCacher(cfg *Config, logger *zerolog.Logger) *filecache.Cacher {
	fileCacher, err := filecache.NewCacher(cfg.Cache.Dir)
	if err != nil {
		logger.Fatal().Err(err).Msgf("app: Failed to initialize file cacher")
	}
	return fileCacher
}

func initMetadataProvider(logger *zerolog.Logger, fileCacher *filecache.Cacher, database *db.Database, tmdbClient *tmdb.Client) metadata_provider.Provider {
	return metadata_provider.NewProvider(&metadata_provider.NewProviderImplOptions{
		Logger:     logger,
		FileCacher: fileCacher,
		Database:   database,
		TMDBClient: tmdbClient,
	})
}

func resolveInitialProvider(cfg *Config, localManager local.Manager, onlineProvider metadata_provider.Provider) metadata_provider.Provider {
	if cfg.Server.Offline {
		return localManager.GetOfflineMetadataProvider()
	}
	return onlineProvider
}

func initLocalManager(cfg *Config, database *db.Database, logger *zerolog.Logger, wsEventManager *events.WSEventManager) local.Manager {
	localManager, err := local.NewManager(&local.NewManagerOptions{
		LocalDir:       cfg.Offline.Dir,
		AssetDir:       cfg.Offline.AssetDir,
		Logger:         logger,
		Database:       database,
		WSEventManager: wsEventManager,
		IsOffline:      cfg.Server.Offline,
	})
	if err != nil {
		logger.Fatal().Err(err).Msgf("app: Failed to initialize sync manager")
	}
	return localManager
}

func initOfflinePlatform(localManager local.Manager, logger *zerolog.Logger) platform.Platform {
	offlinePlatform, err := offline_platform.NewOfflinePlatform(localManager, logger)
	if err != nil {
		logger.Fatal().Err(err).Msgf("app: Failed to initialize local platform")
	}
	return offlinePlatform
}

func initSimulatedPlatform(logger *zerolog.Logger, database *db.Database) platform.Platform {
	simulatedPlatform := simulated_platform.NewSimulatedPlatform(logger, database)
	if simulatedPlatform == nil {
		logger.Fatal().Err(nil).Msgf("app: Failed to initialize simulated platform")
	}
	return simulatedPlatform
}

func resolveInitialPlatform(cfg *Config, offlinePlatform, simulatedPlatform platform.Platform) platform.Platform {
	if cfg.Server.Offline {
		return offlinePlatform
	}
	return simulatedPlatform
}

func initContinuityManager(fileCacher *filecache.Cacher, logger *zerolog.Logger, database *db.Database) *continuity.Manager {
	return continuity.NewManager(&continuity.NewManagerOptions{
		FileCacher: fileCacher,
		Logger:     logger,
		Database:   database,
	})
}

func initVideoCore(wsEventManager *events.WSEventManager, logger *zerolog.Logger, dynamicProvider *metadata_provider.DynamicProvider, continuityManager *continuity.Manager, dynamicPlatform *platform.DynamicPlatform, isOffline *atomic.Bool) *videocore.VideoCore {
	return videocore.New(videocore.NewVideoCoreOptions{
		WsEventManager:    wsEventManager,
		Logger:            logger,
		DynamicProvider:   dynamicProvider,
		ContinuityManager: continuityManager,
		DynamicPlatform:   dynamicPlatform,
		IsOffline:         isOffline,
	})
}

func initThumbnailCache(logger *zerolog.Logger) *cache.ThumbnailCache {
	thumbnailCache, err := cache.NewThumbnailCache(1000)
	if err != nil {
		logger.Fatal().Err(err).Msg("app: Failed to initialize thumbnail cache")
	}
	return thumbnailCache
}

func (a *KameHouse) IsOffline() bool {
	return a.isOffline.Load()
}

func (a *KameHouse) AddCleanupFunction(f func()) {
	a.Cleanups = append(a.Cleanups, f)
}

func (a *KameHouse) Cleanup(ctx context.Context) {
	a.shutdownCancel()

	done := make(chan struct{})
	go func() {
		defer util.HandlePanicInModuleThen("core/app/Cleanup", func() {})
		defer close(done)

		a.Logger.Info().Msg("app: Running cleanup functions...")
		for _, f := range a.Cleanups {
			f()
		}

		a.Logger.Info().Msg("app: Flushing buffered writer...")
		a.Database.Shutdown()

		a.Logger.Info().Msg("app: Closing database connection...")
		if err := a.Database.Close(); err != nil {
			a.Logger.Error().Err(err).Msg("app: Failed to close database connection")
		}
	}()

	select {
	case <-done:
		a.Logger.Info().Msg("app: Graceful shutdown completed cleanly")
	case <-ctx.Done():
		a.Logger.Warn().Msg("app: Shutdown timed out — forcing exit")
	}
}

func (a *KameHouse) GetUser() *user.User {
	return a.user
}

func (a *KameHouse) GetAnimeCollection(bypassCache bool) (*platform.UnifiedCollection, error) {
	res, err := a.Metadata.Platform.GetAnimeCollection(context.Background(), bypassCache)
	if err != nil {
		return nil, err
	}
	if res == nil {
		return &platform.UnifiedCollection{}, nil
	}
	return res.(*platform.UnifiedCollection), nil
}

func (a *KameHouse) AddOnRefreshAnimeCollectionFunc(id string, f func()) {
}
