package db

import (
	"kamehouse/internal/database/models"
)

func (db *Database) GetMediaMetadataParent(mID int) (*models.MediaMetadataParent, error) {
	var ret models.MediaMetadataParent
	if err := db.Gorm().Where("media_id = ?", mID).First(&ret).Error; err != nil {
		return nil, err
	}
	return &ret, nil
}

func (db *Database) InsertMediaMetadataParent(m models.MediaMetadataParent) (*models.MediaMetadataParent, error) {
	_ = db.DeleteMediaMetadataParent(m.MediaID)
	err := db.gormdb.Save(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (db *Database) DeleteMediaMetadataParent(mID int) error {
	err := db.gormdb.Where("media_id = ?", mID).Delete(&models.MediaMetadataParent{}).Error
	if err != nil {
		return err
	}
	return nil
}
