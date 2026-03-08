package db

import (
	"kamehouse/internal/database/models"
)

// GetRawLegacyPlaylists
// DEPRECATED
func GetRawLegacyPlaylists(db *Database) ([]*models.PlaylistEntry, error) {
	var res []*models.PlaylistEntry
	err := db.Gorm().Find(&res).Error
	if err != nil {
		return nil, err
	}
	return res, nil
}

// SaveRawLegacyPlaylist
// DEPRECATED
func SaveRawLegacyPlaylist(db *Database, entry *models.PlaylistEntry) error {
	return db.Gorm().Save(entry).Error
}

// DeleteLegacyPlaylist
// DEPRECATED
func DeleteLegacyPlaylist(db *Database, id uint) error {
	return db.Gorm().Where("id = ?", id).Delete(&models.PlaylistEntry{}).Error
}

// UpdateRawLegacyPlaylist
// DEPRECATED
func UpdateRawLegacyPlaylist(db *Database, entry *models.PlaylistEntry) error {
	return db.Gorm().Save(entry).Error
}

// GetRawLegacyPlaylist
// DEPRECATED
func GetRawLegacyPlaylist(db *Database, id uint) (*models.PlaylistEntry, error) {
	entry := &models.PlaylistEntry{}
	if err := db.Gorm().Where("id = ?", id).First(entry).Error; err != nil {
		return nil, err
	}
	return entry, nil
}
