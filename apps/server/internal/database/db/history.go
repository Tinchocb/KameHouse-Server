package db

import (
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
			err := tx.Where("account_id = ? AND media_id = ? AND episode_number = ?", item.AccountID, item.MediaID, item.EpisodeNumber).First(&existing).Error
			if err == nil {
				// Update
				tx.Model(&existing).Updates(map[string]interface{}{
					"current_time": item.CurrentTime,
					"duration":     item.Duration,
					"updated_at":   item.UpdatedAt,
				})
			} else {
				// Insert
				tx.Create(&item)
			}
		}
		return nil
	})
}
