package db

import (
	"errors"
	"kamehouse/internal/database/models"

	"gorm.io/gorm"
)

type WatchHistoryRepository struct {
	*gorm.DB
}

func NewWatchHistoryRepository(db *gorm.DB) *WatchHistoryRepository {
	return &WatchHistoryRepository{
		DB: db,
	}
}

func (r *WatchHistoryRepository) UpsertBatch(items []models.WatchHistory) error {
	if len(items) == 0 {
		return nil
	}

	return r.DB.Transaction(func(tx *gorm.DB) error {
		for _, item := range items {
			var existing models.WatchHistory
			err := tx.Where("account_id = ? AND media_id = ? AND episode_number = ?", 
				item.AccountID, item.MediaID, item.EpisodeNumber).First(&existing).Error
			
			if err == nil {
				// Ya existe: actualizar progreso
				existing.CurrentTime = item.CurrentTime
				existing.Duration = item.Duration
				if err := tx.Save(&existing).Error; err != nil {
					return err
				}
			} else if errors.Is(err, gorm.ErrRecordNotFound) {
				// No existe: crear nuevo
				if err := tx.Create(&item).Error; err != nil {
					return err
				}
			} else {
				return err
			}
		}
		return nil
	})
}
