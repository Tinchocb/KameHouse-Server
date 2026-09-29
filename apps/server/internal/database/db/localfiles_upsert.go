package db

import (
	"kamehouse/internal/database/models"

	"gorm.io/gorm/clause"
)

// ─────────────────────────────────────────────────────────────────────────────
// ShelvedLocalFiles upserts
// ─────────────────────────────────────────────────────────────────────────────

// UpsertShelvedLocalFiles saves or replaces the single-row shelved snapshot.
func (db *Database) UpsertShelvedLocalFiles(shelvedFiles *models.ShelvedLocalFiles) (*models.ShelvedLocalFiles, error) {
	err := db.gormdb.
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			UpdateAll: true,
		}).
		Create(shelvedFiles).Error

	if err != nil {
		db.Logger.Error().Err(err).Msg("db: Failed to upsert shelved local files")
		return nil, err
	}

	db.Logger.Debug().Msg("db: Shelved local files upserted")
	return shelvedFiles, nil
}
