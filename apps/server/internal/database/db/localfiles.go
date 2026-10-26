package db

import (
	"errors"

	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"sync"
	"sync/atomic"

	"github.com/goccy/go-json"
	"golang.org/x/sync/singleflight"
	"gorm.io/gorm"
)

// localFilesCache es la ultima lista cargada (nil = sin cache). Se lee sin lock.
var localFilesCache atomic.Pointer[[]*dto.LocalFile]

// localFilesMu ordena a quien publica la cache frente a quien la invalida.
var localFilesMu sync.Mutex

// localFilesGen sube en cada invalidacion (bajo localFilesMu). Una carga que empezo antes de una
// escritura no debe publicar su resultado: podria ser anterior a ella y quedaria rancio.
var localFilesGen uint64
var localFilesSingleFlight singleflight.Group

// CachedLocalFiles devuelve la lista en memoria, si la hay, sin tocar la base ni tomar locks.
func CachedLocalFiles() ([]*dto.LocalFile, bool) {
	if p := localFilesCache.Load(); p != nil {
		return *p, true
	}
	return nil, false
}

// GetLocalFiles will return the latest local files.
// The second return value (ID) is now legacy and returns 0 as we use relational storage.
func GetLocalFiles(d *Database) ([]*dto.LocalFile, uint, error) {
	if cached, ok := CachedLocalFiles(); ok {
		return cached, 0, nil
	}

	val, err, _ := localFilesSingleFlight.Do("get_local_files", func() (interface{}, error) {
		// Re-check cache inside singleflight to avoid racing
		if cached, ok := CachedLocalFiles(); ok {
			return cached, nil
		}

		localFilesMu.Lock()
		gen := localFilesGen
		localFilesMu.Unlock()

		lfs, err := GetAllLocalFilesRelational(d)
		if err != nil {
			return nil, err
		}

		// Si una escritura invalido la cache mientras se leia la base, se devuelve lo leido
		// pero no se publica.
		localFilesMu.Lock()
		if localFilesGen == gen {
			localFilesCache.Store(&lfs)
		}
		localFilesMu.Unlock()

		return lfs, nil
	})

	if err != nil {
		return nil, 0, err
	}

	lfs, ok := val.([]*dto.LocalFile)
	if !ok || lfs == nil {
		return nil, 0, errors.New("db: Local files cache returned unexpected type")
	}

	d.Logger.Debug().Int("count", len(lfs)).Msg("db: Local files retrieved from relational storage")
	return lfs, 0, nil
}

// InvalidateLocalFilesCache clears the in-memory local files cache.
func InvalidateLocalFilesCache() {
	localFilesMu.Lock()
	localFilesGen++
	localFilesCache.Store(nil)
	localFilesMu.Unlock()
}

// GetLocalFilesByMediaID will return the local files for the given media ID.
func GetLocalFilesByMediaID(d *Database, mediaID int) ([]*dto.LocalFile, error) {
	if cached, ok := CachedLocalFiles(); ok && cached != nil {
		var matched []*dto.LocalFile
		for _, f := range cached {
			if f != nil && f.MediaID == mediaID {
				matched = append(matched, f)
			}
		}
		d.Logger.Debug().Int("mediaID", mediaID).Int("count", len(matched)).Msg("db: Local files retrieved from in-memory cache by media ID")
		return matched, nil
	}

	lfs, err := GetLocalFilesByMediaIDRelational(d, mediaID)
	if err != nil {
		return nil, err
	}
	d.Logger.Debug().Int("mediaID", mediaID).Int("count", len(lfs)).Msg("db: Local files retrieved from relational storage by media ID")
	return lfs, nil
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
	_, err = db.UpsertShelvedLocalFiles(&models.ShelvedLocalFiles{
		BaseModel: models.BaseModel{
			ID: 1,
		},
		Value: marshaledLfs,
	})
	if err != nil {
		return err
	}

	return nil
}
