package metadata_provider

import (
	"sync/atomic"

	"kamehouse/internal/api/metadata"
	"kamehouse/internal/platforms/platform"
)

type providerWrapper struct {
	Provider Provider
}

// DynamicProvider implementa Provider y redirige atómicamente entre un
// proveedor online y uno offline según el estado de la red.
// Reemplaza el uso de *util.Ref[Provider].
type DynamicProvider struct {
	current atomic.Value // providerWrapper
}

// NewDynamicProvider crea un DynamicProvider con el proveedor inicial dado.
func NewDynamicProvider(initial Provider) *DynamicProvider {
	p := &DynamicProvider{}
	p.current.Store(providerWrapper{Provider: initial})
	return p
}

// SetProvider intercambia atómicamente el proveedor activo.
func (p *DynamicProvider) SetProvider(provider Provider) {
	p.current.Store(providerWrapper{Provider: provider})
}

// GetProvider devuelve el proveedor activo.
func (p *DynamicProvider) GetProvider() Provider {
	val := p.current.Load()
	if val == nil {
		return nil
	}
	return val.(providerWrapper).Provider
}

func (p *DynamicProvider) GetAnimeMetadata(id int) (*metadata.AnimeMetadata, error) {
	return p.GetProvider().GetAnimeMetadata(id)
}

func (p *DynamicProvider) GetAnimeMetadataWrapper(baseAnime *platform.UnifiedMedia, animeMetadata *metadata.AnimeMetadata) AnimeMetadataWrapper {
	return p.GetProvider().GetAnimeMetadataWrapper(baseAnime, animeMetadata)
}

func (p *DynamicProvider) SetUseFallbackProvider(v bool) {
	p.GetProvider().SetUseFallbackProvider(v)
}

func (p *DynamicProvider) ClearCache() {
	p.GetProvider().ClearCache()
}

func (p *DynamicProvider) Close() error {
	return p.GetProvider().Close()
}
