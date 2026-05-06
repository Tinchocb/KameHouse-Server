package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/rs/zerolog"
	"github.com/samber/mo"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"kamehouse/internal/database/models"
)

type Database struct {
	gormdb           *gorm.DB
	Logger           *zerolog.Logger
	CurrMediaFillers mo.Option[map[int]*MediaFillerItem]
	cleanupManager   *CleanupManager
	bufferedWriter   *BufferedWriter
	OnError          func(error)
}

func (db *Database) SetOnError(f func(error)) {
	db.OnError = f
	if db.bufferedWriter != nil {
		db.bufferedWriter.OnError = f
	}
}

func (db *Database) Gorm() *gorm.DB {
	return db.gormdb
}

// NewDatabase initializes a highly concurrent connection pool and ensures schema migration finishes before traffic.
func NewDatabase(ctx context.Context, appDataDir, dbName string, logger *zerolog.Logger) (*Database, error) {
	var sqlitePath string
	if os.Getenv("TEST_ENV") == "true" || appDataDir == "" {
		sqlitePath = ":memory:"
	} else {
		sqlitePath = filepath.Join(appDataDir, dbName+".db")
	}

	dsn := sqlitePath + "?_journal_mode=WAL&_busy_timeout=5000&_synchronous=NORMAL"

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
		PrepareStmt:            true, // Caches prepared statements for performance
		SkipDefaultTransaction: true, // +30% write speed by skipping implicit txs on single-record creates
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to obtain underlying sql.DB: %w", err)
	}

	// SQLite serializes writes via WAL journal. A small pool reduces SQLITE_BUSY
	// contention while still allowing concurrent reads.
	sqlDB.SetMaxOpenConns(4)
	sqlDB.SetMaxIdleConns(2)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Block and verify connection availability using the startup context timeout
	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("database ping fail or connection timeout: %w", err)
	}

	// Execute fail-safe migration within context
	if err := migrateTables(ctx, db); err != nil {
		logger.Fatal().Err(err).Msg("db: Failed to perform auto migration. Schema out of date.")
		return nil, err
	}

	logger.Info().Str("name", fmt.Sprintf("%s.db", dbName)).Msg("db: Database instantiated and migrated")

	database := &Database{
		gormdb:           db,
		Logger:           logger,
		CurrMediaFillers: mo.None[map[int]*MediaFillerItem](),
	}

	// Initialize background managers
	database.cleanupManager = NewCleanupManager(database.gormdb, database.Logger)
	database.bufferedWriter = NewBufferedWriter(database.gormdb, database.Logger, 50, 500*time.Millisecond)

	return database, nil
}

// EnqueueWrite adds an asynchronous write task to the ring buffer.
func (db *Database) EnqueueWrite(op DbWriteOperation) {
	if db.bufferedWriter != nil {
		db.bufferedWriter.Enqueue(op)
	} else {
		if err := op(db.gormdb); err != nil {
			db.Logger.Error().Err(err).Msg("db: EnqueueWrite fallback operation failed")
			if db.OnError != nil {
				db.OnError(err)
			}
		}
	}
}

// Shutdown gracefully flushes all pending database operations.
func (db *Database) Shutdown() {
	if db.bufferedWriter != nil {
		db.bufferedWriter.Shutdown()
	}
}

// Close releases the underlying database connection pool.
func (db *Database) Close() error {
	sqlDB, err := db.gormdb.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// migrateTables strictly ensures that schema migration executes within standard timeout.
func migrateTables(ctx context.Context, db *gorm.DB) error {
	// Clean up duplicate tmdb_ids before auto-migration to allow UNIQUE constraint creation
	db.Exec(`
		DELETE FROM library_media
		WHERE tmdb_id IS NOT NULL
		  AND tmdb_id != 0
		  AND id NOT IN (
			SELECT MIN(id)
			FROM library_media
			WHERE tmdb_id IS NOT NULL AND tmdb_id != 0
			GROUP BY tmdb_id
		)
	`)

	return db.WithContext(ctx).AutoMigrate(
		&models.LocalFiles{},
		&models.ShelvedLocalFiles{},
		&models.Settings{},
		&models.Account{},
		&models.ScanSummary{},

		&models.SilencedMediaEntry{},
		&models.Theme{},

		&models.MediastreamSettings{},
		&models.MediaFiller{},
		&models.MediaMetadataParent{},
		&models.GhostAssociatedMedia{},
		&models.LibraryMedia{},
		&models.LibraryEpisode{},
		&models.LibrarySeason{},
		&models.Token{},
		&models.ProviderMapping{},
		&models.MediaEntryListData{},
		&models.WatchHistory{},
		&models.UserMediaProgress{},

		&models.MediaCollection{},
	)
}

// RunDatabaseCleanup runs all database cleanup operations
func (db *Database) RunDatabaseCleanup() {
	db.cleanupManager.RunAllCleanupOperations()
}
