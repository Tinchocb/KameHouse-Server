package db

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
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
	gormdb            *gorm.DB
	Logger            *zerolog.Logger
	CurrMediaFillers  mo.Option[map[int]*MediaFillerItem]
	cleanupManager    *CleanupManager
	bufferedWriter    *BufferedWriter
	OnError           func(error)
	LibraryMediaCache sync.Map // L1 read cache scoped to the database instance
	slowTraceLogger   *SlowTraceLogger
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

// NewDatabase inicializa el pool de conexiones SQLite (WAL) y ejecuta la
// migración de esquema (DDL) de forma síncrona. La migración de datos
// heredados (DML) se delega a runDataMigrations en segundo plano.
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

	sqlDB.SetMaxOpenConns(4)
	sqlDB.SetMaxIdleConns(2)
	sqlDB.SetConnMaxLifetime(time.Hour)

	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("database ping fail or connection timeout: %w", err)
	}

	// DDL síncrono: esquema e índices
	if err := migrateSchema(ctx, db); err != nil {
		logger.Fatal().Err(err).Msg("db: Failed to perform auto migration. Schema out of date.")
		return nil, err
	}

	logger.Info().Str("name", fmt.Sprintf("%s.db", dbName)).Msg("db: Database instantiated and migrated")

	database := &Database{
		gormdb:           db,
		Logger:           logger,
		CurrMediaFillers: mo.None[map[int]*MediaFillerItem](),
	}

	database.cleanupManager = NewCleanupManager(database.gormdb, database.Logger)
	database.bufferedWriter = NewBufferedWriter(database.gormdb, database.Logger, 50, 500*time.Millisecond)

	logDir := appDataDir
	if logDir == "" {
		logDir = os.TempDir()
	}
	slowTraceLogger := NewSlowTraceLogger(logDir, 500*time.Millisecond)
	slowTraceLogger.RegisterCallbacks(db)
	database.slowTraceLogger = slowTraceLogger

	// DML asíncrono: migración de datos legacy en segundo plano
	go database.runDataMigrations()

	return database, nil
}

// EnqueueWrite añade una operación de escritura asíncrona al ring buffer.
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

// Shutdown cierra gracefulmente todas las operaciones de base de datos pendientes.
func (db *Database) Shutdown() {
	if db.bufferedWriter != nil {
		db.bufferedWriter.Shutdown()
	}
	if db.slowTraceLogger != nil {
		db.slowTraceLogger.Flush()
	}
}

// Close libera el pool de conexiones subyacente.
func (db *Database) Close() error {
	sqlDB, err := db.gormdb.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// runDataMigrations ejecuta migraciones de datos (DML) en segundo plano
// una vez que el pool WAL está activo y el servidor web responde peticiones.
func (db *Database) runDataMigrations() {
	defer func() {
		if r := recover(); r != nil {
			db.Logger.Error().Interface("panic", r).Msg("db: panic en runDataMigrations")
		}
	}()

	db.Logger.Info().Msg("db: iniciando migración de datos legacy en segundo plano")
	if err := migrateLegacyLocalFiles(db.gormdb); err != nil {
		db.Logger.Error().Err(err).Msg("db: fallo en migración de datos legacy LocalFiles -> LocalFile")
		return
	}
	db.Logger.Info().Msg("db: migración de datos legacy completada")
}

// migrateSchema ejecuta exclusivamente operaciones DDL (AutoMigrate + índices)
// de forma síncrona durante el inicio. No contiene lógica de migración de datos.
func migrateSchema(ctx context.Context, db *gorm.DB) error {
	// Limpia duplicados de LibraryMedia (los TMDB ID deben ser únicos POR TIPO)
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

	// Migración manual: actualiza el índice único de LibraryMedia para manejar
	// colisiones entre películas y series.
	if db.Migrator().HasIndex(&models.LibraryMedia{}, "idx_library_media_tmdb_id") {
		_ = db.Migrator().DropIndex(&models.LibraryMedia{}, "idx_library_media_tmdb_id")
		_ = db.AutoMigrate(&models.LibraryMedia{})
	}

	return nil
}

// migrateLegacyLocalFiles convierte el blob legacy LocalFiles al modelo relacional
// LocalFile. Se ejecuta en segundo plano una vez que el pool WAL está activo.
func migrateLegacyLocalFiles(gormDB *gorm.DB) error {
	var count int64
	gormDB.Model(&models.LocalFiles{}).Count(&count)
	var relationalCount int64
	gormDB.Model(&models.LocalFile{}).Count(&relationalCount)

	if relationalCount == 0 && count > 0 {
		var legacy models.LocalFiles
		if err := gormDB.Last(&legacy).Error; err == nil {
			var lfs []*dto.LocalFile
			if err := json.Unmarshal(legacy.Value, &lfs); err == nil && len(lfs) > 0 {
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
				return gormDB.CreateInBatches(dbFiles, 100).Error
			}
		}
	}
	return nil
}

// RunDatabaseCleanup ejecuta todas las operaciones de limpieza de la base de datos.
func (db *Database) RunDatabaseCleanup() {
	db.cleanupManager.RunAllCleanupOperations()
}

// ResetLocalFilesMediaIds resetea todos los media IDs y library media IDs en la base de datos
// de archivos locales. Fuerza al escáner a re-coincidir todos los archivos en el próximo escaneo.
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

	_ = db.Gorm().Exec("DELETE FROM ghost_associated_media").Error

	db.Logger.Info().Msg("db: All local file media associations and ghost associations have been reset")
	return nil
}
