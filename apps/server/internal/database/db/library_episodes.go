package db

import (
	"kamehouse/internal/database/models"

	"gorm.io/gorm/clause"
)

// UpsertLibraryEpisodeBatch inserts or updates a slice of LibraryEpisodes in batches.
func UpsertLibraryEpisodeBatch(d *Database, episodes []*models.LibraryEpisode, batchSize int) error {
	if len(episodes) == 0 {
		return nil
	}
	if batchSize <= 0 {
		batchSize = 50
	}
	return d.Gorm().Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "library_media_id"},
			{Name: "season_number"},
			{Name: "episode_number"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"absolute_number", "type", "title", "description", "image", "air_date", "runtime_minutes", "saga_id", "saga_name", "audio_tracks", "subtitle_tracks", "tags", "dominant_vibe", "suggested_swimlane",
		}),
	}).CreateInBatches(episodes, batchSize).Error
}
