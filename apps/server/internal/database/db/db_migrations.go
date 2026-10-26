package db

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/rs/zerolog"
	"gorm.io/gorm"

	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
)

// startDataMigrations inicia las migraciones de datos (DML) en un goroutine background.
// El servidor puede responder peticiones mientras se completan; /api/health
// reporta "degraded" hasta que MigrationStatus() sea complete.
func (db *Database) startDataMigrations(ctx context.Context) {
	db.migrationsDone = make(chan struct{})
	go func() {
		var migrationErr error
		defer func() {
			if r := recover(); r != nil {
				migrationErr = fmt.Errorf("data migration panic: %v", r)
			}
			db.migrationMu.Lock()
			db.migrationComplete = true
			db.migrationError = migrationErr
			db.migrationMu.Unlock()
			close(db.migrationsDone)
			if migrationErr != nil {
				db.Logger.Error().Err(migrationErr).Msg("db: fallo en migraciones de datos background")
			}
		}()

		db.Logger.Info().Msg("db: iniciando migraciones de datos en background")
		migrationErr = db.runDataMigrationsInternal()
		if migrationErr == nil {
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
	seedDaimaAudioProfile(db, db.Logger)
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
	db = db.WithContext(ctx)

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
		&models.ScanSummary{},

		&models.MediaSourcePreference{},
		&models.MediaAudioPreference{},
		&models.Theme{},

		&models.MediastreamSettings{},
		&models.MediaFiller{},
		&models.GhostAssociatedMedia{},
		&models.LibraryMedia{},
		&models.LibraryEpisode{},
		&models.LibrarySeason{},
		&models.MediaEntryListData{},
		&models.WatchHistory{},

		&models.MetadataCache{},
		&models.EpisodeSkipTime{},
		&models.ShelvedLocalFiles{},
		&models.Notification{},
		&models.ChronologyMomentTime{},
		&models.ChronologySpanOverride{},
	); err != nil {
		return err
	}

	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_library_episodes_media_absolute ON library_episodes (library_media_id, absolute_number)").Error; err != nil {
		return fmt.Errorf("create episode absolute-number index: %w", err)
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

	// 3. Índices compuestos para consultas de alto tráfico (catálogo, escaneo y caché).
	// watch_histories no se lee ordenada por updated_at (Continue Watching sale del filecache
	// de continuidad): se retira el índice (account_id, updated_at) que solo costaba escritura.
	if err := db.Exec("DROP INDEX IF EXISTS idx_watch_history_acc_updated").Error; err != nil {
		logger.Warn().Err(err).Msg("db: notice while dropping idx_watch_history_acc_updated")
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
	// Índices redundantes o sin consumidor. AutoMigrate nunca borra índices, así que las
	// bases existentes los conservan hasta que se eliminan aquí (DROP IF EXISTS es idempotente):
	//   - idx_local_file_lib_media duplica idx_local_file_library_media_id (tag de LocalFile).
	//   - idx_metadata_cache_provider_key duplica el único idx_provider_key (provider, key).
	//   - idx_media_filler_media_id es prefijo de idx_media_filler (media_id, provider).
	//   - El resto no lo usa ninguna consulta (status de media_entry_list_data, file_hash de
	//     local_file, suggested_swimlane de library_media y saga de library_episodes).
	for _, idx := range []string{
		"idx_local_file_lib_media",
		"idx_metadata_cache_provider_key",
		"idx_media_filler_media_id",
		"idx_media_entry_list_status",
		"idx_local_file_file_hash",
		"idx_library_media_suggested_swimlane",
		"idx_episode_saga",
	} {
		if err := db.Exec("DROP INDEX IF EXISTS " + idx).Error; err != nil {
			logger.Warn().Err(err).Str("index", idx).Msg("db: failed to drop obsolete index")
		}
	}
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_library_episodes_media_ep ON library_episodes (library_media_id, episode_number)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_library_episodes_media_ep")
	}
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_local_file_media_ignored_locked ON local_file (media_id, ignored, locked)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_local_file_media_ignored_locked")
	}
	// Consultas por tmdb_id sin type (scanner, cronología, selector, intelligence): el único
	// idx_tmdb_id_type es (type, tmdb_id) y no sirve sin type. Con type incluido el índice
	// también cubre las proyecciones id/tmdb_id/type (el id va en el rowid).
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_library_media_tmdb_type ON library_media (tmdb_id, type)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_library_media_tmdb_type")
	}

	// Migración manual: actualiza el índice único de LibraryMedia para manejar
	// colisiones entre películas y series.
	if db.Migrator().HasIndex(&models.LibraryMedia{}, "idx_library_media_tmdb_id") {
		if err := db.Migrator().DropIndex(&models.LibraryMedia{}, "idx_library_media_tmdb_id"); err != nil {
			logger.Warn().Err(err).Msg("db: notice while dropping idx_library_media_tmdb_id")
		}
		// Si falla, el índice viejo ya se eliminó: seguir en silencio dejaría la tabla sin su restricción única.
		if err := db.AutoMigrate(&models.LibraryMedia{}); err != nil {
			return fmt.Errorf("db: re-migrating library_media after index update: %w", err)
		}
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
	return gormDB.Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Table("local_files").Count(&count).Error; err != nil {
			return fmt.Errorf("count legacy local files: %w", err)
		}
		if count == 0 {
			return nil
		}
		var relationalCount int64
		if err := tx.Model(&models.LocalFile{}).Count(&relationalCount).Error; err != nil {
			return fmt.Errorf("count relational local files: %w", err)
		}
		if relationalCount != 0 {
			return fmt.Errorf("legacy local_files and relational local_file both contain data; reconciliation required")
		}
		var legacy models.LocalFiles
		if err := tx.Table("local_files").Last(&legacy).Error; err != nil {
			return fmt.Errorf("read legacy local files: %w", err)
		}
		var lfs []*dto.LocalFile
		if err := json.Unmarshal(legacy.Value, &lfs); err != nil {
			return fmt.Errorf("decode legacy local files: %w", err)
		}
		if lfs == nil {
			return fmt.Errorf("legacy local files snapshot is null")
		}
		dbFiles := make([]*models.LocalFile, 0, len(lfs))
		for i, f := range lfs {
			if f == nil || f.Path == "" {
				return fmt.Errorf("invalid legacy local file at index %d", i)
			}
			m, err := LocalFileDtoToModel(f)
			if err != nil {
				return fmt.Errorf("convert legacy local file %d: %w", i, err)
			}
			dbFiles = append(dbFiles, m)
		}
		if len(dbFiles) > 0 {
			if err := tx.CreateInBatches(dbFiles, 100).Error; err != nil {
				return fmt.Errorf("insert legacy local files: %w", err)
			}
		}
		return tx.Migrator().DropTable("local_files")
	})
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
