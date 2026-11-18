package db

import (
	"context"
	"errors"
	"time"

	"kamehouse/internal/database/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrAssignmentPathNotFound = errors.New("assignment path not found in library")

// AssignLibraryMediaFiles commits the metadata and only the requested file
// assignments together. Unrelated files and their scan metadata stay untouched.
func AssignLibraryMediaFiles(ctx context.Context, d *Database, media *models.LibraryMedia, publicID int, paths []string) error {
	unique := make(map[string]struct{}, len(paths))
	for _, path := range paths {
		unique[path] = struct{}{}
	}
	err := d.Gorm().WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Write first to acquire SQLite's writer lock before reading; upgrading a
		// deferred read transaction can fail with SQLITE_BUSY under concurrent assigns.
		if err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "tmdb_id"}, {Name: "type"}}, UpdateAll: true,
		}).Create(media).Error; err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&models.LocalFile{}).Where("path IN ?", paths).Count(&count).Error; err != nil {
			return err
		}
		if count != int64(len(unique)) {
			return ErrAssignmentPathNotFound
		}
		return tx.Model(&models.LocalFile{}).Where("path IN ?", paths).Updates(map[string]interface{}{
			"media_id": publicID, "library_media_id": media.ID, "locked": true, "ignored": false,
		}).Error
	})
	if err == nil {
		d.invalidateLibraryMediaCache()
		InvalidateLocalFilesCache(d)
	}
	return err
}

// SetManualMediaProgress changes only progress fields, preserving rating and
// other user data on conflict. This is local state, independent of metadata APIs.
func SetManualMediaProgress(ctx context.Context, d *Database, media *models.LibraryMedia, progress int) error {
	status, completed := "CURRENT", ""
	if progress == 0 {
		status = "PLANNING"
	}
	if media.TotalEpisodes > 0 && progress >= media.TotalEpisodes {
		status, completed = "COMPLETED", time.Now().UTC().Format("2006-01-02")
	}
	row := &models.MediaEntryListData{LibraryMediaID: media.ID, Progress: progress, Status: status, CompletedAt: completed}
	return d.Gorm().WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "library_media_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"progress", "status", "completed_at", "updated_at"}),
	}).Create(row).Error
}
