package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/rs/zerolog"
	"github.com/samber/mo"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"kamehouse/internal/database/models"
)

type Database struct {
	gormdb                  *gorm.DB
	Logger                  *zerolog.Logger
	mediaFillerMu           sync.RWMutex
	CurrMediaFillers        mo.Option[map[int]*MediaFillerItem]
	cleanupManager          *CleanupManager
	libraryMediaCache       atomic.Pointer[sync.Map] // Generation scoped to this database.
	localFilesCache         atomic.Pointer[localFilesGeneration]
	slowTraceLogger         *SlowTraceLogger
	sqlitePath              string
	cancelWal               context.CancelFunc
	currSettings            atomic.Pointer[models.Settings]
	themeCache              atomic.Pointer[models.Theme]
	themeCopyCache          atomic.Pointer[models.Theme]
	currMediastreamSettings atomic.Pointer[models.MediastreamSettings]
	mediastreamSettingsMu   sync.Mutex
	backupMu                sync.Mutex // backup publication and rotation belong to one operation
	currLibraryPaths        atomic.Pointer[[]string]
	currMediaSourcePrefs    atomic.Pointer[map[int]string]
	// settingsOverride aplica overrides de entorno a una copia de los ajustes
	// guardados (ver GetSettings). effSettings cachea el resultado.
	settingsOverride atomic.Pointer[SettingsOverride]
	effSettings      atomic.Pointer[effectiveSettings]

	// Migration status tracking
	migrationMu       sync.RWMutex
	migrationComplete bool
	migrationError    error
	migrationsDone    chan struct{} // closed when the background data migrations return
}

func (db *Database) Gorm() *gorm.DB {
	return db.gormdb
}

// NewDatabase initializes the SQLite connection pool with WAL mode and runs
// migración de esquema (DDL) de forma síncrona. La migración de datos
// heredados (DML) se delega a runDataMigrations en segundo plano.
func NewDatabase(ctx context.Context, appDataDir, dbName string, logger *zerolog.Logger) (*Database, error) {
	if logger == nil {
		return nil, fmt.Errorf("db: logger is required")
	}
	var sqlitePath string
	if os.Getenv("TEST_ENV") == "true" || appDataDir == "" {
		sqlitePath = ":memory:"
	} else {
		sqlitePath = filepath.Join(appDataDir, dbName+".db")
	}

	cacheSize := "-32000"
	if envCache := os.Getenv("KAMEHOUSE_DB_CACHE_SIZE"); envCache != "" {
		cacheSize = envCache
	}
	mmapSize := "134217728"
	if envMmap := os.Getenv("KAMEHOUSE_DB_MMAP_SIZE"); envMmap != "" {
		mmapSize = envMmap
	}

	// glebarez/sqlite uses _pragma=name(value) syntax (not mattn/go-sqlite3 style).
	// All pragmas in the DSN are applied to every connection opened by the pool.
	//
	//  journal_mode=WAL        → writers don't block readers; much better concurrency.
	//  busy_timeout=5000       → wait up to 5 s before returning SQLITE_BUSY.
	//  synchronous=NORMAL      → fsync only at WAL checkpoints, not every commit.
	//  temp_store=MEMORY       → keeps temporary tables and indices in RAM instead of disk.
	//  wal_autocheckpoint=1000 → automatic checkpointing every 1,000 pages to keep WAL size controlled.
	dsn := fmt.Sprintf(
		"%s?_pragma=foreign_keys(ON)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=synchronous(NORMAL)&_pragma=cache_size(%s)&_pragma=mmap_size(%s)&_pragma=journal_size_limit(67108864)&_pragma=temp_store(MEMORY)&_pragma=wal_autocheckpoint(1000)",
		sqlitePath, cacheSize, mmapSize,
	)

	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: gormlogger.New(
			logger,
			gormlogger.Config{
				SlowThreshold:             time.Second,
				LogLevel:                  gormlogger.Error,
				IgnoreRecordNotFoundError: true,
				ParameterizedQueries:      false,
				Colorful:                  true,
			},
		),
		PrepareStmt:            true,
		SkipDefaultTransaction: true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to obtain underlying sql.DB: %w", err)
	}

	ownsPool := true
	defer func() {
		if ownsPool {
			_ = sqlDB.Close()
		}
	}()

	maxOpenConns := runtime.NumCPU()
	if maxOpenConns < 4 {
		maxOpenConns = 4
	}
	sqlDB.SetMaxOpenConns(maxOpenConns)
	sqlDB.SetMaxIdleConns(maxOpenConns)
	sqlDB.SetConnMaxLifetime(time.Hour)

	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("database ping fail or connection timeout: %w", err)
	}

	// DDL: migración de esquema e índices (síncrona - requerida para funcionamiento)
	if err := migrateSchema(ctx, db, logger); err != nil {
		logger.Error().Err(err).Msg("db: Failed to perform auto migration. Schema out of date.")
		return nil, fmt.Errorf("migrate database schema: %w", err)
	}

	logger.Info().Str("name", fmt.Sprintf("%s.db", dbName)).Msg("db: Database instantiated and migrated")

	database := &Database{
		gormdb:           db,
		Logger:           logger,
		CurrMediaFillers: mo.None[map[int]*MediaFillerItem](),
		sqlitePath:       sqlitePath,
	}

	database.cleanupManager = NewCleanupManager(database.gormdb, database.Logger)

	logDir := appDataDir
	if logDir == "" {
		logDir = os.TempDir()
	}
	slowTraceLogger := NewSlowTraceLogger(logDir, 500*time.Millisecond)
	slowTraceLogger.RegisterCallbacks(db)
	database.slowTraceLogger = slowTraceLogger

	// Iniciar migraciones de datos (DML) en background
	// El servidor puede responder peticiones mientras se completan
	database.startDataMigrations(ctx)

	// Start background WAL checkpointing ticker (every 5 minutes).
	// Nota: se desacopla del ctx de init (timeout 30s) con WithoutCancel para
	// que el ticker no muera al arrancar; se detiene vía cancelWal en Close().
	walCtx, walCancel := context.WithCancel(context.WithoutCancel(ctx))
	database.cancelWal = walCancel
	go func() {
		defer func() {
			if r := recover(); r != nil {
				logger.Error().Interface("panic", r).Msg("db: panic in WAL checkpointing ticker")
			}
		}()
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-walCtx.Done():
				return
			case <-ticker.C:
				database.Checkpoint()
			}
		}
	}()

	ownsPool = false
	return database, nil
}

// Shutdown asegura que los logs pendientes se vuelquen antes de que el proceso termine.
func (db *Database) Shutdown() {
	if db.slowTraceLogger != nil {
		db.slowTraceLogger.Flush()
	}
	if err := db.gormdb.Exec("PRAGMA wal_checkpoint(TRUNCATE);").Error; err != nil {
		db.Logger.Error().Err(err).Msg("db: Failed to checkpoint WAL on shutdown")
	}
}

func (db *Database) Checkpoint() {
	db.CheckpointContext(context.Background())
}

func (db *Database) CheckpointContext(ctx context.Context) {
	if ctx.Err() != nil {
		return
	}
	if err := db.gormdb.WithContext(ctx).Exec("PRAGMA wal_checkpoint(PASSIVE);").Error; err != nil && ctx.Err() == nil {
		db.Logger.Error().Err(err).Msg("db: Failed to execute WAL checkpoint")
	}
}

// Close libera el pool de conexiones subyacente.
func (db *Database) Close() error {
	if db.cancelWal != nil {
		db.cancelWal()
	}
	// Cerrar con las migraciones en curso las cortaba a la mitad ("database is
	// closed") y, en Windows, dejaban el archivo abierto.
	if db.migrationsDone != nil {
		select {
		case <-db.migrationsDone:
		case <-time.After(30 * time.Second):
			db.Logger.Warn().Msg("db: cerrando sin esperar a que terminen las migraciones de datos")
		}
	}
	sqlDB, err := db.gormdb.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// RunDatabaseCleanup ejecuta todas las operaciones de limpieza de la base de datos.
func (db *Database) RunDatabaseCleanup() {
	db.RunDatabaseCleanupContext(context.Background())
}

func (db *Database) RunDatabaseCleanupContext(ctx context.Context) {
	db.cleanupManager.RunAllCleanupOperations(ctx)
	// Cleanup may delete metadata even if a later operation is cancelled.
	db.invalidateLibraryMediaCache()
}
