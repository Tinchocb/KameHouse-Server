package db

import (
	"kamehouse/internal/database/models"

	"gorm.io/gorm/clause"
)

// UpsertLibraryEpisode inserts or updates a LibraryEpisode based on its LibraryMediaID, SeasonNumber, and EpisodeNumber.
func UpsertLibraryEpisode(d *Database, episode *models.LibraryEpisode) error {
	return d.Gorm().Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "library_media_id"},
			{Name: "season_number"},
			{Name: "episode_number"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"absolute_number", "type", "title", "description", "image", "air_date", "runtime_minutes",
		}),
	}).Create(episode).Error
}

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
			"absolute_number", "type", "title", "description", "image", "air_date", "runtime_minutes", "saga_id", "saga_name", "audio_tracks", "subtitle_tracks",
		}),
	}).CreateInBatches(episodes, batchSize).Error
}

// GetLibraryEpisodesByMediaID retrieves all episodes for a given LibraryMedia.
func GetLibraryEpisodesByMediaID(d *Database, libraryMediaID uint) ([]models.LibraryEpisode, error) {
	var episodes []models.LibraryEpisode
	err := d.Gorm().Where("library_media_id = ?", libraryMediaID).
		Order("season_number ASC, episode_number ASC").
		Find(&episodes).Error
	return episodes, err
}

// GetLibraryEpisode retrieves a specific episode by its media ID, season, and episode number.
func GetLibraryEpisode(d *Database, libraryMediaID uint, seasonNumber int, episodeNumber int) (*models.LibraryEpisode, error) {
	var episode models.LibraryEpisode
	err := d.Gorm().Where("library_media_id = ? AND season_number = ? AND episode_number = ?", libraryMediaID, seasonNumber, episodeNumber).First(&episode).Error
	if err != nil {
		return nil, err
	}
	return &episode, nil
}
