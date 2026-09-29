package db

import (
	"kamehouse/internal/database/models"

	"gorm.io/gorm/clause"
)

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
