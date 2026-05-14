package db

import (
	"errors"

	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"sync"

	"github.com/goccy/go-json"
	"github.com/samber/mo"
	"gorm.io/gorm"
)

var localFilesMutex sync.RWMutex
var CurrLocalFilesDbId uint
var CurrLocalFiles mo.Option[[]*dto.LocalFile]

// GetLocalFiles will return the latest local files.
// The second return value (ID) is now legacy and returns 0 as we use relational storage.
func GetLocalFiles(d *Database) ([]*dto.LocalFile, uint, error) {
	lfs, err := GetAllLocalFilesRelational(d)
	if err != nil {
		return nil, 0, err
	}
	d.Logger.Debug().Int("count", len(lfs)).Msg("db: Local files retrieved from relational storage")
	return lfs, 0, nil
}

// SaveLocalFiles will save the local files in the database.
func SaveLocalFiles(d *Database, _ uint, lfs []*dto.LocalFile) ([]*dto.LocalFile, error) {
	err := UpsertLocalFileRelationalBatch(d, lfs)
	if err != nil {
		return nil, err
	}
	d.Logger.Debug().Int("count", len(lfs)).Msg("db: Local files saved to relational storage")
	return lfs, nil
}

// InsertLocalFiles will insert the local files in the database.
func InsertLocalFiles(d *Database, lfs []*dto.LocalFile) ([]*dto.LocalFile, error) {
	err := SyncLocalFilesRelational(d, lfs)
	if err != nil {
		return nil, err
	}
	d.Logger.Debug().Int("count", len(lfs)).Msg("db: Local files synchronized with relational storage")
	return lfs, nil
}

// InsertPartialLocalFiles will insert the local files for targeted paths in the database.
func InsertPartialLocalFiles(d *Database, lfs []*dto.LocalFile, targetPaths []string) ([]*dto.LocalFile, error) {
	err := SyncPartialLocalFilesRelational(d, lfs, targetPaths)
	if err != nil {
		return nil, err
	}
	d.Logger.Debug().Int("count", len(lfs)).Msg("db: Partial local files synchronized with relational storage")
	return lfs, nil
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func GetShelvedLocalFiles(db *Database) ([]*dto.LocalFile, error) {
	var res models.ShelvedLocalFiles
	err := db.Gorm().Last(&res).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	lfsBytes := res.Value
	var lfs []*dto.LocalFile
	if err := json.Unmarshal(lfsBytes, &lfs); err != nil {
		return nil, err
	}

	db.Logger.Debug().Msg("db: Shelved local files retrieved")

	return lfs, nil
}

func SaveShelvedLocalFiles(db *Database, lfs []*dto.LocalFile) error {
	// Marshal the local files
	marshaledLfs, err := json.Marshal(lfs)
	if err != nil {
		return err
	}

	// Save the local files
	ret, err := db.UpsertShelvedLocalFiles(&models.ShelvedLocalFiles{
		BaseModel: models.BaseModel{
			ID: 1,
		},
		Value: marshaledLfs,
	})
	if err != nil {
		return err
	}

	// Unmarshal the saved local files
	var retLfs []*dto.LocalFile
	if err := json.Unmarshal(ret.Value, &retLfs); err != nil {
		return nil
	}

	return nil
}
