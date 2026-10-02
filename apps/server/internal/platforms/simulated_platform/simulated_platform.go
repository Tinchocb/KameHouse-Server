package simulated_platform

import (
	"context"
	"kamehouse/internal/platforms/platform"

	"github.com/rs/zerolog"
)

type SimulatedPlatform struct {
	logger *zerolog.Logger
}

func NewSimulatedPlatform(logger *zerolog.Logger) *SimulatedPlatform {
	return &SimulatedPlatform{
		logger: logger,
	}
}

func (p *SimulatedPlatform) GetName() string { return "Simulated" }

func (p *SimulatedPlatform) GetAnimeCollection(ctx context.Context, bypassCache bool) (interface{}, error) {
	return &platform.UnifiedCollection{}, nil
}
func (p *SimulatedPlatform) RefreshAnimeCollection(ctx context.Context) (interface{}, error) {
	return &platform.UnifiedCollection{}, nil
}
func (p *SimulatedPlatform) AddMediaToCollection(ctx context.Context, mIds []int) error {
	return nil
}
func (p *SimulatedPlatform) UpdateEntryProgress(ctx context.Context, mediaID int, progress int, totalEpisodes *int) error {
	return nil
}
func (p *SimulatedPlatform) GetAnime(ctx context.Context, mediaID int) (interface{}, error) {
	return nil, nil
}

var _ platform.Platform = (*SimulatedPlatform)(nil)
