package db

import (
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"

	"github.com/goccy/go-json"
)

func GetScanSummaries(database *Database) ([]*dto.ScanSummaryItem, error) {
	var res []*models.ScanSummary
	err := database.Gorm().Find(&res).Error
	if err != nil {
		return nil, err
	}

	// Unmarshal the data
	var items []*dto.ScanSummaryItem
	for _, r := range res {
		smBytes := r.Value
		var sm dto.ScanSummary
		if err := json.Unmarshal(smBytes, &sm); err != nil {
			return nil, err
		}
		items = append(items, &dto.ScanSummaryItem{
			CreatedAt:   r.CreatedAt,
			ScanSummary: &sm,
		})
	}

	return items, nil
}

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
