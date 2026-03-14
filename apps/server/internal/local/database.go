package local

import (
	"kamehouse/internal/database/models"
	"kamehouse/internal/api/anilist"
	"github.com/rs/zerolog"
)

type Database struct {
	gormdb *GormDB
}

type GormDB struct {
	Error error
}
func (g *GormDB) Create(value interface{}) *GormDB { return g }

func (d *Database) GetSettings() (settings *models.Settings) {
	return &models.Settings{}
}

func (d *Database) SaveSettings(settings *models.Settings) error {
	return nil
}

func (d *Database) UpdateSettings(settings *models.Settings) error {
	return nil
}

func (d *Database) GetTrackedMedia(mediaId int, provider string) (bool, bool) {
	return false, true
}

func (d *Database) SetTrackedMedia(mediaId int, provider string, tracked bool) error {
	return nil
}

func (d *Database) GetLocalAnimeCollection() (*anilist.AnimeCollection, bool) {
	return nil, true
}

func (d *Database) SaveAnimeCollection(collection *anilist.AnimeCollection) error {
	return nil
}

func (d *Database) GetTrackedAnimeCollection() (*anilist.AnimeCollection, bool) {
	return nil, true
}

func (d *Database) SetTrackedAnimeCollection(collection *anilist.AnimeCollection) error {
	return nil
}

func (d *Database) GetAllTrackedMedia() ([]*TrackedMedia, bool) {
	return nil, true
}

func (d *Database) GetAllTrackedMediaByType(t string) ([]*TrackedMedia, bool) {
	return nil, true
}

func (d *Database) GetAnimeSnapshots() ([]*AnimeSnapshot, bool) {
	return nil, true
}

func (d *Database) SaveAnimeSnapshot(snapshot *AnimeSnapshot) error {
	return nil
}

func (d *Database) RemoveAnimeSnapshot(id uint) error {
	return nil
}

func (d *Database) RemoveTrackedMedia(mediaId int, provider string) error {
	return nil
}

func (d *Database) GetSimulatedAnimeCollection() (*anilist.AnimeCollection, bool) {
	return nil, true
}

func (d *Database) SaveSimulatedAnimeCollection(collection *anilist.AnimeCollection) error {
	return nil
}

func (d *Database) Close() error {
	return nil
}

func newLocalSyncDatabase(path string, d2 string, logger *zerolog.Logger) (*Database, error) {
	return &Database{gormdb: &GormDB{}}, nil
}
