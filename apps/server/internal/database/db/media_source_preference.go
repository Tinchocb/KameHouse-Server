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
	var rows []models.MediaSourcePreference
	if err := db.gormdb.Find(&rows).Error; err != nil {
		return map[int]string{}, err
	}
	out := make(map[int]string, len(rows))
	for _, r := range rows {
		out[r.MediaID] = r.Source
	}
	return out, nil
}

// GetMediaSourcePreference devuelve el origen de una serie ("auto" si no tiene).
func (db *Database) GetMediaSourcePreference(mediaID int) string {
	var row models.MediaSourcePreference
	if err := db.gormdb.Where("media_id = ?", mediaID).Limit(1).Find(&row).Error; err != nil || row.MediaID == 0 {
		return MediaSourceAuto
	}
	return row.Source
}

// SetMediaSourcePreference guarda el origen de una serie; "auto" borra la fila.
func (db *Database) SetMediaSourcePreference(mediaID int, source string) error {
	if source == MediaSourceAuto {
		return db.gormdb.Where("media_id = ?", mediaID).Delete(&models.MediaSourcePreference{}).Error
	}
	return db.gormdb.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "media_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"source", "updated_at"}),
	}).Create(&models.MediaSourcePreference{MediaID: mediaID, Source: source, UpdatedAt: time.Now()}).Error
}
