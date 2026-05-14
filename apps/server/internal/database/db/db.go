package db

import (
	"context"
	"encoding/json"
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
	"kamehouse/internal/database/models/dto"
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
	// Trim duplicates from LibraryMedia (TMDB IDs should be unique PER TYPE)
	db.Exec(`
		DELETE FROM library_media
		WHERE tmdb_id IS NOT NULL
		  AND tmdb_id != 0
		  AND id NOT IN (
			SELECT MIN(id)
			FROM library_media
			WHERE tmdb_id IS NOT NULL AND tmdb_id != 0
			GROUP BY tmdb_id, type
		)
	`)

	if err := db.WithContext(ctx).AutoMigrate(
		&models.LocalFiles{},
		&models.LocalFile{},
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
		&models.MetadataCache{},
	); err != nil {
		return err
	}

	// Manual Migration: Update LibraryMedia unique index to handle collisions between movies and shows
	if db.Migrator().HasIndex(&models.LibraryMedia{}, "idx_library_media_tmdb_id") {
		_ = db.Migrator().DropIndex(&models.LibraryMedia{}, "idx_library_media_tmdb_id")
		// Re-run automigrate to ensure the new index is created
		_ = db.AutoMigrate(&models.LibraryMedia{})
	}

	// Data Migration: LocalFiles (blob) -> LocalFile (relational)
	var count int64
	db.Model(&models.LocalFiles{}).Count(&count)
	var relationalCount int64
	db.Model(&models.LocalFile{}).Count(&relationalCount)

	if relationalCount == 0 && count > 0 {
		var legacy models.LocalFiles
		if err := db.Last(&legacy).Error; err == nil {
			var lfs []*dto.LocalFile
			if err := json.Unmarshal(legacy.Value, &lfs); err == nil && len(lfs) > 0 {
				// We can't use db.UpsertLocalFileRelationalBatch here because of package cycles or internal access
				// But we can just use a local migration loop
				dbFiles := make([]*models.LocalFile, len(lfs))
				for i, f := range lfs {
					dbf := &models.LocalFile{
						Path:           f.Path,
						Name:           f.Name,
						FileHash:       f.FileHash,
						Locked:         f.Locked,
						Ignored:        f.Ignored,
						LibraryMediaId: f.LibraryMediaId,
						MediaId:        f.MediaId,
					}
					if f.ParsedData != nil {
						dbf.ParsedData, _ = json.Marshal(f.ParsedData)
					}
					if f.ParsedFolderData != nil {
						dbf.ParsedFolderData, _ = json.Marshal(f.ParsedFolderData)
					}
					if f.Metadata != nil {
						dbf.Metadata, _ = json.Marshal(f.Metadata)
					}
					if f.TechnicalInfo != nil {
						dbf.TechnicalInfo, _ = json.Marshal(f.TechnicalInfo)
					}
					dbFiles[i] = dbf
				}
				_ = db.CreateInBatches(dbFiles, 100).Error
			}
		}
	}

	return nil
}

// RunDatabaseCleanup runs all database cleanup operations
func (db *Database) RunDatabaseCleanup() {
	db.cleanupManager.RunAllCleanupOperations()
}

// ResetLocalFilesMediaIds resets all media IDs and library media IDs in the local files database.
// This forces the scanner to re-match all files on the next scan.
func (db *Database) ResetLocalFilesMediaIds() error {
	lfs, id, err := GetLocalFiles(db)
	if err != nil {
		db.Logger.Error().Err(err).Msg("db: Failed to get local files for reset")
		return err
	}

	for _, lf := range lfs {
		lf.MediaId = 0
		lf.LibraryMediaId = 0
	}

	_, err = SaveLocalFiles(db, id, lfs)
	if err != nil {
		db.Logger.Error().Err(err).Msg("db: Failed to save reset local files")
		return err
	}

	// Also clear ghost associations to prevent the system from "remembering" bad matches
	_ = db.Gorm().Exec("DELETE FROM ghost_associated_media").Error

	db.Logger.Info().Msg("db: All local file media associations and ghost associations have been reset")
	return nil
}
