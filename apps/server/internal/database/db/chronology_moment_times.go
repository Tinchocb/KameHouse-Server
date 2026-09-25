package db

import (
	"time"

	"kamehouse/internal/database/models"

	"gorm.io/gorm/clause"
)

// GetChronologyMomentTimes devuelve un mapa momentKey -> seconds de todas las correcciones manuales.
func (db *Database) GetChronologyMomentTimes() (map[string]int, error) {
	var rows []models.ChronologyMomentTime
	if err := db.gormdb.Find(&rows).Error; err != nil {
		return map[string]int{}, err
	}
	out := make(map[string]int, len(rows))
	for _, r := range rows {
		out[r.MomentKey] = r.Seconds
	}
	return out, nil
}

// SetChronologyMomentTime guarda la corrección de segundos para un hito. Si seconds < 0, borra la fila.
func (db *Database) SetChronologyMomentTime(momentKey string, seconds int) error {
	if seconds < 0 {
		return db.gormdb.Where("moment_key = ?", momentKey).Delete(&models.ChronologyMomentTime{}).Error
	}
	return db.gormdb.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "moment_key"}},
		DoUpdates: clause.AssignmentColumns([]string{"seconds", "updated_at"}),
	}).Create(&models.ChronologyMomentTime{
		MomentKey: momentKey,
		Seconds:   seconds,
		BaseModel: models.BaseModel{
			UpdatedAt: time.Now(),
		},
	}).Error
}
