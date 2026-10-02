package db

import (
	"errors"
	"fmt"
	"kamehouse/internal/database/models"

	"gorm.io/gorm"
)

func (db *Database) UpsertSettings(settings *models.Settings) (*models.Settings, error) {

	// Save (UPDATE de todas las columnas, INSERT si la fila no existe), como
	// UpsertTheme: Create+OnConflict reemplaza los valores cero por el `default`
	// del tag GORM, así que autoDisableSubtitlesWhenDubbed=false (default:true)
	// nunca se guardaba y el interruptor volvía a encenderse al recargar.
	err := db.gormdb.Save(settings).Error

	if err != nil {
		db.Logger.Error().Err(err).Msg("db: Failed to save settings in the database")
		return nil, err
	}

	db.currSettings.Store(settings)

	db.Logger.Debug().Msg("db: Settings saved")
	return settings, nil

}

// SettingsOverride aplica overrides (variables de entorno) a una COPIA de los
// ajustes guardados.
type SettingsOverride func(*models.Settings)

// effectiveSettings liga los ajustes con overrides a la fila guardada de la que
// salieron: si esa fila cambia (Upsert, recarga), el resultado se recalcula.
type effectiveSettings struct {
	base *models.Settings
	eff  *models.Settings
}

// SetSettingsOverride registra los overrides de entorno que GetSettings aplica.
func (db *Database) SetSettingsOverride(fn SettingsOverride) {
	if fn == nil {
		db.settingsOverride.Store(nil)
	} else {
		db.settingsOverride.Store(&fn)
	}
	db.effSettings.Store(nil)
}

// GetSettings devuelve los ajustes EFECTIVOS: los guardados más los overrides de
// entorno. Es de solo lectura (puntero compartido). Quien va a modificar y
// guardar tiene que partir de GetStoredSettings: si no, los valores del entorno
// terminan persistidos en la base como si el usuario los hubiera escrito.
func (db *Database) GetSettings() (*models.Settings, error) {
	stored, err := db.GetStoredSettings()
	if err != nil {
		return nil, err
	}
	ov := db.settingsOverride.Load()
	if ov == nil {
		return stored, nil
	}
	if e := db.effSettings.Load(); e != nil && e.base == stored {
		return e.eff, nil
	}
	cp := *stored
	(*ov)(&cp)
	db.effSettings.Store(&effectiveSettings{base: stored, eff: &cp})
	return &cp, nil
}

// GetStoredSettings devuelve los ajustes tal como están guardados (sin overrides
// de entorno). Es el punto de partida para modificar y guardar: hacerlo sobre una
// copia, nunca sobre el puntero devuelto (compartido).
func (db *Database) GetStoredSettings() (*models.Settings, error) {

	if cached := db.currSettings.Load(); cached != nil {
		return cached, nil
	}

	var settings models.Settings
	err := db.gormdb.First(&settings, 1).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			settings.ID = 1
			// Defaults para columnas nuevas en fila recién creada.
			if settings.Library.PreferredAudioProfile == "" {
				settings.Library.PreferredAudioProfile = "latino"
			}
			settings.Library.AutoDisableSubtitlesWhenDubbed = true
			if err := db.gormdb.Create(&settings).Error; err != nil {
				return nil, fmt.Errorf("db: creating default settings: %w", err)
			}
			db.currSettings.Store(&settings)
			return &settings, nil
		}
		return nil, err
	}
	db.currSettings.Store(&settings)
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

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (db *Database) UpsertMediastreamSettings(settings *models.MediastreamSettings) (*models.MediastreamSettings, error) {

	// Save y no Create+OnConflict: ver UpsertSettings (autoGovernorEnabled=false
	// con default:true volvía a true).
	err := db.gormdb.Save(settings).Error

	if err != nil {
		db.Logger.Error().Err(err).Msg("db: Failed to save media streaming settings in the database")
		return nil, err
	}

	db.currMediastreamSettings.Store(settings)

	db.Logger.Debug().Msg("db: Media streaming settings saved")
	return settings, nil

}

func (db *Database) GetMediastreamSettings() (*models.MediastreamSettings, bool) {

	if cached := db.currMediastreamSettings.Load(); cached != nil {
		return cached, true
	}

	var settings models.MediastreamSettings
	err := db.gormdb.Where("id = ?", 1).First(&settings).Error

	if err != nil {
		return nil, false
	}
	db.currMediastreamSettings.Store(&settings)
	return &settings, true
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
