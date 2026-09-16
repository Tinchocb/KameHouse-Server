package db

import (
	"errors"
	"kamehouse/internal/database/models"
	"sync/atomic"

	"gorm.io/gorm/clause"
)

var accountCache atomic.Pointer[models.Account]

func (db *Database) UpsertAccount(acc *models.Account) (*models.Account, error) {
	err := db.gormdb.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		UpdateAll: true,
	}).Create(acc).Error

	if err != nil {
		db.Logger.Error().Err(err).Msg("Failed to save account in the database")
		return nil, err
	}

	if acc.Username != "" {
		accountCache.Store(acc)
	} else {
		accountCache.Store(nil)
	}

	return acc, nil
}

func (db *Database) GetAccount() (*models.Account, error) {

	if cached := accountCache.Load(); cached != nil {
		return cached, nil
	}

	var acc models.Account
	err := db.gormdb.Last(&acc).Error
	if err != nil {
		return nil, err
	}
	if acc.Username == "" || acc.Token == "" || acc.Viewer == nil {
		return nil, errors.New("account not found")
	}

	accountCache.Store(&acc)

	return &acc, err
}
