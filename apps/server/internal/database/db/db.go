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

	// PRAGMA optimizations for highly concurrent WAL-mode environments
	dsn := sqlitePath + "?_busy_timeout=10000&_journal_mode=WAL&_synchronous=NORMAL&_cache_size=2000&_foreign_keys=on"

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

	// High-throughput connection pool sizing to prevent starvation on media server loads
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(time.Hour)
	sqlDB.SetConnMaxIdleTime(10 * time.Minute)

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
		_ = op(db.gormdb)
	}
}

// Shutdown gracefully flushes all pending database operations.
func (db *Database) Shutdown() {
	if db.bufferedWriter != nil {
		db.bufferedWriter.Shutdown()
	}
}

// migrateTables strictly ensures that schema migration executes within standard timeout.
func migrateTables(ctx context.Context, db *gorm.DB) error {
	return db.WithContext(ctx).AutoMigrate(
		&models.LocalFiles{},
		&models.ShelvedLocalFiles{},
		&models.Settings{},
		&models.Account{},
		&models.Mal{},
		&models.ScanSummary{},
		&models.AutoSelectProfile{},
		&models.AutoDownloaderRule{},
		&models.AutoDownloaderProfile{},
		&models.AutoDownloaderItem{},
		&models.SilencedMediaEntry{},
		&models.Theme{},
		&models.PlaylistEntry{},
		&models.Playlist{},
		&models.ChapterDownloadQueueItem{},
		&models.TorrentstreamSettings{},
		&models.TorrentstreamHistory{},
		&models.MediastreamSettings{},
		&models.MediaFiller{},
		&models.MangaMapping{},
		&models.OnlinestreamMapping{},
		&models.DebridSettings{},
		&models.DebridTorrentItem{},
		&models.PluginData{},
		&models.CustomSourceCollection{},
		&models.CustomSourceIdentifier{},
		&models.MediaMetadataParent{},
		&models.GhostAssociatedMedia{},
		&models.LibraryMedia{},
		&models.LibraryEpisode{},
		&models.LibrarySeason{},
		&models.Token{},
		&models.ProviderMapping{},
		&models.MediaEntryListData{},
		&models.AnilistCacheEntry{},
	)
}

// RunDatabaseCleanup runs all database cleanup operations
func (db *Database) RunDatabaseCleanup() {
	db.cleanupManager.RunAllCleanupOperations()
}
