package db

import (
	"kamehouse/internal/database/models"

	"github.com/goccy/go-json"
)

func GetTorrentstreamHistory(db *Database, mId int) (interface{}, interface{}, error) {
	var history models.TorrentstreamHistory
	if err := db.Gorm().Where("media_id = ?", mId).First(&history).Error; err != nil {
		return nil, nil, err
	}

	var torrent interface{}
	if err := json.Unmarshal(history.Torrent, &torrent); err != nil {
		return nil, nil, err
	}

	var files interface{}
	if len(history.BatchEpisodeFiles) > 0 {
		_ = json.Unmarshal(history.BatchEpisodeFiles, &files)
	}

	return &torrent, files, nil
}

func InsertTorrentstreamHistory(db *Database, mId int, torrent interface{}, files interface{}) error {
	if torrent == nil {
		return nil
	}

	// Marshal the data
	bytes, err := json.Marshal(torrent)
	if err != nil {
		return err
	}

	var filesBytes []byte
	if files != nil {
		filesBytes, err = json.Marshal(files)
		if err != nil {
			return err
		}
	}

	// Get current history
	var history models.TorrentstreamHistory
	if err := db.Gorm().Where("media_id = ?", mId).First(&history).Error; err == nil {
		// Update the history
		history.Torrent = bytes
		history.BatchEpisodeFiles = filesBytes
		return db.Gorm().Save(&history).Error
	}

	return db.Gorm().Create(&models.TorrentstreamHistory{
		MediaId:           mId,
		Torrent:           bytes,
		BatchEpisodeFiles: filesBytes,
	}).Error
}
