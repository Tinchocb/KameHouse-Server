package simulated_platform

import (
	"context"
	"kamehouse/internal/database/db"
	"kamehouse/internal/platforms/platform"

	"github.com/rs/zerolog"
)

type SimulatedPlatform struct {
	logger *zerolog.Logger
	db     *db.Database
}

func NewSimulatedPlatform(logger *zerolog.Logger, db *db.Database) *SimulatedPlatform {
	return &SimulatedPlatform{
		logger: logger,
		db:     db,
	}
}

func (p *SimulatedPlatform) GetID() string   { return "simulated" }
func (p *SimulatedPlatform) GetName() string { return "Simulated" }

func (p *SimulatedPlatform) GetAnimeCollection(ctx context.Context, bypassCache bool) (interface{}, error) {
	return nil, nil
}
func (p *SimulatedPlatform) GetRawAnimeCollection(ctx context.Context, bypassCache bool) (interface{}, error) {
	return nil, nil
}
func (p *SimulatedPlatform) RefreshAnimeCollection(ctx context.Context) (interface{}, error) {
	return nil, nil
}
func (p *SimulatedPlatform) GetAnimeCollectionWithRelations(ctx context.Context) (interface{}, error) {
	return nil, nil
}
func (p *SimulatedPlatform) GetMangaCollection(ctx context.Context, bypassCache bool) (interface{}, error) {
	return nil, nil
}
func (p *SimulatedPlatform) GetRawMangaCollection(ctx context.Context, bypassCache bool) (interface{}, error) {
	return nil, nil
}
func (p *SimulatedPlatform) RefreshMangaCollection(ctx context.Context) (interface{}, error) {
	return nil, nil
}
func (p *SimulatedPlatform) AddMediaToCollection(ctx context.Context, mIds []int) error {
	return nil
}
func (p *SimulatedPlatform) UpdateEntry(ctx context.Context, mediaID int, status interface{}, scoreRaw *int, progress *int, startedAt interface{}, completedAt interface{}) error {
	return nil
}
func (p *SimulatedPlatform) UpdateEntryProgress(ctx context.Context, mediaID int, progress int, totalEpisodes *int) error {
	return nil
}
func (p *SimulatedPlatform) UpdateEntryRepeat(ctx context.Context, mediaID int, repeat int) error {
	return nil
}
func (p *SimulatedPlatform) DeleteEntry(ctx context.Context, mediaId, entryId int) error {
	return nil
}
func (p *SimulatedPlatform) GetAnime(ctx context.Context, mediaID int) (interface{}, error) {
	return nil, nil
}
func (p *SimulatedPlatform) GetAnimeByMalID(ctx context.Context, malID int) (interface{}, error) {
	return nil, nil
}
func (p *SimulatedPlatform) GetAnimeDetails(ctx context.Context, mediaID int) (interface{}, error) {
	return nil, nil
}
func (p *SimulatedPlatform) GetAnimeWithRelations(ctx context.Context, mediaID int) (interface{}, error) {
	return nil, nil
}
func (p *SimulatedPlatform) GetManga(ctx context.Context, mediaID int) (interface{}, error) {
	return nil, nil
}
func (p *SimulatedPlatform) GetMangaDetails(ctx context.Context, mediaID int) (interface{}, error) {
	return nil, nil
}
func (p *SimulatedPlatform) GetStudioDetails(ctx context.Context, studioID int) (interface{}, error) {
	return nil, nil
}
func (p *SimulatedPlatform) GetViewerStats(ctx context.Context) (interface{}, error) {
	return nil, nil
}
func (p *SimulatedPlatform) GetAnimeAiringSchedule(ctx context.Context) (interface{}, error) {
	return nil, nil
}

func (p *SimulatedPlatform) SetUsername(username string) {}
func (p *SimulatedPlatform) Close()                       {}
func (p *SimulatedPlatform) ClearCache()                  {}

var _ platform.Platform = (*SimulatedPlatform)(nil)
