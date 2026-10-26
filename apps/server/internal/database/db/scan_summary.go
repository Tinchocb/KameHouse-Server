package db

import (
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"

	"github.com/goccy/go-json"
)

func InsertScanSummary(db *Database, sm *dto.ScanSummary) error {
	if sm == nil {
		return nil
	}

	// Marshal the data
	bytes, err := json.Marshal(sm)
	if err != nil {
		return err
	}

	// Save the data
	return db.Gorm().Create(&models.ScanSummary{
		Value: bytes,
	}).Error
}
