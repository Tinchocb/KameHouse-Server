package jikan_platform

import (
	"context"

	"kamehouse/internal/platforms/platform"

	"github.com/rs/zerolog"
)

type Platform struct{}

func NewPlatform(_ *zerolog.Logger) *Platform {
	return &Platform{}
}

func (p *Platform) GetAnimeCollection(ctx context.Context, bypassCache bool) (interface{}, error) {
	return &platform.UnifiedCollection{}, nil
}
func (p *Platform) AddMediaToCollection(ctx context.Context, mIds []int) error      { return nil }
func (p *Platform) RefreshAnimeCollection(ctx context.Context) (interface{}, error) { return nil, nil }

var _ platform.Platform = (*Platform)(nil)
