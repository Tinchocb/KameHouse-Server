package core

import (
	"context"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/constants"
	"kamehouse/internal/continuity"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/events"
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
	"os"
	"runtime"
	"sync"

	"github.com/rs/zerolog"
)

type (
	MetadataProviders struct {
		TMDBClient         *tmdb.Client
		OfflinePlatformRef *util.Ref[platform.Platform]
		PlatformRef        *util.Ref[platform.Platform]
		ProviderRef        *util.Ref[metadata_provider.Provider]

		// Enrichers
		FanArt      *metadata.FanArtEnricher
		OMDb        *metadata.OMDbEnricher
		OpenSubs    *metadata.OpenSubtitlesEnricher
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
		FillerManager   *fillermanager.FillerManager
		AutoScanner     *autoscanner.AutoScanner
		LibraryExplorer *library_explorer.LibraryExplorer
	}

	KameHouse struct {
		CoreServices
		StreamingServices
		LibraryServices

		// File system monitoring
		Watcher *scanner.Watcher

		// Metadata Providers (Decoupled Foundation)
		Metadata MetadataProviders

		// Offline and local account
		LocalManager local.Manager

		// Continuity and sync
		ContinuityManager *continuity.Manager
		TelemetryManager  *continuity.TelemetryManager

		// Lifecycle management
		Cleanups    []func()
		OnFlushLogs func()

		// Configuration and feature flags
		FeatureFlags      FeatureFlags
		FeatureManager    *FeatureManager
		Settings          *models.Settings
		SecondarySettings struct {
			Mediastream *models.MediastreamSettings
		}

		// Metadata
		Version          string
		TotalLibrarySize uint64
		LibraryDir       string
		IsDesktopSidecar bool
		Flags            KameHouseFlags

		// Internal state
		user               *user.User
		previousVersion    string
		moduleMu           sync.Mutex
		ServerReady        bool
		isOfflineRef       *util.Ref[bool]
		ServerPasswordHash string

		// Lifecycle: shutdownCtx is cancelled when the app is shutting down.
		// Pass this context to long-running goroutines so they exit cleanly.
		shutdownCtx    context.Context
		shutdownCancel context.CancelFunc

		// Show this version's tour on the frontend
		// Hydrated by migrations.go when there's a version change
		ShowTour string
	}

	App = KameHouse
)

type AppOption func(*KameHouse)

func WithConfig(cfg *Config) AppOption            { return func(a *KameHouse) { a.Config = cfg } }
func WithLogger(logger *zerolog.Logger) AppOption { return func(a *KameHouse) { a.Logger = logger } }
func WithDatabase(db *db.Database) AppOption      { return func(a *KameHouse) { a.Database = db } }
func WithWSEventManager(ws *events.WSEventManager) AppOption {
	return func(a *KameHouse) { a.WSEventManager = ws }
}

// NewApp creates a new server instance
func NewKameHouse(configOpts *ConfigOptions) *App {

	// Initialize logger with predefined format
	logger := util.NewLogger()

	// Log application version, OS, architecture and system info
	logger.Info().Msgf("app: KameHouse %s-%s", constants.Version, constants.VersionName)
	logger.Info().Msgf("app: OS: %s", runtime.GOOS)
	logger.Info().Msgf("app: Arch: %s", runtime.GOARCH)
	logger.Info().Msgf("app: Processor count: %d", runtime.NumCPU())

	// Store current version to detect version changes
	previousVersion := constants.Version

	// Add callback to track version changes
	configOpts.OnVersionChange = append(configOpts.OnVersionChange, func(oldVersion string, newVersion string) {
		logger.Info().Str("prev", oldVersion).Str("current", newVersion).Msg("app: Version change detected")
		previousVersion = oldVersion
	})

	// Initialize configuration with provided options
	// Creates config directory if it doesn't exist
	cfg, err := NewConfig(configOpts, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("app: Failed to initialize config")
	}

	// Compute SHA-256 hash of the server password
	serverPasswordHash := ""
	if cfg.Server.Password != "" {
		serverPasswordHash = util.HashSHA256Hex(cfg.Server.Password)
	}

	// Create logs directory if it doesn't exist
	_ = os.MkdirAll(cfg.Logs.Dir, 0755)

	// Start background process to trim log files
	go func() {
		defer util.HandlePanicInModuleThen("core/TrimLogEntries", func() {})
		TrimLogEntries(cfg.Logs.Dir, logger)
	}()

	logger.Info().Msgf("app: Data directory: %s", cfg.Data.AppDataDir)
	logger.Info().Msgf("app: Working directory: %s", cfg.Data.WorkingDir)

	// Log if running in desktop sidecar mode
	if configOpts.Flags.IsDesktopSidecar {
		logger.Info().Msg("app: Desktop sidecar mode enabled")
	}

	// Initialize database connection
	database, err := db.NewDatabase(context.Background(), cfg.Data.AppDataDir, cfg.Database.Name, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("app: Failed to initialize database")
	}

	HandleNewDatabaseEntries(database, logger)

	// Clean up old database entries using the cleanup manager to prevent concurrent access issues
	database.RunDatabaseCleanup() // Remove old entries from all tables sequentially

	// Get anime library paths for context
	_, _ = database.GetAllLibraryPathsFromSettings()

	tmdbToken := cfg.Metadata.TMDBApiKey // Assuming it's in config
	tmdbClient := tmdb.NewClient(tmdbToken)

	// Initialize internal dispatcher and WebSocket event manager for real-time communication
	dispatcher := events.NewDispatcher()
	wsEventManager := events.NewWSEventManager(logger, dispatcher)

	database.SetOnError(func(err error) {
		if wsEventManager != nil {
			wsEventManager.SendEvent(events.ErrorToast, "DB Error: "+err.Error())
		}
	})

	// Initialize Metadata Enrichers
	fanartEnricher := metadata.NewFanArtEnricher(cfg.Metadata.FanArtApiKey)
	omdbEnricher := metadata.NewOMDbEnricher(cfg.Metadata.OMDbApiKey)

	openSubsLangs := cfg.Metadata.OpenSubsLanguages
	if len(openSubsLangs) == 0 {
		openSubsLangs = []string{"es", "en"}
	}
	openSubsEnricher := metadata.NewOpenSubtitlesEnricher(cfg.Metadata.OpenSubsApiKey, openSubsLangs...)

	// Exit if no WebSocket connections in desktop sidecar mode
	if configOpts.Flags.IsDesktopSidecar {
		wsEventManager.ExitIfNoConnsAsDesktopSidecar()
	}

	// Initialize file cache system for media and metadata
	fileCacher, err := filecache.NewCacher(cfg.Cache.Dir)
	if err != nil {
		logger.Fatal().Err(err).Msgf("app: Failed to initialize file cacher")
	}

	// Initialize metadata provider for media information
	metadataProvider := metadata_provider.NewProvider(&metadata_provider.NewProviderImplOptions{
		Logger:     logger,
		FileCacher: fileCacher,
		Database:   database,
	})

	// Set initial metadata provider (will change if offline mode is enabled)
	activeMetadataProvider := metadataProvider

	activePlatformRef := util.NewRef[platform.Platform](nil)
	metadataProviderRef := util.NewRef(activeMetadataProvider)

	// Initialize sync manager for offline/online synchronization
	localManager, err := local.NewManager(&local.NewManagerOptions{
		LocalDir:            cfg.Offline.Dir,
		AssetDir:            cfg.Offline.AssetDir,
		Logger:              logger,
		MetadataProviderRef: metadataProviderRef,
		Database:            database,
		WSEventManager:      wsEventManager,
		IsOffline:           cfg.Server.Offline,
	})
	if err != nil {
		logger.Fatal().Err(err).Msgf("app: Failed to initialize sync manager")
	}

	// Use local metadata provider if in offline mode
	if cfg.Server.Offline {
		activeMetadataProvider = localManager.GetOfflineMetadataProvider()
	}

	// Initialize local platform for offline operations
	offlinePlatform, err := offline_platform.NewOfflinePlatform(localManager, logger)
	if err != nil {
		logger.Fatal().Err(err).Msgf("app: Failed to initialize local platform")
	}

	// Initialize simulated platform for unauthenticated operations
	simulatedPlatform := simulated_platform.NewSimulatedPlatform(logger, database)
	if simulatedPlatform == nil {
		logger.Fatal().Err(err).Msgf("app: Failed to initialize simulated platform")
	}

	// Change active platform if offline mode is enabled
	if cfg.Server.Offline {
		logger.Warn().Msg("app: Offline mode is active, using offline platform")
		activePlatformRef.Set(offlinePlatform)
	} else {
		logger.Warn().Msg("app: Using simulated platform")
		activePlatformRef.Set(simulatedPlatform)
	}

	isOfflineRef := util.NewRef(cfg.Server.Offline)
	offlinePlatformRef := util.NewRef(platform.Platform(offlinePlatform))

	// +---------------------+
	// | Phase 2: Base       |
	// +---------------------+

	continuityManager := continuity.NewManager(&continuity.NewManagerOptions{
		FileCacher: fileCacher,
		Logger:     logger,
		Database:   database,
	})

	videoCore := videocore.New(videocore.NewVideoCoreOptions{
		WsEventManager:      wsEventManager,
		Logger:              logger,
		MetadataProviderRef: metadataProviderRef,
		ContinuityManager:   continuityManager,
		PlatformRef:         activePlatformRef,
		IsOfflineRef:        isOfflineRef,
	})

	// Initialize Thumbnail Cache (LRU bounded to 1000 items to prevent OOM)
	thumbnailCache, err := cache.NewThumbnailCache(1000)
	if err != nil {
		logger.Fatal().Err(err).Msg("app: Failed to initialize thumbnail cache")
	}

	// Create a cancellable context for the app's lifecycle.
	// Long-running goroutines should listen to this context.
	shutdownCtx, shutdownCancel := context.WithCancel(context.Background())

	// Create the main app instance with initialized components
	app := &KameHouse{
		CoreServices: CoreServices{
			Config:           cfg,
			Database:         database,
			Logger:           logger,
			WSEventManager:   wsEventManager,
			FileCacher:       fileCacher,
			ThumbnailCache:   thumbnailCache,
		},
		StreamingServices: StreamingServices{
			VideoCore:             videoCore,
			MediastreamRepository: nil,
		},
		LibraryServices: LibraryServices{
			FillerManager:   nil,
			AutoScanner:     nil,
			LibraryExplorer: nil,
		},
		Flags:          configOpts.Flags,
		FeatureManager: NewFeatureManager(logger, configOpts.Flags),
		Metadata: MetadataProviders{
			TMDBClient:         tmdbClient,
			PlatformRef:        activePlatformRef,
			OfflinePlatformRef: offlinePlatformRef,
			ProviderRef:        metadataProviderRef,
			FanArt:             fanartEnricher,
			OMDb:               omdbEnricher,
			OpenSubs:           openSubsEnricher,
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
		isOfflineRef:       isOfflineRef,
		ServerPasswordHash: serverPasswordHash,
		shutdownCtx:        shutdownCtx,
		shutdownCancel:     shutdownCancel,
	}

	// Initialize modules that only need to be initialized once
	app.initModulesOnce()

	// Initialize all modules that depend on settings
	app.InitOrRefreshModules()

	// Set ServerReady
	app.ServerReady = true

	// Initialize mediastream settings (for streaming media)
	app.InitOrRefreshMediastreamSettings()

	// Run one-time initialization actions
	app.performActionsOnce()

	return app
}

func (a *KameHouse) IsOffline() bool {
	return a.isOfflineRef.Get()
}

func (a *KameHouse) IsOfflineRef() *util.Ref[bool] {
	return a.isOfflineRef
}

func (a *KameHouse) AddCleanupFunction(f func()) {
	a.Cleanups = append(a.Cleanups, f)
}

func (a *KameHouse) Cleanup(ctx context.Context) {
	// Signal all goroutines that are listening on shutdownCtx to exit.
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
	res, err := a.Metadata.PlatformRef.Get().GetAnimeCollection(context.Background(), bypassCache)
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
