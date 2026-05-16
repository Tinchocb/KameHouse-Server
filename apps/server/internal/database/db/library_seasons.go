package db

import (
	"kamehouse/internal/database/models"

	"gorm.io/gorm/clause"
)

// UpsertLibrarySeason inserts or updates a LibrarySeason based on its LibraryMediaID and SeasonNumber.
func UpsertLibrarySeason(d *Database, season *models.LibrarySeason) error {
	return d.Gorm().Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "library_media_id"},
			{Name: "season_number"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"title", "description", "image",
		}),
	}).Create(season).Error
}

// UpsertLibrarySeasonBatch inserts or updates a slice of LibrarySeasons in batches.
func UpsertLibrarySeasonBatch(d *Database, seasons []*models.LibrarySeason, batchSize int) error {
	if len(seasons) == 0 {
		return nil
	}
	if batchSize <= 0 {
		batchSize = 20
	}
	return d.Gorm().Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "library_media_id"},
			{Name: "season_number"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"title", "description", "image",
		}),
	}).CreateInBatches(seasons, batchSize).Error
}

// GetLibrarySeasonsByMediaID retrieves all seasons for a given LibraryMedia.
func GetLibrarySeasonsByMediaID(d *Database, libraryMediaID uint) ([]models.LibrarySeason, error) {
	var seasons []models.LibrarySeason
	err := d.Gorm().Where("library_media_id = ?", libraryMediaID).
		Order("season_number ASC").
		Find(&seasons).Error
	return seasons, err
}
