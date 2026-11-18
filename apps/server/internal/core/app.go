// Package core implements the main application server, database, configurations, and core services for KameHouse.
package core

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/spf13/viper"
	"golang.org/x/crypto/bcrypt"

	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/constants"
	"kamehouse/internal/continuity"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/drive"
	"kamehouse/internal/events"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/library/autoscanner"
	"kamehouse/internal/library/fillermanager"
	"kamehouse/internal/library/scanner"
	"kamehouse/internal/maintenance"
	"kamehouse/internal/mediastream"
	"kamehouse/internal/notifier"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/platforms/simulated_platform"
	"kamehouse/internal/skipdetect"
	"kamehouse/internal/util"
	"kamehouse/internal/util/cache"
	"kamehouse/internal/util/crashlog"
	"kamehouse/internal/util/ffmpegutil"
	"kamehouse/internal/util/filecache"
	"kamehouse/internal/util/resourcebudget"
)

type (
	MetadataProviders struct {
		mu         sync.RWMutex
		tmdbClient *tmdb.Client
		Provider   *metadata_provider.DynamicProvider
		Platform   *platform.DynamicPlatform
	}

	CoreServices struct {
		Config         *Config
		Database       *db.Database
		Logger         *zerolog.Logger
		WSEventManager *events.WSEventManager
		FileCacher     *filecache.Cacher
		ThumbnailCache *cache.ThumbnailCache
		FFmpegManager  *ffmpegutil.Manager
	}

	StreamingServices struct {
		MediastreamRepository *mediastream.Repository
		SkipDetector          *skipdetect.Detector
		DriveService          *drive.Service
		// DriveInputURL convierte gdrive://… en la URL de loopback que ffmpeg/ffprobe pueden abrir.
		// La registran los handlers al montar las rutas (ver handlers.driveInputURL).
		DriveInputURL func(path string) string
	}

	LibraryServices struct {
		FillerManager       *fillermanager.FillerManager
		AutoScanner         *autoscanner.AutoScanner
		IntelligenceService *anime.IntelligenceService
		BackgroundQueue     *scanner.BackgroundQueue
	}

	KameHouse struct {
		CoreServices
		StreamingServices
		LibraryServices

		// Watcher and TotalLibrarySize are protected by libraryWatcher.mu.
		// Internal readers must use the accessors rather than reading snapshots directly.
		Watcher        *scanner.Watcher
		libraryWatcher libraryWatcherState

		Metadata MetadataProviders

		ContinuityManager *continuity.Manager
		TelemetryManager  *continuity.TelemetryManager

		Cleanups    []func()
		OnFlushLogs func()

		FeatureFlags                FeatureFlags
		FeatureManager              *FeatureManager
		settingsSnapshot            atomic.Pointer[models.Settings]
		mediastreamSettingsSnapshot atomic.Pointer[models.MediastreamSettings]

		Version          string
		TotalLibrarySize uint64
		IsDesktopSidecar bool
		Flags            KameHouseFlags

		moduleMu             sync.Mutex
		ServerReady          bool
		ServerPasswordHash   string
		ServerPasswordSHA256 string
		FallbackHMACSecret   string

		onRefreshAnimeCollectionCallbacksMu sync.Mutex
		onRefreshAnimeCollectionCallbacks   map[string]func()

		shutdownCtx    context.Context
		shutdownCancel context.CancelFunc

		configWatcher        *ConfigWatcher
		maintenanceScheduler *maintenance.Scheduler
		cleanupOnce          sync.Once
		cleanupDone          chan struct{}
		backgroundMu         sync.Mutex
		backgroundClosed     bool
		backgroundWorkers    sync.WaitGroup
	}

	App = KameHouse
)

// NewKameHouse crea una nueva instancia del servidor.
func NewKameHouse(configOpts *ConfigOptions) *App {
	logger := initLogger()
	initSystemInfo(logger)

	configOpts.OnVersionChange = append(configOpts.OnVersionChange, func(oldVersion string, newVersion string) {
		logger.Info().Str("prev", oldVersion).Str("current", newVersion).Msg("app: Version change detected")
	})

	cfg, v := initConfig(configOpts, logger)
	serverPasswordHash, serverPasswordSHA256, err := initServerPassword(cfg)
	if err != nil {
		logger.Fatal().Err(err).Msg("app: Failed to generate server password hash")
	}
	var fallbackSecret string
	if serverPasswordHash == "" {
		fallbackSecret = uuid.NewString()
	}
	initLogsDir(cfg, logger)
	startLogTrimmer(cfg, logger)

	database := initDatabase(cfg, logger)
	initAppDatabaseEntries(database, logger)

	tmdbClient := initTMDBClient(cfg, database, logger)

	// Create shutdown context early so it can be passed to WSEventManager
	shutdownCtx, shutdownCancel := context.WithCancel(context.Background())

	_, wsEventManager := initEventSystem(logger, shutdownCtx)
	notifier.Global().Init(database, wsEventManager, logger)
	fileCacher := initFileCacher(cfg, logger)
	metadataProvider := initMetadataProvider(cfg, logger, database, tmdbClient)

	// DynamicProvider envuelve el provider activo con conmutación atómica
	dynamicProvider := metadata_provider.NewDynamicProvider(metadataProvider)

	simulatedPlatform := initSimulatedPlatform(logger)
	// DynamicPlatform envuelve la plataforma activa con conmutación atómica
	dynamicPlatform := platform.NewDynamicPlatform(simulatedPlatform)

	continuityManager := initContinuityManager(fileCacher, logger, database)

	thumbnailCache := initThumbnailCache(cfg, logger)

	app := &KameHouse{
		CoreServices: CoreServices{
			Config:         cfg,
			Database:       database,
			Logger:         logger,
			WSEventManager: wsEventManager,
			FileCacher:     fileCacher,
			ThumbnailCache: thumbnailCache,
			FFmpegManager:  ffmpegutil.NewManager(cfg.Cache.Dir, logger),
		},
		StreamingServices: StreamingServices{
			MediastreamRepository: nil,
			DriveService:          drive.NewService(logger),
		},
		LibraryServices: LibraryServices{
			FillerManager:   nil,
			AutoScanner:     nil,
			BackgroundQueue: nil,
		},
		Flags:          configOpts.Flags,
		FeatureManager: NewFeatureManager(logger, configOpts.Flags),
		Metadata: MetadataProviders{
			Provider: dynamicProvider,
			Platform: dynamicPlatform,
		},
		Version:                           constants.Version,
		ContinuityManager:                 continuityManager,
		TelemetryManager:                  continuityManager.TelemetryManager,
		FeatureFlags:                      NewFeatureFlags(cfg, logger),
		IsDesktopSidecar:                  configOpts.Flags.IsDesktopSidecar,
		moduleMu:                          sync.Mutex{},
		ServerPasswordHash:                serverPasswordHash,
		ServerPasswordSHA256:              serverPasswordSHA256,
		FallbackHMACSecret:                fallbackSecret,
		onRefreshAnimeCollectionCallbacks: make(map[string]func()),
		shutdownCtx:                       shutdownCtx,
		shutdownCancel:                    shutdownCancel,
	}

	app.Metadata.publishTMDB(tmdbClient, metadataProvider)

	// Start config watcher for hot-reload
	configWatcher := NewConfigWatcher(v, cfg.v.ConfigFileUsed(), logger)
	if err := configWatcher.Start(app.shutdownCtx); err != nil {
		logger.Error().Err(err).Msg("failed to start config watcher")
	}
	// Register callbacks for hot-reloadable settings
	configWatcher.OnChange(func(newCfg *Config) {
		app.handleConfigChange(newCfg)
	})
	app.configWatcher = configWatcher

	app.initModulesOnce()
	app.InitOrRefreshModules()
	// Las migraciones DML corren en background; /api/health reporta degraded
	// hasta completarlas. No bloquear el arranque aquí.
	app.ServerReady = true
	app.InitOrRefreshMediastreamSettings()
	app.performActionsOnce()

	return app
}

func (a *KameHouse) ShutdownCtx() context.Context {
	if a.shutdownCtx != nil {
		return a.shutdownCtx
	}
	return context.Background()
}

// handleConfigChange aplica cambios de configuración hot-reloadable
func (a *KameHouse) handleConfigChange(newCfg *Config) {
	a.moduleMu.Lock()
	defer a.moduleMu.Unlock()

	// CORS and the write guard are installed together at startup. Mutating only
	// Config here would leave HTTP and WebSocket with different policies (and
	// race readers). Origin changes take effect on the next server restart.

	// Actualizar AuthTokenTTL
	if newCfg.Server.AuthTokenTTL != "" {
		a.Config.Server.AuthTokenTTL = newCfg.Server.AuthTokenTTL
		a.Logger.Info().Str("ttl", newCfg.Server.AuthTokenTTL).Msg("config: AuthTokenTTL actualizado via hot-reload")
	}

	// Actualizar LogLevel (a través de Logs.Dir no se puede cambiar en caliente, pero se puede cambiar el nivel de log)
	// Nota: LogLevel no está en el config struct directamente, se maneja vía logger

	// Actualizar TMDB API Key
	if newCfg.Metadata.TMDBApiKey != "" {
		a.Config.Metadata.TMDBApiKey = newCfg.Metadata.TMDBApiKey
		a.Logger.Info().Msg("config: TMDB API key actualizada via hot-reload")
		// Refresh provider, language and persistent cache using effective settings.
		if a.Database != nil {
			if settings, err := a.Database.GetSettings(); err == nil {
				a.refreshMetadata(settings)
			} else {
				a.Logger.Error().Err(err).Msg("config: Failed to refresh TMDB settings")
			}
		} else {
			a.refreshMetadata(&models.Settings{})
		}
	}

	// Actualizar FeatureFlags basado en Library settings (desde Settings en DB)
	// Nota: Library settings se guardan en DB, no en config file
	if settings := a.SettingsSnapshot(); a.FeatureManager != nil && settings != nil {
		a.FeatureManager.UpdateFromSettings(&settings.Library)
		a.Logger.Info().Msg("config: FeatureFlags actualizados via hot-reload")
	}

	a.Logger.Info().Msg("config: Hot-reload aplicado correctamente")
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

func initConfig(configOpts *ConfigOptions, logger *zerolog.Logger) (*Config, *viper.Viper) {
	cfg, v, err := NewConfig(configOpts, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("app: Failed to initialize config")
	}
	logger.Info().Msgf("app: Data directory: %s", cfg.Data.AppDataDir)
	logger.Info().Msgf("app: Working directory: %s", cfg.Data.WorkingDir)
	if configOpts.Flags.IsDesktopSidecar {
		logger.Info().Msg("app: Desktop sidecar mode enabled")
	}
	return cfg, v
}

func initServerPassword(cfg *Config) (string, string, error) {
	if cfg.Server.Password != "" {
		argonHash, err := util.HashPasswordArgon2(cfg.Server.Password)
		if err != nil {
			// Si falla Argon2id por alguna razón, usar bcrypt como fallback
			bcryptBytes, bcryptErr := bcrypt.GenerateFromPassword([]byte(cfg.Server.Password), bcrypt.DefaultCost)
			if bcryptErr != nil {
				return "", "", fmt.Errorf("failed to generate bcrypt password hash: %w", bcryptErr)
			}
			return string(bcryptBytes), util.HashSHA256Hex(cfg.Server.Password), nil
		}
		return argonHash, util.HashSHA256Hex(cfg.Server.Password), nil
	}
	return "", "", nil
}

func initLogsDir(cfg *Config, logger *zerolog.Logger) {
	logger.Trace().Str("dir", cfg.Logs.Dir).Msg("app: Creating logs directory")
	_ = os.MkdirAll(cfg.Logs.Dir, 0755)
	crashlog.GlobalCrashLogger.SetLogDir(cfg.Logs.Dir)

	// Sin archivo, los registros solo salían por stdout y la app de escritorio no los guarda:
	// la pestaña Sistema de los ajustes los muestra desde aquí.
	if path, err := util.AttachLogFile(cfg.Logs.Dir); err != nil {
		logger.Warn().Err(err).Str("dir", cfg.Logs.Dir).Msg("app: No se pudo crear el archivo de registro")
	} else {
		logger.Info().Str("file", path).Msg("app: Escribiendo registros en archivo")
	}
}

func startLogTrimmer(cfg *Config, logger *zerolog.Logger) {
	go func() {
		defer util.HandlePanicInModuleThen("core/TrimLogEntries", func() {})
		TrimLogEntries(cfg.Logs.Dir, logger)
	}()
}

func initDatabase(cfg *Config, logger *zerolog.Logger) *db.Database {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	database, err := db.NewDatabase(ctx, cfg.Data.AppDataDir, cfg.Database.Name, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("app: Failed to initialize database")
	}
	return database
}

func initAppDatabaseEntries(database *db.Database, logger *zerolog.Logger) {
	HandleNewDatabaseEntries(database, logger)
	database.RunDatabaseCleanup()
	db.CleanBrokenLibraryMediaPosters(database)
	_, _ = database.GetAllLibraryPathsFromSettings()
}

func initTMDBClient(cfg *Config, database *db.Database, logger *zerolog.Logger) *tmdb.Client {
	tmdbToken, reason := tmdb.ResolveToken(os.Getenv("KAMEHOUSE_TMDB_TOKEN"), os.Getenv("KAMEHOUSE_TMDB_API_KEY"), cfg.Metadata.TMDBApiKey)
	if tmdbToken == "" {
		if reason == "placeholder" {
			logger.Warn().Msg("app: TMDB token looks like an unreplaced placeholder (e.g. your_tmdb_bearer_token_here) - ignoring it, TMDB features will be degraded")
		} else {
			logger.Warn().Msg("app: No TMDB API key configured - TMDB features will be degraded, using default provider")
		}
	}
	tmdbClient := tmdb.NewClient(tmdbToken)
	if database != nil {
		tmdbClient.SetPersistentCache(&TMDbCacheAdapter{db: database})
	}
	return tmdbClient
}

func initEventSystem(logger *zerolog.Logger, shutdownCtx context.Context) (events.Dispatcher, *events.WSEventManager) {
	dispatcher := events.NewDispatcher()
	wsEventManager := events.NewWSEventManager(logger, dispatcher, shutdownCtx)
	return dispatcher, wsEventManager
}

func initFileCacher(cfg *Config, logger *zerolog.Logger) *filecache.Cacher {
	fileCacher, err := filecache.NewCacherWithPersistentBucket(cfg.Cache.Dir, continuity.WatchHistoryBucketName, filepath.Join(cfg.Data.AppDataDir, "cache"))
	if err != nil {
		logger.Fatal().Err(err).Msgf("app: Failed to initialize file cacher")
	}
	return fileCacher
}

func initMetadataProvider(cfg *Config, logger *zerolog.Logger, database *db.Database, tmdbClient *tmdb.Client) metadata_provider.Provider {
	return metadata_provider.NewProvider(&metadata_provider.NewProviderImplOptions{
		Logger:          logger,
		Database:        database,
		TMDBClient:      tmdbClient,
		DefaultProvider: cfg.Metadata.Provider,
	})
}

func initSimulatedPlatform(logger *zerolog.Logger) platform.Platform {
	simulatedPlatform := simulated_platform.NewSimulatedPlatform(logger)
	if simulatedPlatform == nil {
		logger.Fatal().Err(nil).Msgf("app: Failed to initialize simulated platform")
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

func initThumbnailCache(cfg *Config, logger *zerolog.Logger) *cache.ThumbnailCache {
	maxItems := cfg.Cache.Thumbnails.MemoryMaxItems
	if maxItems <= 0 {
		maxItems = 1000
	}
	maxBytesMB := cfg.Cache.Thumbnails.MemoryMaxBytesMB
	if maxBytesMB <= 0 {
		maxBytesMB = resourcebudget.Current().ThumbnailMB
	}
	maxBytes := maxBytesMB * 1024 * 1024
	logger.Info().Int64("memoryMB", maxBytesMB).
		Bool("automatic", cfg.Cache.Thumbnails.MemoryMaxBytesMB <= 0).
		Msg("app: Thumbnail memory budget")
	thumbnailCache, err := cache.NewThumbnailCache(maxItems, maxBytes)
	if err != nil {
		logger.Fatal().Err(err).Msg("app: Failed to initialize thumbnail cache")
	}
	return thumbnailCache
}

func (a *KameHouse) AddCleanupFunction(f func()) {
	a.Cleanups = append(a.Cleanups, f)
}

// startBackground registers ownership before spawning so shutdown can join every task.
func (a *KameHouse) startBackground(f func()) {
	a.StartBackground(f)
}

// StartBackground admits app-owned work before shutdown and joins it before
// closing shared resources. False means the caller must release reservations.
func (a *KameHouse) StartBackground(f func()) bool {
	a.backgroundMu.Lock()
	defer a.backgroundMu.Unlock()
	if a.backgroundClosed || a.ShutdownCtx().Err() != nil {
		return false
	}
	a.backgroundWorkers.Add(1)
	go func() { defer a.backgroundWorkers.Done(); f() }()
	return true
}

func (a *KameHouse) Cleanup(ctx context.Context) {
	a.cleanupOnce.Do(func() {
		a.cleanupDone = make(chan struct{})
		go a.cleanup()
	})
	select {
	case <-a.cleanupDone:
		a.Logger.Info().Msg("app: Graceful shutdown completed cleanly")
	case <-ctx.Done():
		a.Logger.Warn().Msg("app: Shutdown deadline reached; cleanup is still running")
	}
}

func (a *KameHouse) cleanup() {
	defer util.HandlePanicInModuleThen("core/app/Cleanup", func() {})
	defer close(a.cleanupDone)
	if a.shutdownCancel != nil {
		a.shutdownCancel()
	}
	if a.WSEventManager != nil {
		a.WSEventManager.Close()
	}
	a.backgroundMu.Lock()
	a.backgroundClosed = true
	a.backgroundMu.Unlock()
	a.stopLibraryWatcher()
	if a.configWatcher != nil {
		a.configWatcher.Stop()
		a.Logger.Info().Msg("app: Config watcher stopped")
	}
	if a.maintenanceScheduler != nil {
		a.maintenanceScheduler.Wait()
	}
	if a.AutoScanner != nil {
		a.AutoScanner.Stop()
	}
	a.backgroundWorkers.Wait()
	// Providers own detached metadata producers as well as synchronous readers.
	// Join them after handler tasks, before either shared cache or SQLite closes.
	if a.Metadata.Provider != nil {
		func() {
			defer util.HandlePanicInModuleThen("core/app/CloseMetadataProvider", func() {})
			if err := a.Metadata.Provider.Close(); err != nil {
				a.Logger.Error().Err(err).Msg("app: Failed to close metadata provider")
			}
		}()
	}

	a.Logger.Info().Msg("app: Running cleanup functions...")
	for _, f := range a.Cleanups {
		func() {
			defer util.HandlePanicInModuleThen("core/app/CleanupFunction", func() {})
			f()
		}()
	}

	if a.FileCacher != nil {
		a.Logger.Info().Msg("app: Closing file cacher...")
		if err := a.FileCacher.Close(); err != nil {
			a.Logger.Warn().Err(err).Msg("app: Error closing file cacher")
		}
	}

	if a.Database == nil {
		return
	}
	a.Logger.Info().Msg("app: Flushing buffered writer...")
	a.Database.Shutdown()

	a.Logger.Info().Msg("app: Closing database connection...")
	if err := a.Database.Close(); err != nil {
		a.Logger.Error().Err(err).Msg("app: Failed to close database connection")
	}
}

func (a *KameHouse) GetAnimeCollection(bypassCache bool) (*platform.UnifiedCollection, error) {
	res, err := a.Metadata.Platform.GetAnimeCollection(a.ShutdownCtx(), bypassCache)
	if err != nil {
		return nil, err
	}
	if bypassCache {
		a.onRefreshAnimeCollectionCallbacksMu.Lock()
		callbacks := make([]func(), 0, len(a.onRefreshAnimeCollectionCallbacks))
		for _, f := range a.onRefreshAnimeCollectionCallbacks {
			callbacks = append(callbacks, f)
		}
		a.onRefreshAnimeCollectionCallbacksMu.Unlock()

		for _, f := range callbacks {
			f()
		}
	}
	if res == nil {
		return &platform.UnifiedCollection{}, nil
	}
	uc, ok := res.(*platform.UnifiedCollection)
	if !ok {
		return nil, fmt.Errorf("metadata platform returned unexpected collection type %T", res)
	}
	return uc, nil
}

func (a *KameHouse) AddOnRefreshAnimeCollectionFunc(id string, f func()) {
	a.onRefreshAnimeCollectionCallbacksMu.Lock()
	defer a.onRefreshAnimeCollectionCallbacksMu.Unlock()
	a.onRefreshAnimeCollectionCallbacks[id] = f
}
