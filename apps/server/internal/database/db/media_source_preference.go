package db

import (
	"kamehouse/internal/database/models"
	"time"

	"gorm.io/gorm/clause"
)

// Orígenes de reproducción de una serie. "auto" no se persiste: es la ausencia
// de fila.
const (
	MediaSourceAuto  = "auto"
	MediaSourceLocal = "local"
	MediaSourceCloud = "cloud"
)

// IsValidMediaSource indica si s es un origen aceptado por la API.
func IsValidMediaSource(s string) bool {
	return s == MediaSourceAuto || s == MediaSourceLocal || s == MediaSourceCloud
}

// GetMediaSourcePreferences devuelve mediaID -> origen de las series con
// preferencia fija. Un mapa vacío significa "todas en automático".
func (db *Database) GetMediaSourcePreferences() (map[int]string, error) {
	if cached := db.currMediaSourcePrefs.Load(); cached != nil {
		return *cached, nil
	}
	var rows []models.MediaSourcePreference
	if err := db.gormdb.Find(&rows).Error; err != nil {
		return map[int]string{}, err
	}
	out := make(map[int]string, len(rows))
	for _, r := range rows {
		out[r.MediaID] = r.Source
	}
	db.currMediaSourcePrefs.Store(&out)
	return out, nil
}

// SetMediaSourcePreference guarda el origen de una serie; "auto" borra la fila.
func (db *Database) SetMediaSourcePreference(mediaID int, source string) error {
	defer db.currMediaSourcePrefs.Store(nil)
	if source == MediaSourceAuto {
		return db.gormdb.Where("media_id = ?", mediaID).Delete(&models.MediaSourcePreference{}).Error
	}
	return db.gormdb.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "media_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"source", "updated_at"}),
	}).Create(&models.MediaSourcePreference{MediaID: mediaID, Source: source, UpdatedAt: time.Now()}).Error
}
