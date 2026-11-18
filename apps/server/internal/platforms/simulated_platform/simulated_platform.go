package simulated_platform

import (
	"context"
	"kamehouse/internal/platforms/platform"

	"github.com/rs/zerolog"
)

type SimulatedPlatform struct{}

func NewSimulatedPlatform(_ *zerolog.Logger) *SimulatedPlatform {
	return &SimulatedPlatform{}
}

func (p *SimulatedPlatform) GetAnimeCollection(ctx context.Context, bypassCache bool) (interface{}, error) {
	return &platform.UnifiedCollection{}, nil
}
func (p *SimulatedPlatform) RefreshAnimeCollection(ctx context.Context) (interface{}, error) {
	return &platform.UnifiedCollection{}, nil
}
func (p *SimulatedPlatform) AddMediaToCollection(ctx context.Context, mIds []int) error {
	return nil
}

var _ platform.Platform = (*SimulatedPlatform)(nil)
