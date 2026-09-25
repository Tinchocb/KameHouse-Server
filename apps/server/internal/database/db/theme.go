package db

import (
	"kamehouse/internal/database/models"
	"sync/atomic"

	"github.com/goccy/go-json"
)

var (
	themeCache     atomic.Pointer[models.Theme]
	themeCopyCache atomic.Pointer[models.Theme]
)

func (db *Database) GetTheme() (*models.Theme, error) {

	if cached := themeCache.Load(); cached != nil {
		return cached, nil
	}

	var theme models.Theme
	err := db.gormdb.Where("id = ?", 1).Find(&theme).Error

	if err != nil {
		return nil, err
	}

	themeCache.Store(&theme)

	return &theme, nil
}

// GetThemeCopy returns a copy of the theme settings.
// The copy will have the HomeItems removed.
func (db *Database) GetThemeCopy() (*models.Theme, error) {

	if cached := themeCopyCache.Load(); cached != nil {
		return cached, nil
	}

	theme, err := db.GetTheme()
	if err != nil {
		return nil, err
	}

	marshaledTheme, err := json.Marshal(theme)
	if err != nil {
		return nil, err
	}

	var themeCopy models.Theme
	err = json.Unmarshal(marshaledTheme, &themeCopy)
	if err != nil {
		return nil, err
	}

	themeCopyCache.Store(&themeCopy)

	return &themeCopy, nil
}

// UpsertTheme updates the theme settings.
func (db *Database) UpsertTheme(settings *models.Theme) (*models.Theme, error) {

	// Save (UPDATE de todas las columnas, INSERT solo si la fila no existe) en vez
	// de Create+OnConflict: Create reemplaza los valores cero por el `default` del
	// tag GORM, así que bgMusicEnabled/uiSoundsEnabled=false (default:true) o un
	// volumen 0 nunca llegaban a guardarse y volvían a su default.
	err := db.gormdb.Save(settings).Error

	if err != nil {
		db.Logger.Error().Err(err).Msg("db: Failed to save theme in the database")
		return nil, err
	}

	db.Logger.Debug().Msg("db: Theme saved")

	themeCache.Store(settings)
	themeCopyCache.Store(nil)

	return settings, nil

}
