package db

import (
	"kamehouse/internal/database/models"

	"gorm.io/gorm/clause"
)

// GetLibraryMediaByTmdbId retrieves a LibraryMedia by its TMDB ID.
// Returns nil if no matching media is found.
func GetLibraryMediaByTmdbId(d *Database, tmdbId int) (*models.LibraryMedia, error) {
	var media models.LibraryMedia
	err := d.Gorm().Where("tmdb_id = ?", tmdbId).First(&media).Error
	if err != nil {
		return nil, err
	}
	return &media, nil
}

// GetLibraryMediaByID retrieves a LibraryMedia by its primary key ID.
func GetLibraryMediaByID(d *Database, id uint) (*models.LibraryMedia, error) {
	var media models.LibraryMedia
	err := d.Gorm().First(&media, id).Error
	if err != nil {
		return nil, err
	}
	return &media, nil
}

// GetMediaEntryListData retrieves the MediaEntryListData for a given LibraryMedia ID.
func GetMediaEntryListData(d *Database, libraryMediaId uint) (*models.MediaEntryListData, error) {
	var listData models.MediaEntryListData
	err := d.Gorm().Where("library_media_id = ?", libraryMediaId).First(&listData).Error
	if err != nil {
		return nil, err
	}
	return &listData, nil
}

// InsertLibraryMedia creates or updates a LibraryMedia record in the database.
// If a record with the same TMDB ID exists, it updates it; otherwise it creates a new one.
func InsertLibraryMedia(d *Database, media *models.LibraryMedia) (*models.LibraryMedia, error) {
	err := d.Gorm().Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tmdb_id"}},
		UpdateAll: true,
	}).Create(media).Error
	if err != nil {
		return nil, err
	}
	return media, nil
}

// GetAllMediaEntryListData retrieves all MediaEntryListData entries with their associated LibraryMedia preloaded.
func GetAllMediaEntryListData(d *Database) ([]*models.MediaEntryListData, error) {
	var entries []*models.MediaEntryListData
	err := d.Gorm().Preload("LibraryMedia").Find(&entries).Error
	if err != nil {
		return nil, err
	}
	return entries, nil
}

// InsertMediaEntryListData creates or updates a MediaEntryListData record.
// If a record with the same LibraryMediaID exists, it updates it; otherwise it creates a new one.
func InsertMediaEntryListData(d *Database, data *models.MediaEntryListData) (*models.MediaEntryListData, error) {
	err := d.Gorm().Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "library_media_id"}},
		UpdateAll: true,
	}).Create(data).Error
	if err != nil {
		return nil, err
	}
	return data, nil
}

// TrimLocalFileEntries removes old local file entries from the database,
// keeping only the latest entry.
func TrimLocalFileEntries(d *Database) {
	var count int64
	d.Gorm().Model(&models.LocalFiles{}).Count(&count)
	if count > 1 {
		// Keep only the latest entry
		var latest models.LocalFiles
		if err := d.Gorm().Last(&latest).Error; err == nil {
			d.Gorm().Where("id != ?", latest.ID).Delete(&models.LocalFiles{})
		}
	}
}

// GetLibraryMediaByExternalID retrieves a LibraryMedia by its external ID (e.g. slug or custom mapping).
func GetLibraryMediaByExternalID(d *Database, externalId string) (*models.LibraryMedia, error) {
	var media models.LibraryMedia
	err := d.Gorm().
		Joins("JOIN provider_mappings ON provider_mappings.library_media_id = library_media.id").
		Where("provider_mappings.external_id = ?", externalId).
		First(&media).Error
	if err != nil {
		return nil, err
	}
	return &media, nil
}

// UpsertLibraryMediaBatch inserts or updates a slice of LibraryMedia atomically in a single transaction.
func UpsertLibraryMediaBatch(d *Database, media []*models.LibraryMedia, batchSize int) error {
	if len(media) == 0 {
		return nil
	}

	return d.Gorm().Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tmdb_id"}, {Name: "type"}}, // Unique composite constraint
		UpdateAll: true,
	}).CreateInBatches(media, batchSize).Error
}
// UpdateLibraryMediaMappings updates the external mappings (AniDB, MAL) for a LibraryMedia record.
func UpdateLibraryMediaMappings(d *Database, id uint, anidbId, malId int) error {
	return d.Gorm().Model(&models.LibraryMedia{}).Where("id = ?", id).Updates(map[string]interface{}{
		"anidb_id":        anidbId,
		"myanimelist_id": malId,
	}).Error
}
