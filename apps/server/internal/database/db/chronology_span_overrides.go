package db

import (
	"time"

	"kamehouse/internal/database/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// GetChronologySpanOverrides devuelve spanId -> visto de las marcas manuales de la cuenta.
func (db *Database) GetChronologySpanOverrides(accountID uint) (map[string]bool, error) {
	var rows []models.ChronologySpanOverride
	if err := db.gormdb.Where("account_id = ?", accountID).Find(&rows).Error; err != nil {
		return map[string]bool{}, err
	}
	out := make(map[string]bool, len(rows))
	for _, r := range rows {
		out[r.SpanID] = r.Watched
	}
	return out, nil
}

// SetChronologySpanOverrides aplica varias marcas de una vez: un valor nil borra
// la marca (el lapso vuelve a depender del historial). Todo o nada, para que
// "marcar todos", "reiniciar" y "deshacer" no queden a medias.
func (db *Database) SetChronologySpanOverrides(accountID uint, overrides map[string]*bool) error {
	return db.gormdb.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		for spanID, watched := range overrides {
			if watched == nil {
				if err := tx.Where("account_id = ? AND span_id = ?", accountID, spanID).
					Delete(&models.ChronologySpanOverride{}).Error; err != nil {
					return err
				}
				continue
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "account_id"}, {Name: "span_id"}},
				DoUpdates: clause.AssignmentColumns([]string{"watched", "updated_at"}),
			}).Create(&models.ChronologySpanOverride{
				AccountID: accountID,
				SpanID:    spanID,
				Watched:   *watched,
				BaseModel: models.BaseModel{CreatedAt: now, UpdatedAt: now},
			}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
