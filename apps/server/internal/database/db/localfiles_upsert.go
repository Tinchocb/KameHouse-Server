package db

import (
	"kamehouse/internal/database/models"

	"gorm.io/gorm/clause"
)

// UpsertLocalFiles saves or updates local files in the database.
func (db *Database) UpsertLocalFiles(localFiles *models.LocalFiles) (*models.LocalFiles, error) {
	err := db.gormdb.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		UpdateAll: true,
	}).Create(localFiles).Error

	if err != nil {
		db.Logger.Error().Err(err).Msg("db: Failed to upsert local files")
		return nil, err
	}

	db.Logger.Debug().Msg("db: Local files upserted")
	return localFiles, nil
}

// InsertLocalFiles inserts local files into the database as a new entry.
func (db *Database) InsertLocalFiles(localFiles *models.LocalFiles) (*models.LocalFiles, error) {
	err := db.gormdb.Create(localFiles).Error

	if err != nil {
		db.Logger.Error().Err(err).Msg("db: Failed to insert local files")
		return nil, err
	}

	db.Logger.Debug().Msg("db: Local files inserted")
	return localFiles, nil
}

// UpsertShelvedLocalFiles saves or updates shelved local files in the database.
func (db *Database) UpsertShelvedLocalFiles(shelvedFiles *models.ShelvedLocalFiles) (*models.ShelvedLocalFiles, error) {
	err := db.gormdb.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		UpdateAll: true,
	}).Create(shelvedFiles).Error

	if err != nil {
		db.Logger.Error().Err(err).Msg("db: Failed to upsert shelved local files")
		return nil, err
	}

	db.Logger.Debug().Msg("db: Shelved local files upserted")
	return shelvedFiles, nil
}
