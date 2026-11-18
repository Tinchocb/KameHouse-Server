package db

import (
	"context"
	"kamehouse/internal/database/models"
	"time"

	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

// CleanupManager manages database cleanup operations to prevent concurrent access issues
type CleanupManager struct {
	gormdb *gorm.DB
	logger *zerolog.Logger
}

func NewCleanupManager(gormdb *gorm.DB, logger *zerolog.Logger) *CleanupManager {
	return &CleanupManager{
		gormdb: gormdb,
		logger: logger,
	}
}

func (cm *CleanupManager) RunAllCleanupOperations(ctx context.Context) {
	// Bind the context to a local manager; never mutate the shared GORM handle.
	worker := &CleanupManager{gormdb: cm.gormdb.WithContext(ctx), logger: cm.logger}
	for _, run := range []func(){worker.trimScanSummaryEntries, worker.trimLocalFileEntries,
		worker.removeOrphanedAndCollidedMedia, worker.purgeExpiredMetadataCache} {
		if ctx.Err() != nil {
			return
		}
		run()
	}
	if ctx.Err() == nil {
		cm.logger.Debug().Msg("database: Cleanup operations completed")
	}
}

// trimScanSummaryEntries trims scan summary entries
func (cm *CleanupManager) trimScanSummaryEntries() {
	var count int64
	err := cm.gormdb.Model(&models.ScanSummary{}).Count(&count).Error
	if err != nil {
		if cm.gormdb.Statement.Context.Err() != nil {
			return
		}
		cm.logger.Error().Err(err).Msg("database: Failed to count scan summary entries")
		return
	}
	if count > 10 {
		var idsToDelete []uint
		err = cm.gormdb.Model(&models.ScanSummary{}).
			Select("id").
			Order("id ASC").
			Limit(int(count-5)).
			Pluck("id", &idsToDelete).Error
		if err != nil {
			if cm.gormdb.Statement.Context.Err() != nil {
				return
			}
			cm.logger.Error().Err(err).Msg("database: Failed to get scan summary IDs to delete")
			return
		}

		if len(idsToDelete) > 0 {
			batchSize := 900
			for i := 0; i < len(idsToDelete); i += batchSize {
				if cm.gormdb.Statement.Context.Err() != nil {
					return
				}
				end := i + batchSize
				if end > len(idsToDelete) {
					end = len(idsToDelete)
				}
				batch := idsToDelete[i:end]
				err = cm.gormdb.Delete(&models.ScanSummary{}, batch).Error
				if err != nil {
					if cm.gormdb.Statement.Context.Err() != nil {
						return
					}
					cm.logger.Error().Err(err).Msg("database: Failed to delete old scan summary entries")
					return // Exit on first error
				}
			}
			cm.logger.Debug().Int("deleted", len(idsToDelete)).Msg("database: Deleted old scan summary entries")
		}
	}
}

// trimLocalFileEntries trims local file entries in the legacy blob table.
// The legacy `local_files` blob table is dropped during schema migration once
// its data has been ported to the relational `local_file` model, so on any
// migrated database it simply won't exist. Skip silently in that case instead
// of logging a spurious error on every startup.
func (cm *CleanupManager) trimLocalFileEntries() {
	if !cm.gormdb.Migrator().HasTable("local_files") {
		return
	}

	var count int64
	// Explicitly use the legacy table name to avoid any ambiguity
	err := cm.gormdb.Table("local_files").Count(&count).Error
	if err != nil {
		if cm.gormdb.Statement.Context.Err() != nil {
			return
		}
		cm.logger.Error().Err(err).Msg("database: Failed to count legacy local file entries")
		return
	}
	if count > 10 {
		var idsToDelete []uint
		err = cm.gormdb.Table("local_files").
			Select("id").
			Order("id ASC").
			Limit(int(count-5)).
			Pluck("id", &idsToDelete).Error
		if err != nil {
			if cm.gormdb.Statement.Context.Err() != nil {
				return
			}
			cm.logger.Error().Err(err).Msg("database: Failed to get legacy local file IDs to delete")
			return
		}

		if len(idsToDelete) > 0 {
			batchSize := 900
			for i := 0; i < len(idsToDelete); i += batchSize {
				if cm.gormdb.Statement.Context.Err() != nil {
					return
				}
				end := i + batchSize
				if end > len(idsToDelete) {
					end = len(idsToDelete)
				}
				chunk := idsToDelete[i:end]
				err = cm.gormdb.Delete(&models.LocalFiles{}, chunk).Error
				if err != nil {
					if cm.gormdb.Statement.Context.Err() != nil {
						return
					}
					cm.logger.Error().Err(err).Msg("database: Failed to delete old legacy local file entries")
					return
				}
			}
			cm.logger.Debug().Int("deleted", len(idsToDelete)).Msg("database: Deleted old legacy local file entries (blob storage)")
		}
	}
}

// removeOrphanedAndCollidedMedia removes TV shows/anime that share a TMDB ID
// with a movie AND have no local files associated — they are phantom entries.
// Uses a single SQL JOIN instead of loading all media into Go memory.
func (cm *CleanupManager) removeOrphanedAndCollidedMedia() {
	type collidedRow struct {
		ID           uint
		TmdbID       int
		TitleEnglish string
	}
	var collided []collidedRow

	// Find shows/anime whose tmdb_id collides with a movie AND have no local files.
	// The LEFT JOIN + lf.id IS NULL efficiently performs the "no files" check in SQL.
	err := cm.gormdb.Raw(`
		SELECT s.id, s.tmdb_id, s.title_english
		FROM library_media s
		INNER JOIN library_media m
			ON m.tmdb_id = s.tmdb_id AND m.type = 'MOVIE'
		LEFT JOIN local_file lf
			ON lf.library_media_id = s.id
		WHERE s.type IN ('SHOW', 'ANIME')
		  AND lf.id IS NULL
	`).Scan(&collided).Error

	if err != nil {
		if cm.gormdb.Statement.Context.Err() != nil {
			return
		}
		cm.logger.Error().Err(err).Msg("database cleanup: Failed to find collided media")
		return
	}
	if len(collided) == 0 {
		return
	}

	for _, row := range collided {
		if cm.gormdb.Statement.Context.Err() != nil {
			return
		}
		cm.logger.Warn().
			Uint("id", row.ID).
			Int("tmdbID", row.TmdbID).
			Str("title", row.TitleEnglish).
			Msg("database cleanup: Deleting collided show with no local files")

		err := cm.gormdb.Transaction(func(tx *gorm.DB) error {
			// A scan may have associated files since the discovery query.
			var files int64
			if err := tx.Model(&models.LocalFile{}).Where("library_media_id = ?", row.ID).Count(&files).Error; err != nil {
				return err
			}
			if files != 0 {
				return nil
			}
			if err := tx.Where("library_media_id = ?", row.ID).Delete(&models.LibraryEpisode{}).Error; err != nil {
				return err
			}
			if err := tx.Where("library_media_id = ?", row.ID).Delete(&models.LibrarySeason{}).Error; err != nil {
				return err
			}
			if err := tx.Where("library_media_id = ?", row.ID).Delete(&models.MediaEntryListData{}).Error; err != nil {
				return err
			}
			// History, skip times and filler use public/provider IDs, not this
			// row's PK. Preserve independent state for rescans instead of guessing
			// ownership from numeric equality and erasing another title's data.
			if err := tx.Delete(&models.LibraryMedia{}, row.ID).Error; err != nil {
				return err
			}
			return nil
		})

		if err != nil {
			if cm.gormdb.Statement.Context.Err() != nil {
				return
			}
			cm.logger.Error().Err(err).Uint("id", row.ID).Msg("database cleanup: Failed to delete collided show")
		}
	}
}

// purgeExpiredMetadataCache removes cached metadata rows whose expires_at is in the past.
func (cm *CleanupManager) purgeExpiredMetadataCache() {
	zeroTime := time.Time{}
	res := cm.gormdb.Where("expires_at < ? AND expires_at > ?", time.Now(), zeroTime).Delete(&models.MetadataCache{})
	if res.Error != nil {
		if cm.gormdb.Statement.Context.Err() != nil {
			return
		}
		cm.logger.Error().Err(res.Error).Msg("database cleanup: Failed to delete expired metadata cache entries")
		return
	}
	if res.RowsAffected > 0 {
		cm.logger.Info().Int64("deleted", res.RowsAffected).Msg("database cleanup: Purged expired metadata cache entries")
	}
}
