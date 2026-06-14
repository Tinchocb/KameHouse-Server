package db

import (
	"kamehouse/internal/database/models"

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

func (cm *CleanupManager) RunAllCleanupOperations() {
	cm.logger.Debug().Msg("database: Starting cleanup operations")

	cm.trimScanSummaryEntries()
	cm.trimLocalFileEntries()
	cm.removeOrphanedAndCollidedMedia()

	cm.logger.Debug().Msg("database: Cleanup operations completed")
}

// trimScanSummaryEntries trims scan summary entries
func (cm *CleanupManager) trimScanSummaryEntries() {
	var count int64
	err := cm.gormdb.Model(&models.ScanSummary{}).Count(&count).Error
	if err != nil {
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
			cm.logger.Error().Err(err).Msg("database: Failed to get scan summary IDs to delete")
			return
		}

		if len(idsToDelete) > 0 {
			batchSize := 900
			for i := 0; i < len(idsToDelete); i += batchSize {
				end := i + batchSize
				if end > len(idsToDelete) {
					end = len(idsToDelete)
				}
				batch := idsToDelete[i:end]
				err = cm.gormdb.Delete(&models.ScanSummary{}, batch).Error
				if err != nil {
					cm.logger.Error().Err(err).Msg("database: Failed to delete old scan summary entries")
					return // Exit on first error
				}
			}
			cm.logger.Debug().Int("deleted", len(idsToDelete)).Msg("database: Deleted old scan summary entries")
		}
	}
}

// trimLocalFileEntries trims local file entries in the legacy blob table
func (cm *CleanupManager) trimLocalFileEntries() {
	var count int64
	// Explicitly use the legacy table name to avoid any ambiguity
	err := cm.gormdb.Table("local_files").Count(&count).Error
	if err != nil {
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
			cm.logger.Error().Err(err).Msg("database: Failed to get legacy local file IDs to delete")
			return
		}

		if len(idsToDelete) > 0 {
			err = cm.gormdb.Delete(&models.LocalFiles{}, idsToDelete).Error
			if err != nil {
				cm.logger.Error().Err(err).Msg("database: Failed to delete old legacy local file entries")
				return
			}
			cm.logger.Debug().Int("deleted", len(idsToDelete)).Msg("database: Deleted old legacy local file entries (blob storage)")
		}
	}
}

// removeOrphanedAndCollidedMedia cleans up orphaned TV shows that share TMDB IDs with movies
func (cm *CleanupManager) removeOrphanedAndCollidedMedia() {
	var movies []models.LibraryMedia
	if err := cm.gormdb.Where("type = ?", "MOVIE").Find(&movies).Error; err != nil {
		cm.logger.Error().Err(err).Msg("database cleanup: Failed to fetch movies")
		return
	}

	movieTmdbIds := make(map[int]bool)
	for _, m := range movies {
		movieTmdbIds[m.TmdbID] = true
	}

	var shows []models.LibraryMedia
	if err := cm.gormdb.Where("type IN ?", []string{"SHOW", "ANIME"}).Find(&shows).Error; err != nil {
		cm.logger.Error().Err(err).Msg("database cleanup: Failed to fetch shows")
		return
	}

	var collidedShows []models.LibraryMedia
	var collidedShowIds []uint
	for _, s := range shows {
		if movieTmdbIds[s.TmdbID] {
			collidedShows = append(collidedShows, s)
			collidedShowIds = append(collidedShowIds, s.ID)
		}
	}

	if len(collidedShowIds) == 0 {
		return
	}

	// Bulk check local file associations
	type Result struct {
		LibraryMediaId uint
		Count          int64
	}
	var results []Result
	if err := cm.gormdb.Model(&models.LocalFile{}).
		Select("library_media_id, count(*) as count").
		Where("library_media_id IN ?", collidedShowIds).
		Group("library_media_id").
		Find(&results).Error; err != nil {
		cm.logger.Error().Err(err).Msg("database cleanup: Failed to fetch local file counts")
		return
	}

	hasFilesMap := make(map[uint]bool)
	for _, r := range results {
		if r.Count > 0 {
			hasFilesMap[r.LibraryMediaId] = true
		}
	}

	for _, s := range collidedShows {
		if !hasFilesMap[s.ID] {
			cm.logger.Warn().Uint("id", s.ID).Int("tmdbID", s.TmdbID).Str("title", s.TitleEnglish).Msg("database cleanup: Found collided show with no local files. Deleting.")

			// Start a transaction to delete show and its children safely
			_ = cm.gormdb.Transaction(func(tx *gorm.DB) error {
				_ = tx.Where("library_media_id = ?", s.ID).Delete(&models.LibraryEpisode{})
				_ = tx.Where("library_media_id = ?", s.ID).Delete(&models.LibrarySeason{})
				_ = tx.Where("library_media_id = ?", s.ID).Delete(&models.MediaEntryListData{})
				_ = tx.Delete(&s)
				return nil
			})
		}
	}
}


