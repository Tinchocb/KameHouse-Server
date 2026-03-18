package core

import (
	"context"
	"kamehouse/internal/api/mal"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/constants"
	"kamehouse/internal/continuity"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/directstream"
	"kamehouse/internal/events"
	"kamehouse/internal/hook"
	"kamehouse/internal/library/autodownloader"
	"kamehouse/internal/library/autoscanner"
	"kamehouse/internal/library/fillermanager"
	"kamehouse/internal/library/scanner"
	"kamehouse/internal/library_explorer"
	"kamehouse/internal/local"
	"kamehouse/internal/mediastream"
	"kamehouse/internal/platforms/offline_platform"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/platforms/simulated_platform"
	"kamehouse/internal/report"
	"kamehouse/internal/streaming"
	itorrent "kamehouse/internal/torrents/torrent"
	"kamehouse/internal/torrentstream"
	"kamehouse/internal/user"
	"kamehouse/internal/util"
	"kamehouse/internal/util/cache"
	"kamehouse/internal/util/filecache"
	"kamehouse/internal/videocore"
	"kamehouse/internal/ws"
	"log"
	"os"
	"runtime"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

type (
	MetadataProviders struct {
		TMDBClient         *tmdb.Client
		OfflinePlatformRef *util.Ref[platform.Platform]
		PlatformRef        *util.Ref[platform.Platform]
		ProviderRef        *util.Ref[metadata_provider.Provider]
		MalScrobbler       *mal.MalScrobblerWorker
	}

	KameHouse struct {
		// Core
		Config   *Config
		Database *db.Database
		Logger   *zerolog.Logger

		// Torrent and debrid services
		TorrentRepository       *itorrent.Repository

		// File system monitoring
		Watcher *scanner.Watcher

		// Metadata Providers (Decoupled Foundation)
		Metadata MetadataProviders

		// Library
		FillerManager  *fillermanager.FillerManager
		AutoDownloader *autodownloader.AutoDownloader
		AutoScanner    *autoscanner.AutoScanner

		// Real-time communication
		WSEventManager *events.WSEventManager
		WSHub          *ws.Hub

		ExtensionRepository interface {
			ListExtensionData() []interface{}
		}
		ExtensionBankRef interface{}

		HookManager             hook.Manager
		TorrentstreamRepository *torrentstream.Repository

		// Streaming
		StreamOrchestrator    *streaming.StreamOrchestrator
		DirectStreamManager   *directstream.Manager
		MediastreamRepository *mediastream.Repository
		// Phase 2: Base Providers
		VideoCore *videocore.VideoCore

		// Offline and local account
		LocalManager local.Manager

		// Utilities
		FileCacher       *filecache.Cacher
		ReportRepository *report.Repository
		ThumbnailCache   *cache.ThumbnailCache

		// Continuity and sync
		ContinuityManager *continuity.Manager
		TelemetryManager  *continuity.TelemetryManager

		// Lifecycle management
		Cleanups         []func()
		OnFlushLogs      func()

		// Configuration and feature flags
		FeatureFlags      FeatureFlags
		FeatureManager    *FeatureManager
		Settings          *models.Settings
		SecondarySettings struct {
			Mediastream   *models.MediastreamSettings
			Torrentstream *models.TorrentstreamSettings
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

		LibraryExplorer *library_explorer.LibraryExplorer

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

	// Initialize hook manager for plugin event system
	hookManager := hook.NewHookManager(hook.NewHookManagerOptions{Logger: logger})
	hook.SetGlobalHookManager(hookManager)

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
		log.Fatalf("app: Failed to initialize config: %v", err)
	}

	// Compute SHA-256 hash of the server password
	serverPasswordHash := ""
	if cfg.Server.Password != "" {
		serverPasswordHash = util.HashSHA256Hex(cfg.Server.Password)
	}

	// Create logs directory if it doesn't exist
	_ = os.MkdirAll(cfg.Logs.Dir, 0755)

	// Start background process to trim log files
	go TrimLogEntries(cfg.Logs.Dir, logger)

	logger.Info().Msgf("app: Data directory: %s", cfg.Data.AppDataDir)
	logger.Info().Msgf("app: Working directory: %s", cfg.Data.WorkingDir)

	// Log if running in desktop sidecar mode
	if configOpts.Flags.IsDesktopSidecar {
		logger.Info().Msg("app: Desktop sidecar mode enabled")
	}

	// Initialize database connection
	database, err := db.NewDatabase(context.Background(), cfg.Data.AppDataDir, cfg.Database.Name, logger)
	if err != nil {
		log.Fatalf("app: Failed to initialize database: %v", err)
	}

	HandleNewDatabaseEntries(database, logger)

	// Clean up old database entries using the cleanup manager to prevent concurrent access issues
	database.RunDatabaseCleanup() // Remove old entries from all tables sequentially

	// Get anime library paths for context
	_, _ = database.GetAllLibraryPathsFromSettings()

	tmdbToken := cfg.Metadata.TMDBApiKey // Assuming it's in config
	tmdbClient := tmdb.NewClient(tmdbToken)

	// Initialize WebSocket event manager for real-time communication
	wsEventManager := events.NewWSEventManager(logger)

	// Exit if no WebSocket connections in desktop sidecar mode
	if configOpts.Flags.IsDesktopSidecar {
		wsEventManager.ExitIfNoConnsAsDesktopSidecar()
	}

	// Initialize file cache system for media and metadata
	fileCacher, err := filecache.NewCacher(cfg.Cache.Dir)
	// torrentio.Resolve ...
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
	metadataProviderRef := util.NewRef[metadata_provider.Provider](activeMetadataProvider)

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
	offlinePlatformRef := util.NewRef[platform.Platform](offlinePlatform)

	// +---------------------+
	// | Phase 2: Base       |
	// +---------------------+

	continuityManager := continuity.NewManager(&continuity.NewManagerOptions{
		FileCacher: fileCacher,
		Logger:     logger,
		Database:   database,
	})


	telemetryManager := continuity.NewTelemetryManager(continuityManager, logger, 5*time.Second)

	videoCore := videocore.New(videocore.NewVideoCoreOptions{
		WsEventManager:      wsEventManager,
		Logger:              logger,
		MetadataProviderRef: metadataProviderRef,
		ContinuityManager:   continuityManager,
		PlatformRef:         activePlatformRef,
		IsOfflineRef: isOfflineRef,
	})


	// Initialize extension playground for testing extensions
	// extensionPlaygroundRepository := extension_playground.NewPlaygroundRepository(logger, activePlatformRef, metadataProviderRef)

	// Initialize Thumbnail Cache (LRU bounded to 1000 items to prevent OOM)
	thumbnailCache, err := cache.NewThumbnailCache(1000)
	if err != nil {
		logger.Fatal().Err(err).Msg("app: Failed to initialize thumbnail cache")
	}

	// Create the main app instance with initialized components
	app := &KameHouse{
		Config:         cfg,
		Flags:          configOpts.Flags,
		FeatureManager: NewFeatureManager(logger, configOpts.Flags),
		Database:       database,
		Metadata: MetadataProviders{
			TMDBClient:         tmdbClient,
			PlatformRef:        activePlatformRef,
			OfflinePlatformRef: offlinePlatformRef,
			ProviderRef:        metadataProviderRef,
		},
		LocalManager:   localManager,
		WSEventManager: wsEventManager,
		WSHub:          ws.NewHub(context.Background(), events.NewDispatcher()),
		Logger:                        logger,
		Version:            constants.Version,
		FileCacher:         fileCacher,
		ReportRepository:   report.NewRepository(logger),
		ThumbnailCache:     thumbnailCache,
		VideoCore:          videoCore,
		ContinuityManager:  continuityManager,
		TelemetryManager:   telemetryManager,
		TorrentRepository:             nil, // Initialized in App.initModulesOnce
		FillerManager:                 nil, // Initialized in App.initModulesOnce
		AutoDownloader:                nil, // Initialized in App.initModulesOnce
		AutoScanner:                   nil, // Initialized in App.initModulesOnce
		StreamOrchestrator:            nil, // Initialized in App.initModulesOnce
		MediastreamRepository:         nil, // Initialized in App.initModulesOnce
		DirectStreamManager:           nil, // Initialized in App.initModulesOnce
		LibraryExplorer:               nil, // Initialized in App.initModulesOnce
		previousVersion:               previousVersion,
		FeatureFlags:                  NewFeatureFlags(cfg, logger),
		IsDesktopSidecar:              configOpts.Flags.IsDesktopSidecar,
		SecondarySettings: struct {
			Mediastream   *models.MediastreamSettings
			Torrentstream *models.TorrentstreamSettings
		}{Mediastream: nil, Torrentstream: nil},
		moduleMu:           sync.Mutex{},
		HookManager:        hookManager,
		isOfflineRef:       isOfflineRef,
		ServerPasswordHash: serverPasswordHash,
	}


	// Initialize MAL Scrobbler DLQ Queue
	app.Metadata.MalScrobbler = mal.NewMalScrobblerWorker(database, logger)

	// Initialize modules that only need to be initialized once
	app.initModulesOnce()

	// Initialize all modules that depend on settings
	app.InitOrRefreshModules()

	// Set ServerReady
	app.ServerReady = true

	// Initialize mediastream settings (for streaming media)
	app.InitOrRefreshMediastreamSettings()

	// Initialize torrentstream settings (for torrent streaming)
	app.InitOrRefreshTorrentstreamSettings()

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
	done := make(chan struct{})
	go func() {
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
	// For now, this is a no-op or we can implement a simple registration if needed.
	// In the old code it was used to clear caches.
}

