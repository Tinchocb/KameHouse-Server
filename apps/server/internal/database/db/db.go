package db

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/rs/zerolog"
	"github.com/samber/mo"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util"
)

type Database struct {
	gormdb                  *gorm.DB
	Logger                  *zerolog.Logger
	mediaFillerMu           sync.RWMutex
	CurrMediaFillers        mo.Option[map[int]*MediaFillerItem]
	cleanupManager          *CleanupManager
	bufferedWriter          *BufferedWriter
	OnError                 func(error)
	LibraryMediaCache       sync.Map // L1 read cache scoped to the database instance
	slowTraceLogger         *SlowTraceLogger
	sqlitePath              string
	cancelWal               context.CancelFunc
	currSettings            atomic.Pointer[models.Settings]
	currMediastreamSettings atomic.Pointer[models.MediastreamSettings]

	// Migration status tracking
	migrationMu       sync.RWMutex
	migrationComplete bool
	migrationError    error
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

// NewDatabase initializes the SQLite connection pool with WAL mode and runs
// migración de esquema (DDL) de forma síncrona. La migración de datos
// heredados (DML) se delega a runDataMigrations en segundo plano.
func NewDatabase(ctx context.Context, appDataDir, dbName string, logger *zerolog.Logger) (*Database, error) {
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
		logger.Fatal().Err(err).Msg("db: Failed to perform auto migration. Schema out of date.")
		return nil, err
	}

	logger.Info().Str("name", fmt.Sprintf("%s.db", dbName)).Msg("db: Database instantiated and migrated")

	database := &Database{
		gormdb:           db,
		Logger:           logger,
		CurrMediaFillers: mo.None[map[int]*MediaFillerItem](),
		sqlitePath:       sqlitePath,
	}

	database.cleanupManager = NewCleanupManager(database.gormdb, database.Logger)
	database.bufferedWriter = NewBufferedWriter(database.gormdb, database.Logger, 100, 300*time.Millisecond)

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

	return database, nil
}

// EnqueueWrite añade una operación de escritura asíncrona al ring buffer.
func (db *Database) EnqueueWrite(op DbWriteOperation) {
	if db.bufferedWriter != nil {
		db.bufferedWriter.Enqueue(op)
	} else {
		// Fallback inmediato si no hay buffered writer inicializado
		if err := db.gormdb.Transaction(op); err != nil {
			db.Logger.Error().Err(err).Msg("db: Synchronous fallback write failed")
		}
	}
}

// Shutdown detiene el buffered writer y asegura que todas las escrituras
// pendientes se vuelquen antes de que el proceso termine.
func (db *Database) Shutdown() {
	if db.bufferedWriter != nil {
		db.bufferedWriter.Shutdown()
	}
	if db.slowTraceLogger != nil {
		db.slowTraceLogger.Flush()
	}
	if err := db.gormdb.Exec("PRAGMA wal_checkpoint(TRUNCATE);").Error; err != nil {
		db.Logger.Error().Err(err).Msg("db: Failed to checkpoint WAL on shutdown")
	}
}

func (db *Database) Checkpoint() {
	if err := db.gormdb.Exec("PRAGMA wal_checkpoint(PASSIVE);").Error; err != nil {
		db.Logger.Error().Err(err).Msg("db: Failed to execute WAL checkpoint")
	}
}

// Close libera el pool de conexiones subyacente.
func (db *Database) Close() error {
	if db.cancelWal != nil {
		db.cancelWal()
	}
	sqlDB, err := db.gormdb.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// startDataMigrations inicia las migraciones de datos (DML) en un goroutine background.
// El servidor puede responder peticiones mientras se completan; /api/health
// reporta "degraded" hasta que MigrationStatus() sea complete.
func (db *Database) startDataMigrations(ctx context.Context) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				db.Logger.Error().Interface("panic", r).Msg("db: panic en runDataMigrations")
			}
		}()

		db.Logger.Info().Msg("db: iniciando migraciones de datos en background")
		err := db.runDataMigrationsInternal()
		db.migrationMu.Lock()
		db.migrationComplete = true
		db.migrationError = err
		db.migrationMu.Unlock()
		if err != nil {
			db.Logger.Error().Err(err).Msg("db: fallo en migraciones de datos background")
		} else {
			db.Logger.Info().Msg("db: migraciones de datos background completadas")
		}
	}()
}

// runDataMigrationsInternal contiene la lógica real de migraciones (extraída de runDataMigrations)
func (db *Database) runDataMigrationsInternal() error {
	if err := migrateLegacyLocalFiles(db.gormdb); err != nil {
		db.Logger.Error().Err(err).Msg("db: fallo en migración de datos legacy LocalFiles -> LocalFile")
		return err
	}
	migrateDefaultSettings(db, db.Logger)
	migrateSkipTimesSemantics(db.gormdb, db.Logger)
	seedDragonBallMalIds(db.gormdb, db.Logger)
	healDragonBallKai(db, db.Logger)
	healDragonBallMoviesAndSpecials(db, db.Logger)
	healDragonBallShortsArt(db, db.Logger)
	purgeStaleSkipTimes(db, db.Logger)
	purgeEdlessAnimeThemesSkipTimes(db, db.Logger)
	defaultAutoDetectSkipTimes(db, db.Logger)
	migratePlaybackAndPerformanceDefaults(db, db.Logger)
	return nil
}

// MigrationStatus returns the current migration status
func (db *Database) MigrationStatus() (complete bool, err error) {
	db.migrationMu.RLock()
	defer db.migrationMu.RUnlock()
	return db.migrationComplete, db.migrationError
}

// migrateSchema ejecuta exclusivamente operaciones DDL (AutoMigrate + índices)
// de forma síncrona durante el inicio. No contiene lógica de migración de datos.
func migrateSchema(ctx context.Context, db *gorm.DB, logger *zerolog.Logger) error {
	// Limpia duplicados de LibraryMedia (los TMDB ID deben ser únicos POR TIPO)
	if err := db.Exec(`
		DELETE FROM library_media
		WHERE tmdb_id IS NOT NULL
		  AND tmdb_id != 0
		  AND id NOT IN (
			SELECT MIN(id)
			FROM library_media
			WHERE tmdb_id IS NOT NULL AND tmdb_id != 0
			GROUP BY tmdb_id, type
		  )
		`).Error; err != nil {
		logger.Warn().Err(err).Msg("db: notice while cleaning duplicate library_media entries")
	}

	if err := db.WithContext(ctx).AutoMigrate(
		&models.LocalFile{},
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
		&models.ProviderMapping{},
		&models.MediaEntryListData{},
		&models.WatchHistory{},
		&models.UserMediaProgress{},

		&models.MetadataCache{},
		&models.EpisodeSkipTime{},
		&models.ShelvedLocalFiles{},
		&models.Notification{},
	); err != nil {
		return err
	}

	// 1. Eliminar duplicados de watch_histories antes de crear el índice único compuesto
	if err := db.Exec(`
		DELETE FROM watch_histories
		WHERE id NOT IN (
			SELECT MAX(id)
			FROM watch_histories
			GROUP BY account_id, media_id, episode_number
		)
	`).Error; err != nil {
		logger.Warn().Err(err).Msg("db: notice while deduplicating watch_histories")
	}

	// 2. Asegurar que el índice único compuesto exista para evitar errores de ON CONFLICT.
	// Bases antiguas tienen un idx_media_episode sobre (account_id, library_media_id,
	// episode_number): con el mismo nombre, el IF NOT EXISTS de abajo no lo reemplaza
	// y cada upsert del historial falla. Si las columnas no coinciden, se recrea
	// (borrar un índice no toca filas).
	if !indexHasColumns(db, "idx_media_episode", "account_id", "media_id", "episode_number") {
		if err := db.Exec("DROP INDEX IF EXISTS idx_media_episode").Error; err != nil {
			logger.Error().Err(err).Msg("db: failed to drop legacy idx_media_episode")
		}
	}
	if err := db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_media_episode ON watch_histories (account_id, media_id, episode_number)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create unique index on watch_histories")
	}

	// 3. Índices compuestos para consultas de alto tráfico (Continue Watching, catálogo, escaneo y caché)
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_watch_history_acc_updated ON watch_histories (account_id, updated_at DESC)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_watch_history_acc_updated")
	}
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_library_media_mal_id ON library_media (myanimelist_id)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_library_media_mal_id")
	}
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_library_media_type_format ON library_media (type, format)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_library_media_type_format")
	}
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_local_file_media_locked ON local_file (media_id, locked)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_local_file_media_locked")
	}
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_local_file_lib_media ON local_file (library_media_id)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_local_file_lib_media")
	}
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_metadata_cache_provider_key ON metadata_caches (provider, key)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_metadata_cache_provider_key")
	}
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_media_entry_list_status ON media_entry_list_data (status)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_media_entry_list_status")
	}
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_media_filler_media_id ON media_fillers (media_id)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_media_filler_media_id")
	}
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_library_episodes_media_ep ON library_episodes (library_media_id, episode_number)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_library_episodes_media_ep")
	}
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_local_file_media_ignored_locked ON local_file (media_id, ignored, locked)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_local_file_media_ignored_locked")
	}

	// Migración manual: actualiza el índice único de LibraryMedia para manejar
	// colisiones entre películas y series.
	if db.Migrator().HasIndex(&models.LibraryMedia{}, "idx_library_media_tmdb_id") {
		if err := db.Migrator().DropIndex(&models.LibraryMedia{}, "idx_library_media_tmdb_id"); err != nil {
			logger.Warn().Err(err).Msg("db: notice while dropping idx_library_media_tmdb_id")
		}
		_ = db.AutoMigrate(&models.LibraryMedia{})
	}

	return nil
}

// migrateLegacyLocalFiles convierte el blob legacy LocalFiles al modelo relacional
// LocalFile. Se ejecuta en segundo plano una vez que el pool WAL está activo.
// indexHasColumns informa si el índice existe y cubre exactamente esas columnas,
// en ese orden (SQLite: PRAGMA index_info).
func indexHasColumns(db *gorm.DB, index string, columns ...string) bool {
	var info []struct {
		Seqno int
		Name  string
	}
	if err := db.Raw("SELECT seqno, name FROM pragma_index_info(?) ORDER BY seqno", index).Scan(&info).Error; err != nil {
		return false
	}
	if len(info) != len(columns) {
		return false
	}
	for i, col := range columns {
		if info[i].Name != col {
			return false
		}
	}
	return true
}

func migrateLegacyLocalFiles(gormDB *gorm.DB) error {
	if !gormDB.Migrator().HasTable("local_files") {
		return nil
	}
	var count int64
	gormDB.Table("local_files").Count(&count)
	var relationalCount int64
	gormDB.Model(&models.LocalFile{}).Count(&relationalCount)

	if relationalCount == 0 && count > 0 {
		var legacy models.LocalFiles
		if err := gormDB.Table("local_files").Last(&legacy).Error; err == nil {
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
						MediaID:        f.MediaID,
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

				if err := gormDB.Transaction(func(tx *gorm.DB) error {
					if err := tx.CreateInBatches(dbFiles, 100).Error; err != nil {
						return err
					}
					return tx.Migrator().DropTable("local_files")
				}); err != nil {
					return err
				}
				return nil
			}
		}
	}

	// Si no hay datos pendientes por migrar, purgar la tabla legacy de forma segura
	if gormDB.Migrator().HasTable("local_files") {
		_ = gormDB.Migrator().DropTable("local_files")
	}
	return nil
}

// migrationDone devuelve true si la migración one-shot ya se aplicó.
// Ante error de lectura del gate devuelve true (fail closed): la migración se
// omite este arranque en vez de re-ejecutarse a ciegas, lo que podría
// re-purgar filas o pisar elecciones del usuario. Se reintenta al próximo arranque.
func migrationDone(d *Database, logger *zerolog.Logger, migrationKey string) bool {
	var done bool
	ok, err := GetMetadataCache(d, "migrations", migrationKey, &done)
	if err != nil {
		logger.Warn().Err(err).Str("migration", migrationKey).Msg("db: no se pudo leer el gate de migración, se omite este arranque")
		return true
	}
	return ok && done
}

// migrateDefaultSettings aplica valores por defecto a columnas booleanas que se
// almacenaron históricamente como false pero cuyo default correcto es true.
// Se ejecuta una sola vez usando metadata_cache como gate para no pisar cambios del usuario.
func migrateDefaultSettings(d *Database, logger *zerolog.Logger) {
	const migrationKey = "default_auto_play_next_episode_v1"
	if migrationDone(d, logger, migrationKey) {
		return
	}
	result := d.gormdb.Exec("UPDATE settings SET library_auto_play_next_episode = 1 WHERE library_auto_play_next_episode = 0")
	if result.Error != nil {
		logger.Error().Err(result.Error).Msg("db: fallo al migrar auto_play_next_episode")
		return
	}
	if result.RowsAffected > 0 {
		logger.Info().Int64("rows", result.RowsAffected).Msg("db: auto_play_next_episode habilitado en configuración existente (one-shot)")
	}
	if err := UpsertMetadataCache(d, "migrations", migrationKey, true, 0); err != nil {
		logger.Error().Err(err).Msg("db: no se pudo marcar default_auto_play_next_episode como completado")
	}
}

// defaultAutoDetectSkipTimes habilita, UNA SOLA VEZ, el scan oportunista de
// skip times en la configuración existente. Se gatea con metadata_cache para no
// re-encender el flag en cada arranque si el usuario lo apagó a propósito.
func defaultAutoDetectSkipTimes(d *Database, logger *zerolog.Logger) {
	const migrationKey = "default_auto_detect_skip_times_v1"
	if migrationDone(d, logger, migrationKey) {
		return
	}
	result := d.gormdb.Exec("UPDATE settings SET library_auto_detect_skip_times = 1 WHERE library_auto_detect_skip_times = 0")
	if result.Error != nil {
		logger.Error().Err(result.Error).Msg("db: fallo al habilitar auto_detect_skip_times")
		return
	}
	if result.RowsAffected > 0 {
		logger.Info().Int64("rows", result.RowsAffected).Msg("db: auto_detect_skip_times habilitado en configuración existente (one-shot)")
	}
	if err := UpsertMetadataCache(d, "migrations", migrationKey, true, 0); err != nil {
		logger.Error().Err(err).Msg("db: no se pudo marcar default_auto_detect_skip_times como completado")
	}
}

// migratePlaybackAndPerformanceDefaults aplica defaults a las columnas nuevas
// (preferencias de reproducción y perfil de rendimiento, antes solo-localStorage).
// Se ejecuta una sola vez con gate en metadata_cache para no pisar cambios del usuario.
func migratePlaybackAndPerformanceDefaults(d *Database, logger *zerolog.Logger) {
	const migrationKey = "playback_performance_defaults_v1"
	if migrationDone(d, logger, migrationKey) {
		return
	}
	stmts := []string{
		"UPDATE settings SET library_preferred_audio_profile = 'latino' WHERE library_preferred_audio_profile = '' OR library_preferred_audio_profile IS NULL",
		"UPDATE settings SET library_auto_disable_subtitles_when_dubbed = 1 WHERE library_auto_disable_subtitles_when_dubbed = 0",
		"UPDATE mediastream_settings SET performance_profile = 'auto' WHERE performance_profile = '' OR performance_profile IS NULL",
		"UPDATE mediastream_settings SET auto_governor_enabled = 1 WHERE auto_governor_enabled = 0",
	}
	for _, s := range stmts {
		if result := d.gormdb.Exec(s); result.Error != nil {
			logger.Warn().Err(result.Error).Str("stmt", s).Msg("db: notice en migración playback/performance (tabla o columna aún no existe)")
		} else if result.RowsAffected > 0 {
			logger.Info().Int64("rows", result.RowsAffected).Str("stmt", s).Msg("db: defaults playback/performance aplicados (one-shot)")
		}
	}
	if err := UpsertMetadataCache(d, "migrations", migrationKey, true, 0); err != nil {
		logger.Error().Err(err).Msg("db: no se pudo marcar playback_performance_defaults como completado")
	}
}

// migrateSkipTimesSemantics normaliza los valores relativos de edOffset a absolutos
// y clasifica el source basado en heurísticas.
func migrateSkipTimesSemantics(gormDB *gorm.DB, logger *zerolog.Logger) {
	var count int64
	gormDB.Model(&models.EpisodeSkipTime{}).Where("source = ?", "legacy").Count(&count)
	if count == 0 {
		return // already migrated
	}

	logger.Info().Msg("db: migrando semántica de EpisodeSkipTime (relativo -> absoluto)")

	var times []models.EpisodeSkipTime
	if err := gormDB.Where("source = ?", "legacy").Find(&times).Error; err != nil {
		logger.Error().Err(err).Msg("db: fallo al leer EpisodeSkipTime para migrar")
		return
	}

	migrated := 0
	// Bulk update in batches of 500 to avoid N+1 Save()
	for i := 0; i < len(times); i += 500 {
		end := i + 500
		if end > len(times) {
			end = len(times)
		}
		batch := times[i:end]

		err := gormDB.Transaction(func(tx *gorm.DB) error {
			for _, t := range batch {
				updated := false
				if t.EdEnd > 0 {
					diff := t.EdEnd - t.EdOffset
					if t.EdOffset < t.EdEnd && diff <= 300 {
						t.Source = "manual"
						updated = true
					} else if diff > 300 {
						t.EdOffset = t.EdEnd - t.EdOffset
						if t.EdOffset < 0 {
							t.EdOffset = 0
						}
						t.Source = "aniskip"
						updated = true
					}
				} else if t.EdOffset > 0 {
					t.Source = "fingerprint"
					updated = true
				}
				if updated {
					if err := tx.Save(&t).Error; err != nil {
						return err
					}
					migrated++
				}
			}
			return nil
		})
		if err != nil {
			logger.Error().Err(err).Msg("db: fallo en batch migrate SkipTimes")
			return
		}
	}

	if migrated > 0 {
		logger.Info().Int("count", migrated).Msg("db: semántica de EpisodeSkipTime migrada correctamente")
	}
}

// seedDragonBallMalIds corrige de forma autoritativa el myanimelist_id para las 5 series
// Dragon Ball usando el mapeo TMDB→MAL hardcodeado. Es idempotente: solo actualiza filas
// cuyo myanimelist_id no coincida con el valor correcto.
func seedDragonBallMalIds(gormDB *gorm.DB, logger *zerolog.Logger) {
	// Mapa TMDB ID → MAL ID. Coextensivo con dragonBallArcs en
	// internal/library/anime/intelligence.go.
	dragonBallMap := map[int]int{
		12609:  223,   // Dragon Ball
		12971:  813,   // Dragon Ball Z
		12697:  225,   // Dragon Ball GT
		61709:  6033,  // Dragon Ball Kai
		42705:  6033,  // Dragon Ball Kai
		62715:  30694, // Dragon Ball Super
		236994: 56894, // Dragon Ball Daima
	}
	total := int64(0)
	for tmdbID, malID := range dragonBallMap {
		result := gormDB.Exec(
			"UPDATE library_media SET myanimelist_id = ? WHERE tmdb_id = ? AND myanimelist_id <> ?",
			malID, tmdbID, malID,
		)
		if result.Error != nil {
			logger.Error().Err(result.Error).
				Int("tmdbID", tmdbID).Int("malID", malID).
				Msg("db: fallo al sembrar MAL ID para Dragon Ball")
		} else if result.RowsAffected > 0 {
			logger.Info().
				Int("tmdbID", tmdbID).Int("malID", malID).Int64("rows", result.RowsAffected).
				Msg("db: MAL ID de Dragon Ball corregido")
			total += result.RowsAffected
		}
	}
	if total > 0 {
		logger.Info().Int64("total", total).Msg("db: MAL IDs Dragon Ball sembrados correctamente")
	}
}

// healDragonBallKai repara automáticamente en la base de datos el conteo de episodios
// de Dragon Ball Kai (167 canónicos) y restaura como episodios regulares (tipo main)
// cualquier archivo de Kai que hubiera sido erróneamente clasificado como 'special'.
func healDragonBallKai(d *Database, logger *zerolog.Logger) {
	const migrationKey = "heal_dragonball_kai_v1"
	if migrationDone(d, logger, migrationKey) {
		return
	}

	// 1. Asegurar 167 episodios en library_media para Dragon Ball Kai
	resMedia := d.gormdb.Exec("UPDATE library_media SET total_episodes = 167 WHERE tmdb_id IN (61709, 42705) AND (total_episodes IS NULL OR total_episodes < 167)")
	if resMedia.Error != nil {
		logger.Warn().Err(resMedia.Error).Msg("db: error actualizando total_episodes de Dragon Ball Kai")
	} else if resMedia.RowsAffected > 0 {
		logger.Info().Int64("rows", resMedia.RowsAffected).Msg("db: total_episodes de Dragon Ball Kai actualizado a 167")
	}

	// 2. Corregir cualquier local_file de Kai que haya sido clasificado erróneamente como 'special'
	// Bulk fetch + batch update instead of per-row Update()
	var kaiFiles []*models.LocalFile
	if err := d.gormdb.Where("media_id IN (61709, 42705)").Find(&kaiFiles).Error; err == nil {
		type fixItem struct {
			id      uint
			meta    []byte
			path    string
			episode int
		}
		var fixes []fixItem
		for _, f := range kaiFiles {
			if len(f.Metadata) == 0 {
				continue
			}
			var meta dto.LocalFileMetadata
			if err := json.Unmarshal(f.Metadata, &meta); err == nil {
				if meta.Type == dto.LocalFileTypeSpecial {
					meta.Type = dto.LocalFileTypeMain
					if len(f.ParsedData) > 0 {
						var parsed dto.LocalFileParsedData
						if err := json.Unmarshal(f.ParsedData, &parsed); err == nil && len(parsed.Episode) > 0 {
							if epNum, ok := util.StringToInt(parsed.Episode); ok && epNum > 0 {
								meta.Episode = epNum
								meta.Episodes = []int{epNum}
								meta.AniDBEpisode = strconv.Itoa(epNum)
							}
						}
					}
					if newMetaBytes, err := json.Marshal(meta); err == nil {
						fixes = append(fixes, fixItem{id: f.ID, meta: newMetaBytes, path: f.Path, episode: meta.Episode})
					}
				}
			}
		}
		// Batch update in chunks of 500
		for i := 0; i < len(fixes); i += 500 {
			end := i + 500
			if end > len(fixes) {
				end = len(fixes)
			}
			batch := fixes[i:end]

			err := d.gormdb.Transaction(func(tx *gorm.DB) error {
				for _, fx := range batch {
					if err := tx.Model(&models.LocalFile{}).Where("id = ?", fx.id).Update("metadata", fx.meta).Error; err != nil {
						return err
					}
				}
				return nil
			})
			if err != nil {
				logger.Error().Err(err).Msg("db: fallo en batch heal Kai files")
				continue
			}
			for _, fx := range batch {
				if fx.episode > 0 {
					logger.Info().Str("path", fx.path).Int("episode", fx.episode).Msg("db: restaurado archivo de Dragon Ball Kai a episodio principal")
				}
			}
		}
	}

	if err := UpsertMetadataCache(d, "migrations", migrationKey, true, 0); err != nil {
		logger.Error().Err(err).Msg("db: no se pudo marcar heal_dragonball_kai_v1 como completado")
	}
}

// healDragonBallMoviesAndSpecials repara colisiones de TMDB (como TMDB 39322 Dark Nature)
// y registros huérfanos/incompletos de Dragon Ball Serie sin póster para los 6 especiales educativos y de colaboración.
func healDragonBallMoviesAndSpecials(d *Database, logger *zerolog.Logger) {
	const migrationKey = "heal_dragonball_movies_and_specials_v2"
	if migrationDone(d, logger, migrationKey) {
		return
	}

	// 1. Corregir colisión Dark Nature -> Dragon Ball: Seguridad Vial de Goku
	resDarkNature := d.gormdb.Exec(`
		UPDATE library_media
		SET title_spanish = ?, title_english = ?, title_romaji = ?, description = ?,
		    poster_image = ?, banner_image = ?, year = 1988, genres = NULL, tags = NULL,
		    format = 'MOVIE', type = 'MOVIE'
		WHERE tmdb_id = 39322 OR id = 1039322 OR LOWER(title_spanish) LIKE '%dark nature%' OR LOWER(title_english) LIKE '%dark nature%'
	`,
		"Dragon Ball: Seguridad Vial de Goku",
		"Dragon Ball: Goku's Traffic Safety",
		"Dragon Ball: Gokū no Kōtsū Anzen",
		"Cortometraje educativo donde Goku viaja a la Capital del Oeste para celebrar el cumpleaños de Bulma, aprendiendo las normas de tráfico y seguridad vial peatonal.",
		"https://image.tmdb.org/t/p/w500/iM7Rn5oziVlPEhQ7eyCHcYEy5vu.jpg",
		"https://image.tmdb.org/t/p/original/xX4nWD5tZiHVTNyWscZR5s3iVH.jpg",
	)
	if resDarkNature.Error != nil {
		logger.Warn().Err(resDarkNature.Error).Msg("db: error corrigiendo colisión Dark Nature")
	} else if resDarkNature.RowsAffected > 0 {
		logger.Info().Int64("rows", resDarkNature.RowsAffected).Msg("db: colisión Dark Nature reparada a Dragon Ball: Seguridad Vial")
	}

	// 2. Eliminar entradas huérfanas de Dragon Ball Serie sin póster que no tengan archivos locales asociados
	d.gormdb.Exec(`
		DELETE FROM library_media
		WHERE (title_spanish = 'Dragon Ball Serie' OR title_spanish = 'Dragon Ball Series')
		  AND (poster_image IS NULL OR poster_image = '')
		  AND id NOT IN (SELECT DISTINCT library_media_id FROM local_file WHERE library_media_id IS NOT NULL AND library_media_id != 0)
	`)

	// 3. Para las que sí tengan archivos locales o coincidan con los IDs de los 6 especiales, hidratar correctamente
	type specUpdate struct {
		tmdbId  int
		spanish string
		english string
		romaji  string
		desc    string
		poster  string
		banner  string
		year    int
	}
	specials := []specUpdate{
		{
			tmdbId:  39321,
			spanish: "Dragon Ball: El Cuerpo de Bomberos de Goku",
			english: "Dragon Ball: Goku's Fire Brigade",
			romaji:  "Dragon Ball: Gokū no Shōbōtai",
			desc:    "Cortometraje educativo en el que Goku, Krilin, Yamcha y el Maestro Roshi enseñan lecciones vitales de prevención y seguridad contra incendios ante situaciones de emergencia.",
			poster:  "https://image.tmdb.org/t/p/w500/k0QRU1UpJCvoConl1CSlz1RF54s.jpg",
			banner:  "https://image.tmdb.org/t/p/original/tZuNziXpjmOsDlmiT6adFPmmSKT.jpg",
			year:    1988,
		},
		{
			tmdbId:  39322,
			spanish: "Dragon Ball: Seguridad Vial de Goku",
			english: "Dragon Ball: Goku's Traffic Safety",
			romaji:  "Dragon Ball: Gokū no Kōtsū Anzen",
			desc:    "Cortometraje educativo donde Goku viaja a la Capital del Oeste para celebrar el cumpleaños de Bulma, aprendiendo las normas de tráfico y seguridad vial peatonal.",
			poster:  "https://image.tmdb.org/t/p/w500/iM7Rn5oziVlPEhQ7eyCHcYEy5vu.jpg",
			banner:  "https://image.tmdb.org/t/p/original/xX4nWD5tZiHVTNyWscZR5s3iVH.jpg",
			year:    1988,
		},
		{
			tmdbId:  39325,
			spanish: "Dragon Ball Z: ¡Todos Reunidos! El Mundo de Goku",
			english: "Dragon Ball Z: Gather Together! Goku's World",
			romaji:  "Dragon Ball Z: Atsumare! Gokū Wārudo",
			desc:    "Especial interactivo para Terebikko donde Goku, Gohan, Krilin y Trunks viajan en la máquina del tiempo repasando batallas pasadas mientras enfrentan a Cell.",
			poster:  "https://image.tmdb.org/t/p/w500/ydf1CeiBLfdxiyNTpskM0802TKl.jpg",
			banner:  "https://image.tmdb.org/t/p/original/u3nEeIkCR7mcpEJXZpUGUTLmF3O.jpg",
			year:    1992,
		},
		{
			tmdbId:  39326,
			spanish: "Dragon Ball Z: ¡Te lo Mostramos Todo! Olvida el Año con Dragon Ball Z",
			english: "Dragon Ball Z: Looking Back at it All: The Year-End Show",
			romaji:  "Dragon Ball Z: Nenmatsu Tokuban Kessaku Renpatsu Dai Hōsō",
			desc:    "Especial televisivo de fin de año donde Goku y Gohan con atuendo formal repasan los momentos y batallas cumbre de la saga de los Saiyajin, Freezer y Cell.",
			poster:  "https://image.tmdb.org/t/p/w500/ydf1CeiBLfdxiyNTpskM0802TKl.jpg",
			banner:  "https://image.tmdb.org/t/p/original/u3nEeIkCR7mcpEJXZpUGUTLmF3O.jpg",
			year:    1993,
		},
		{
			tmdbId:  105973,
			spanish: "Dragon Ball Z: Los Aventureros de la Esfera del Pánico Regresan",
			english: "Dragon Ball Z: Kyutai Panic Adventure Returns!",
			romaji:  "Dragon Ball Z: Kyūtai Panikku Adobenchā Ritānzu!",
			desc:    "Especial de animación exclusivo de Fuji TV donde Goku y los Guerreros Z unen fuerzas con Luffy y los piratas de Sombrero de Paja para defender la sede esférica.",
			poster:  "https://image.tmdb.org/t/p/w500/ydf1CeiBLfdxiyNTpskM0802TKl.jpg",
			banner:  "https://image.tmdb.org/t/p/original/u3nEeIkCR7mcpEJXZpUGUTLmF3O.jpg",
			year:    2004,
		},
		{
			tmdbId:  444390,
			spanish: "Dream 9: Toriko x One Piece x Dragon Ball Z Super Colaboración",
			english: "Dream 9: Toriko & One Piece & Dragon Ball Z Super Collaboration Special!!",
			romaji:  "Dream 9: Toriko & One Piece & Dragon Ball Z Chō Collaboration Special!!",
			desc:    "Histórico crossover donde Goku, Toriko y Luffy compiten en la Carrera de la Organización Gourmet Internacional y enfrentan juntos a una voraz criatura marina.",
			poster:  "https://image.tmdb.org/t/p/w500/ydf1CeiBLfdxiyNTpskM0802TKl.jpg",
			banner:  "https://image.tmdb.org/t/p/original/u3nEeIkCR7mcpEJXZpUGUTLmF3O.jpg",
			year:    2013,
		},
	}

	for _, sp := range specials {
		d.gormdb.Exec(`
			UPDATE library_media
			SET title_spanish = ?, title_english = ?, title_romaji = ?, description = ?, poster_image = ?, banner_image = ?, year = ?, format = 'MOVIE', type = 'MOVIE'
			WHERE (tmdb_id = ? OR id = ? OR id = ?) AND (poster_image IS NULL OR poster_image = '' OR title_spanish = 'Dragon Ball Serie' OR title_spanish = 'Dragon Ball Series')
		`, sp.spanish, sp.english, sp.romaji, sp.desc, sp.poster, sp.banner, sp.year, sp.tmdbId, sp.tmdbId, sp.tmdbId+1000000)
	}

	if err := UpsertMetadataCache(d, "migrations", migrationKey, true, 0); err != nil {
		logger.Error().Err(err).Msg("db: no se pudo marcar heal_dragonball_movies_and_specials_v2 como completado")
	}
}

// healDragonBallShortsArt corrige, UNA SOLA VEZ, el arte de los dos cortos
// educativos de 1988. heal_dragonball_movies_and_specials_v2 les puso el
// backdrop horizontal de la serie como póster (se veía recortado en las cards
// 2:3); en TMDB viven como 1305965 (Bomberos) y 1259215 (Seguridad Vial).
// Solo pisa filas que todavía tienen ese póster heredado.
func healDragonBallShortsArt(d *Database, logger *zerolog.Logger) {
	const migrationKey = "heal_dragonball_shorts_art_v1"
	if migrationDone(d, logger, migrationKey) {
		return
	}

	const legacyPoster = "https://image.tmdb.org/t/p/w500/30L49n4Dhn7dzuGG50GV3ybMhC3.jpg"
	shorts := []struct {
		tmdbID         int
		poster, banner string
	}{
		{39321, "https://image.tmdb.org/t/p/w500/k0QRU1UpJCvoConl1CSlz1RF54s.jpg", "https://image.tmdb.org/t/p/original/tZuNziXpjmOsDlmiT6adFPmmSKT.jpg"},
		{39322, "https://image.tmdb.org/t/p/w500/iM7Rn5oziVlPEhQ7eyCHcYEy5vu.jpg", "https://image.tmdb.org/t/p/original/xX4nWD5tZiHVTNyWscZR5s3iVH.jpg"},
	}
	for _, sh := range shorts {
		res := d.gormdb.Exec(`
			UPDATE library_media SET poster_image = ?, banner_image = ?
			WHERE (tmdb_id = ? OR id = ?) AND poster_image = ?
		`, sh.poster, sh.banner, sh.tmdbID, sh.tmdbID+1000000, legacyPoster)
		if res.Error != nil {
			logger.Warn().Err(res.Error).Int("tmdbId", sh.tmdbID).Msg("db: error corrigiendo arte de corto de Dragon Ball")
			return
		}
	}

	if err := UpsertMetadataCache(d, "migrations", migrationKey, true, 0); err != nil {
		logger.Error().Err(err).Msg("db: no se pudo marcar heal_dragonball_shorts_art_v1 como completado")
	}
}

// purgeStaleSkipTimes borra, UNA SOLA VEZ, las marcas de skip corruptas
// generadas por el detector de fingerprint acústico legacy (source
// 'fingerprint') y las manuales heredadas de esa época. Antes corría en cada
// arranque, lo que borraba también las filas 'manual' nuevas y hubiera borrado
// cualquier resultado del detector reescrito si reusara esas etiquetas. Se
// gatea con un flag en metadata_cache para que las marcas nuevas sobrevivan a
// los reinicios. Las nuevas fuentes ('animethemes', 'fpcross', 'subtitle') no
// están en la lista, así que nunca son purgadas.
func purgeStaleSkipTimes(d *Database, logger *zerolog.Logger) {
	const migrationKey = "purge_stale_skip_times_v1"
	if migrationDone(d, logger, migrationKey) {
		return
	}

	result := d.gormdb.Exec("DELETE FROM episode_skip_times WHERE source IN ('fingerprint','manual')")
	if result.Error != nil {
		logger.Error().Err(result.Error).Msg("db: fallo al purgar skip times obsoletos")
		return
	}
	if result.RowsAffected > 0 {
		logger.Info().Int64("rows", result.RowsAffected).Msg("db: skip times fingerprint/manual legacy purgados (one-shot)")
	}

	if err := UpsertMetadataCache(d, "migrations", migrationKey, true, 0); err != nil {
		logger.Error().Err(err).Msg("db: no se pudo marcar purge_stale_skip_times como completado")
	}
}

// purgeEdlessAnimeThemesSkipTimes borra, UNA SOLA VEZ, las filas 'animethemes'
// que quedaron sin outro (ed_offset = 0). Las escribió una versión con un bug en
// skipdetect.FingerprintRange: no le pasaba -length a fpcalc, que trunca a 120 s
// por defecto, así que de la ventana de outro (480 s) solo se huellaban los
// primeros 120 s y el ED —que vive al final del episodio— nunca se encontraba.
//
// Hace falta borrarlas porque 'animethemes' es una fuente protegida: un re-scan
// las saltearía y el fix no llegaría nunca a quien ya escaneó. Al borrarlas, el
// próximo scan re-detecta OP y ED de esos episodios. Los episodios que
// legítimamente no tienen ED (p. ej. fuera del rango del theme) se re-escriben
// con ed_offset = 0 y, al ser one-shot, ya no se vuelven a purgar.
func purgeEdlessAnimeThemesSkipTimes(d *Database, logger *zerolog.Logger) {
	const migrationKey = "purge_edless_animethemes_skip_times_v1"
	if migrationDone(d, logger, migrationKey) {
		return
	}

	result := d.gormdb.Exec("DELETE FROM episode_skip_times WHERE source = 'animethemes' AND ed_offset = 0")
	if result.Error != nil {
		logger.Error().Err(result.Error).Msg("db: fallo al purgar skip times de animethemes sin ED")
		return
	}
	if result.RowsAffected > 0 {
		logger.Info().Int64("rows", result.RowsAffected).
			Msg("db: skip times de animethemes sin ED purgados (one-shot); se re-detectan en el próximo scan")
	}

	if err := UpsertMetadataCache(d, "migrations", migrationKey, true, 0); err != nil {
		logger.Error().Err(err).Msg("db: no se pudo marcar purge_edless_animethemes_skip_times como completado")
	}
}

// RunDatabaseCleanup ejecuta todas las operaciones de limpieza de la base de datos.
func (db *Database) RunDatabaseCleanup() {
	db.cleanupManager.RunAllCleanupOperations()
}

// ResetLocalFilesMediaIds resetea todos los media IDs y library media IDs en la base de datos
// de archivos locales. Fuerza al escáner a re-coincidir todos los archivos en el próximo escaneo.
// Bulk UPDATE instead of per-row Save() to avoid O(N) writes and WAL lock contention.
func (db *Database) ResetLocalFilesMediaIds() error {
	err := db.gormdb.Transaction(func(tx *gorm.DB) error {
		// Single bulk UPDATE sets both FKs to 0
		if err := tx.Model(&models.LocalFile{}).Updates(map[string]interface{}{
			"media_id":         0,
			"library_media_id": 0,
		}).Error; err != nil {
			return err
		}
		// Clear ghost associations in same transaction
		if err := tx.Exec("DELETE FROM ghost_associated_media").Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		db.Logger.Error().Err(err).Msg("db: Failed to reset local file media associations")
		return err
	}

	InvalidateLocalFilesCache()
	db.Logger.Info().Msg("db: All local file media associations and ghost associations have been reset")
	return nil
}
