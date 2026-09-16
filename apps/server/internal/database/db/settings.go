package db

import (
	"errors"
	"kamehouse/internal/database/models"
	"sync/atomic"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var currSettings atomic.Pointer[models.Settings]

func (db *Database) UpsertSettings(settings *models.Settings) (*models.Settings, error) {

	err := db.gormdb.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		UpdateAll: true,
	}).Create(settings).Error

	if err != nil {
		db.Logger.Error().Err(err).Msg("db: Failed to save settings in the database")
		return nil, err
	}

	currSettings.Store(settings)

	db.Logger.Debug().Msg("db: Settings saved")
	return settings, nil

}

func (db *Database) GetSettings() (*models.Settings, error) {

	if cached := currSettings.Load(); cached != nil {
		return cached, nil
	}

	var settings models.Settings
	err := db.gormdb.First(&settings, 1).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			settings.ID = 1
			_ = db.gormdb.Create(&settings)
			currSettings.Store(&settings)
			return &settings, nil
		}
		return nil, err
	}
	currSettings.Store(&settings)
	return &settings, nil
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (db *Database) GetAllLibraryPathsFromSettings() ([]string, error) {
	settings, err := db.GetSettings()
	if err != nil {
		return []string{}, err
	}
	return settings.Library.GetAllPaths(), nil
}

func (db *Database) AllLibraryPathsFromSettings(settings *models.Settings) *[]string {
	r := settings.Library.GetAllPaths()
	return &r
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var currMediastreamSettings atomic.Pointer[models.MediastreamSettings]

func (db *Database) UpsertMediastreamSettings(settings *models.MediastreamSettings) (*models.MediastreamSettings, error) {

	err := db.gormdb.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		UpdateAll: true,
	}).Create(settings).Error

	if err != nil {
		db.Logger.Error().Err(err).Msg("db: Failed to save media streaming settings in the database")
		return nil, err
	}

	currMediastreamSettings.Store(settings)

	db.Logger.Debug().Msg("db: Media streaming settings saved")
	return settings, nil

}

func (db *Database) GetMediastreamSettings() (*models.MediastreamSettings, bool) {

	if cached := currMediastreamSettings.Load(); cached != nil {
		return cached, true
	}

	var settings models.MediastreamSettings
	err := db.gormdb.Where("id = ?", 1).First(&settings).Error

	if err != nil {
		return nil, false
	}
	currMediastreamSettings.Store(&settings)
	return &settings, true
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
