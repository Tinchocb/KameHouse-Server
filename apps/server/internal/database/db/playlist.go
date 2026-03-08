package db

import (
	"kamehouse/internal/database/models"
)

func GetRawPlaylists(db *Database) ([]*models.Playlist, error) {
	var res []*models.Playlist
	err := db.Gorm().Find(&res).Error
	if err != nil {
		return nil, err
	}
	return res, nil
}

func GetRawPlaylist(db *Database, id uint) (*models.Playlist, error) {
	entry := &models.Playlist{}
	if err := db.Gorm().Where("id = ?", id).First(entry).Error; err != nil {
		return nil, err
	}
	return entry, nil
}

func SaveRawPlaylist(db *Database, entry *models.Playlist) error {
	return db.Gorm().Save(entry).Error
}

func DeletePlaylist(db *Database, id uint) error {
	return db.Gorm().Where("id = ?", id).Delete(&models.Playlist{}).Error
}

func UpdateRawPlaylist(db *Database, entry *models.Playlist) error {
	return db.Gorm().Save(entry).Error
}
