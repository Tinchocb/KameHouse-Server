package db

import (
	"kamehouse/internal/database/models"
	"time"

	"github.com/rs/zerolog"
	"gorm.io/gorm/clause"
)

// Perfiles de audio por serie. "" no se persiste: es la ausencia de fila, que
// significa "usar el perfil global de Ajustes".
var audioProfiles = map[string]bool{
	"latino":     true,
	"castellano": true,
	"japanese":   true,
	"english":    true,
	"auto":       true,
}

// IsValidAudioProfile indica si p es un perfil de audio aceptado por la API.
func IsValidAudioProfile(p string) bool {
	return audioProfiles[p]
}

// GetAudioPreferences devuelve las series con perfil propio.
func (db *Database) GetAudioPreferences() ([]models.MediaAudioPreference, error) {
	var rows []models.MediaAudioPreference
	err := db.gormdb.Order("media_id ASC").Find(&rows).Error
	return rows, err
}

// SetAudioPreference guarda el perfil de una serie; "" borra la fila y la serie
// vuelve al perfil global.
func (db *Database) SetAudioPreference(mediaID int, profile string) error {
	if profile == "" {
		return db.gormdb.Where("media_id = ?", mediaID).Delete(&models.MediaAudioPreference{}).Error
	}
	return db.gormdb.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "media_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"audio_profile", "updated_at"}),
	}).Create(&models.MediaAudioPreference{MediaID: mediaID, AudioProfile: profile, UpdatedAt: time.Now()}).Error
}

// daimaTmdbID identifica Dragon Ball Daima (TMDB 236994, MAL 56894), el mismo ID con
// que lo reconoce el resto de la biblioteca. Los IDs locales cambian entre instalaciones.
const daimaTmdbID = 236994

// seedDaimaAudioProfile deja Dragon Ball Daima en japonés una sola vez. Sus subtítulos
// siguen en español (preferredSubtitleLang): el audio japonés no cuenta como doblaje.
// La marca de migración solo se pone cuando la serie ya está en la biblioteca, así que
// un arranque sin biblioteca escaneada lo reintenta. Si el usuario después cambia o
// borra esa preferencia, no se vuelve a sembrar.
func seedDaimaAudioProfile(d *Database, logger *zerolog.Logger) {
	const migrationKey = "daima_audio_profile_v1"
	if migrationDone(d, logger, migrationKey) {
		return
	}

	var count int64
	if err := d.gormdb.Model(&models.LibraryMedia{}).Where("tmdb_id = ?", daimaTmdbID).Count(&count).Error; err != nil {
		logger.Error().Err(err).Msg("db: no se pudo buscar Dragon Ball Daima para sembrar su perfil de audio")
		return
	}
	if count == 0 {
		return
	}

	if err := d.gormdb.Exec(
		`INSERT OR IGNORE INTO media_audio_preferences (media_id, audio_profile, updated_at)
		 SELECT id, 'japanese', ? FROM library_media WHERE tmdb_id = ?`,
		time.Now(), daimaTmdbID,
	).Error; err != nil {
		logger.Error().Err(err).Msg("db: fallo al sembrar el perfil de audio de Dragon Ball Daima")
		return
	}
	if err := UpsertMetadataCache(d, "migrations", migrationKey, true, 0); err != nil {
		logger.Error().Err(err).Msg("db: no se pudo marcar el perfil de audio de Daima como sembrado")
	}
}
