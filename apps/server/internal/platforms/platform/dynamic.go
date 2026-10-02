package platform

import (
	"context"
	"sync/atomic"
)

type platformWrapper struct {
	Platform Platform
}

// DynamicPlatform implementa Platform y redirige atómicamente entre una
// plataforma online y una offline. Reemplaza el uso de *util.Ref[Platform].
type DynamicPlatform struct {
	current atomic.Value // platformWrapper
}

// NewDynamicPlatform crea un DynamicPlatform con la plataforma inicial dada.
func NewDynamicPlatform(initial Platform) *DynamicPlatform {
	p := &DynamicPlatform{}
	p.current.Store(platformWrapper{Platform: initial})
	return p
}

// SetPlatform intercambia atómicamente la plataforma activa.
func (p *DynamicPlatform) SetPlatform(plat Platform) {
	p.current.Store(platformWrapper{Platform: plat})
}

// GetPlatform devuelve la plataforma activa.
func (p *DynamicPlatform) GetPlatform() Platform {
	val := p.current.Load()
	if val == nil {
		return nil
	}
	return val.(platformWrapper).Platform
}

func (p *DynamicPlatform) UpdateEntryProgress(ctx context.Context, mediaID int, progress int, totalEpisodes *int) error {
	return p.GetPlatform().UpdateEntryProgress(ctx, mediaID, progress, totalEpisodes)
}

func (p *DynamicPlatform) GetAnime(ctx context.Context, mediaID int) (interface{}, error) {
	return p.GetPlatform().GetAnime(ctx, mediaID)
}

func (p *DynamicPlatform) GetAnimeCollection(ctx context.Context, bypassCache bool) (interface{}, error) {
	return p.GetPlatform().GetAnimeCollection(ctx, bypassCache)
}

func (p *DynamicPlatform) AddMediaToCollection(ctx context.Context, mIds []int) error {
	return p.GetPlatform().AddMediaToCollection(ctx, mIds)
}

func (p *DynamicPlatform) RefreshAnimeCollection(ctx context.Context) (interface{}, error) {
	return p.GetPlatform().RefreshAnimeCollection(ctx)
}
