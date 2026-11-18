package metadata_provider

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"sync"

	"kamehouse/internal/api/metadata"
	"kamehouse/internal/platforms/platform"
)

type providerGeneration struct {
	provider Provider
	readers  int
	retired  bool
	drained  chan struct{}
}

// DynamicProvider owns each installed provider. Replacements stop admitting
// readers to the old generation, then close it after its admitted calls finish.
// Shutdown cancels and joins all generations, including retired producers.
type DynamicProvider struct {
	mu       sync.Mutex
	current  *providerGeneration
	closed   bool
	stop     chan struct{}
	retired  sync.WaitGroup
	closeErr error
}

// NewDynamicProvider crea un DynamicProvider con el proveedor inicial dado.
func NewDynamicProvider(initial Provider) *DynamicProvider {
	p := &DynamicProvider{stop: make(chan struct{})}
	if initial != nil {
		p.current = &providerGeneration{provider: initial, drained: make(chan struct{})}
	}
	return p
}

// SetProvider transfers ownership on success. Callers retain ownership on error.
// Each replacement must be a fresh provider, except reinstalling the active one.
func (p *DynamicProvider) SetProvider(provider Provider) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.closed {
		return context.Canceled
	}
	if provider == nil {
		return errors.New("metadata provider is nil")
	}
	if p.current != nil && reflect.TypeOf(provider).Comparable() && p.current.provider == provider {
		return nil
	}
	p.retireLocked(p.current)
	p.current = &providerGeneration{provider: provider, drained: make(chan struct{})}
	return nil
}

// GetProvider is an observational snapshot only. Invoke methods through the
// DynamicProvider so retirement can track their lifetime.
func (p *DynamicProvider) GetProvider() Provider {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.current == nil {
		return nil
	}
	return p.current.provider
}

func (p *DynamicProvider) acquire() *providerGeneration {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.closed || p.current == nil {
		return nil
	}
	p.current.readers++
	return p.current
}

func (p *DynamicProvider) release(g *providerGeneration) {
	p.mu.Lock()
	defer p.mu.Unlock()
	g.readers--
	if g.retired && g.readers == 0 {
		close(g.drained)
	}
}

// Called under mu, which also excludes new registrations once Close starts.
// No provider method, I/O, or join runs under the admission lock.
func (p *DynamicProvider) retireLocked(g *providerGeneration) {
	if g == nil {
		return
	}
	g.retired = true
	if g.readers == 0 {
		close(g.drained)
	}
	p.retired.Add(1)
	go func() {
		defer p.retired.Done()
		select {
		case <-g.drained:
		case <-p.stop:
		}
		err := closeDynamicGeneration(g.provider)
		// Routing calls can still be unwinding after the concrete provider's
		// cancellation/join. Keep shared resources alive until those return too.
		<-g.drained
		if err != nil {
			p.mu.Lock()
			p.closeErr = errors.Join(p.closeErr, err)
			p.mu.Unlock()
		}
	}()
}

func closeDynamicGeneration(provider Provider) (err error) {
	defer func() {
		if v := recover(); v != nil {
			err = fmt.Errorf("metadata provider Close panicked: %v", v)
		}
	}()
	return provider.Close()
}

func (p *DynamicProvider) GetAnimeMetadata(id int) (*metadata.AnimeMetadata, error) {
	g := p.acquire()
	if g == nil {
		return nil, context.Canceled
	}
	defer p.release(g)
	return g.provider.GetAnimeMetadata(id)
}

func (p *DynamicProvider) GetAnimeMetadataWrapper(baseAnime *platform.UnifiedMedia, animeMetadata *metadata.AnimeMetadata) AnimeMetadataWrapper {
	g := p.acquire()
	if g == nil {
		return NewSimpleAnimeMetadataWrapper(animeMetadata)
	}
	defer p.release(g)
	return g.provider.GetAnimeMetadataWrapper(baseAnime, animeMetadata)
}

func (p *DynamicProvider) ClearCache() {
	g := p.acquire()
	if g == nil {
		return
	}
	defer p.release(g)
	g.provider.ClearCache()
}

func (p *DynamicProvider) Close() error {
	p.mu.Lock()
	if !p.closed {
		p.closed = true
		close(p.stop)
		p.retireLocked(p.current)
		p.current = nil
	}
	p.mu.Unlock()
	p.retired.Wait()
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.closeErr
}
