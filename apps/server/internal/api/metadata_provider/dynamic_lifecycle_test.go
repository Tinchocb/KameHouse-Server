package metadata_provider

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"kamehouse/internal/api/metadata"
)

type dynamicLifecycleFixture struct {
	ProviderImpl
	entered       chan struct{}
	release       chan struct{}
	readerExit    chan struct{}
	closed        chan struct{}
	closeRelease  chan struct{}
	cancelOnClose bool
	closeErr      error
	calls         atomic.Int32
	once          sync.Once
}

func (p *dynamicLifecycleFixture) GetAnimeMetadata(int) (*metadata.AnimeMetadata, error) {
	if p.entered != nil {
		close(p.entered)
	}
	if p.release != nil {
		<-p.release
	}
	if p.readerExit != nil {
		<-p.readerExit
	}
	return &metadata.AnimeMetadata{}, nil
}

func (p *dynamicLifecycleFixture) Close() error {
	p.calls.Add(1)
	p.once.Do(func() {
		if p.cancelOnClose {
			close(p.release)
		}
		close(p.closed)
	})
	if p.closeRelease != nil {
		<-p.closeRelease
	}
	return p.closeErr
}

func waitDynamic(t *testing.T, ch <-chan struct{}) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(3 * time.Second):
		t.Fatal("metadata lifecycle did not advance")
	}
}

func TestDynamicRetiresProviderAfterReadersFinish(t *testing.T) {
	old := &dynamicLifecycleFixture{entered: make(chan struct{}), release: make(chan struct{}), closed: make(chan struct{})}
	next := &dynamicLifecycleFixture{closed: make(chan struct{})}
	p := NewDynamicProvider(old)
	var release sync.Once
	t.Cleanup(func() { release.Do(func() { close(old.release) }); _ = p.Close() })
	done := make(chan struct{})
	go func() { defer close(done); _, _ = p.GetAnimeMetadata(1) }()
	waitDynamic(t, old.entered)
	p.SetProvider(next)
	if _, err := p.GetAnimeMetadata(2); err != nil {
		t.Fatal(err)
	}
	select {
	case <-old.closed:
		t.Fatal("retirement canceled an admitted reader")
	default:
	}
	release.Do(func() { close(old.release) })
	waitDynamic(t, done)
	waitDynamic(t, old.closed)
	if err := p.Close(); err != nil {
		t.Fatal(err)
	}
	if old.calls.Load() != 1 || next.calls.Load() != 1 {
		t.Fatal("providers were not closed exactly once")
	}
}

func TestDynamicShutdownCancelsAndJoinsRetiredProviders(t *testing.T) {
	old := &dynamicLifecycleFixture{entered: make(chan struct{}), release: make(chan struct{}), closed: make(chan struct{}), closeRelease: make(chan struct{}), cancelOnClose: true}
	next := &dynamicLifecycleFixture{closed: make(chan struct{})}
	p := NewDynamicProvider(old)
	var releaseClose sync.Once
	t.Cleanup(func() { releaseClose.Do(func() { close(old.closeRelease) }); _ = p.Close() })
	reader := make(chan struct{})
	go func() { defer close(reader); _, _ = p.GetAnimeMetadata(1) }()
	waitDynamic(t, old.entered)
	p.SetProvider(next)
	done := make(chan struct{})
	go func() { _ = p.Close(); close(done) }()
	waitDynamic(t, old.closed)
	waitDynamic(t, next.closed)
	waitDynamic(t, reader)
	select {
	case <-done:
		t.Fatal("shutdown returned before retired Close finished")
	default:
	}
	if _, err := p.GetAnimeMetadata(3); err == nil {
		t.Fatal("reader admitted after shutdown")
	}
	releaseClose.Do(func() { close(old.closeRelease) })
	waitDynamic(t, done)
}

func TestDynamicSameProviderAndCloseErrors(t *testing.T) {
	want := errors.New("close fixture")
	old := &dynamicLifecycleFixture{closed: make(chan struct{}), closeErr: want}
	p := NewDynamicProvider(old)
	p.SetProvider(old)
	p.SetProvider(&dynamicLifecycleFixture{closed: make(chan struct{})})
	waitDynamic(t, old.closed)
	if err := p.Close(); !errors.Is(err, want) {
		t.Fatalf("lost retirement error: %v", err)
	}
	_ = p.Close()
	if old.calls.Load() != 1 {
		t.Fatal("same provider closed repeatedly")
	}
}

func TestDynamicCloseJoinsReaderAfterConcreteCloseReturns(t *testing.T) {
	provider := &dynamicLifecycleFixture{entered: make(chan struct{}), release: make(chan struct{}), readerExit: make(chan struct{}), closed: make(chan struct{}), cancelOnClose: true}
	p := NewDynamicProvider(provider)
	var exit sync.Once
	t.Cleanup(func() { exit.Do(func() { close(provider.readerExit) }); _ = p.Close() })
	reader := make(chan struct{})
	go func() { defer close(reader); _, _ = p.GetAnimeMetadata(1) }()
	waitDynamic(t, provider.entered)
	done := make(chan struct{})
	go func() { _ = p.Close(); close(done) }()
	waitDynamic(t, provider.closed)
	select {
	case <-done:
		t.Fatal("shutdown returned with an admitted reader still running")
	default:
	}
	exit.Do(func() { close(provider.readerExit) })
	waitDynamic(t, reader)
	waitDynamic(t, done)
}

func TestDynamicConcurrentReplacementAndShutdown(t *testing.T) {
	initial := &dynamicLifecycleFixture{closed: make(chan struct{})}
	p := NewDynamicProvider(initial)
	providers := make([]*dynamicLifecycleFixture, 100)
	for i := range providers {
		providers[i] = &dynamicLifecycleFixture{closed: make(chan struct{})}
	}
	var workers sync.WaitGroup
	start := make(chan struct{})
	for _, provider := range providers {
		workers.Go(func() {
			<-start
			if err := p.SetProvider(provider); err != nil {
				_ = provider.Close()
			}
		})
	}
	for range 8 {
		workers.Go(func() {
			<-start
			for range 100 {
				_, _ = p.GetAnimeMetadata(1)
			}
		})
	}
	for range 4 {
		workers.Go(func() { <-start; _ = p.Close() })
	}
	close(start)
	workers.Wait()
	_ = p.Close()
	for _, provider := range append(providers, initial) {
		if got := provider.calls.Load(); got != 1 {
			t.Fatalf("close count %d, want 1", got)
		}
	}
	if p.GetProvider() != nil {
		t.Fatal("closed provider remains published")
	}
}
