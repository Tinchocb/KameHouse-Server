package db

import (
	"errors"
	"kamehouse/internal/database/models"
	"sync/atomic"
)

var accountCache atomic.Pointer[models.Account]

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
