package db

import (
	"errors"

	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"sync/atomic"

	"github.com/goccy/go-json"
	"golang.org/x/sync/singleflight"
	"gorm.io/gorm"
)

// Each database generation owns its snapshot and in-flight load. Readers that
// start after an invalidation cannot join a load from before the write.
type localFilesGeneration struct {
	snapshot atomic.Pointer[[]*dto.LocalFile]
	flight   singleflight.Group
}

func (d *Database) localFilesGeneration() *localFilesGeneration {
	if generation := d.localFilesCache.Load(); generation != nil {
		return generation
	}
	generation := new(localFilesGeneration)
	if d.localFilesCache.CompareAndSwap(nil, generation) {
		return generation
	}
	return d.localFilesCache.Load()
}

func cloneLocalFiles(files []*dto.LocalFile) []*dto.LocalFile {
	if files == nil {
		return nil
	}
	copy := make([]*dto.LocalFile, len(files))
	for i, file := range files {
		copy[i] = file.Clone()
	}
	return copy
}

// CachedLocalFiles returns an owned copy without querying the database.
func CachedLocalFiles(d *Database) ([]*dto.LocalFile, bool) {
	if p := d.localFilesGeneration().snapshot.Load(); p != nil {
		return cloneLocalFiles(*p), true
	}
	return nil, false
}

// GetLocalFiles will return the latest local files.
// The second return value (ID) is now legacy and returns 0 as we use relational storage.
func GetLocalFiles(d *Database) ([]*dto.LocalFile, uint, error) {
	generation := d.localFilesGeneration()
	if cached := generation.snapshot.Load(); cached != nil {
		return cloneLocalFiles(*cached), 0, nil
	}

	val, err, _ := generation.flight.Do("get_local_files", func() (interface{}, error) {
		// Re-check cache inside singleflight to avoid racing
		if cached := generation.snapshot.Load(); cached != nil {
			return *cached, nil
		}

		lfs, err := GetAllLocalFilesRelational(d)
		if err != nil {
			return nil, err
		}

		// An obsolete load can only publish into its own, detached generation.
		generation.snapshot.Store(&lfs)

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
	return cloneLocalFiles(lfs), 0, nil
}

// InvalidateLocalFilesCache clears the in-memory local files cache.
func InvalidateLocalFilesCache(d *Database) {
	d.localFilesCache.Store(new(localFilesGeneration))
}

// GetLocalFilesByMediaID will return the local files for the given media ID.
func GetLocalFilesByMediaID(d *Database, mediaID int) ([]*dto.LocalFile, error) {
	if cached := d.localFilesGeneration().snapshot.Load(); cached != nil {
		var matched []*dto.LocalFile
		for _, f := range *cached {
			if f != nil && f.MediaID == mediaID {
				matched = append(matched, f.Clone())
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
func SaveLocalFiles(d *Database, lfs []*dto.LocalFile) ([]*dto.LocalFile, error) {
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
