package db

import (
	"fmt"
	"kamehouse/internal/database/models"
)

func formatOnlinestreamMappingCacheKey(provider string, mediaID int) string {
	return fmt.Sprintf("%s$%d", provider, mediaID)
}

func (db *Database) GetOnlinestreamMapping(provider string, mediaID int) (*models.OnlinestreamMapping, bool) {

	if res, ok := db.OnlinestreamMappingCache.Get(formatOnlinestreamMappingCacheKey(provider, mediaID)); ok {
		return res, true
	}

	var res models.OnlinestreamMapping
	err := db.gormdb.Where("provider = ? AND media_id = ?", provider, mediaID).First(&res).Error
	if err != nil {
		return nil, false
	}

	db.OnlinestreamMappingCache.Set(formatOnlinestreamMappingCacheKey(provider, mediaID), &res)

	return &res, true
}

func (db *Database) InsertOnlinestreamMapping(provider string, mediaID int, animeId string) error {
	mapping := models.OnlinestreamMapping{
		Provider: provider,
		MediaID:  mediaID,
		AnimeID:  animeId,
	}

	db.OnlinestreamMappingCache.Set(formatOnlinestreamMappingCacheKey(provider, mediaID), &mapping)

	return db.gormdb.Save(&mapping).Error
}

func (db *Database) DeleteOnlinestreamMapping(provider string, mediaID int) error {
	err := db.gormdb.Where("provider = ? AND media_id = ?", provider, mediaID).Delete(&models.OnlinestreamMapping{}).Error
	if err != nil {
		return err
	}

	db.OnlinestreamMappingCache.Delete(formatOnlinestreamMappingCacheKey(provider, mediaID))
	return nil
}
