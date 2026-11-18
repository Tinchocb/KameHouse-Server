package core

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/api/tmdb"
)

type closingMetadataFixture struct {
	metadata_provider.ProviderImpl
	started, release chan struct{}
}

func TestCleanupJoinsAlreadyClosingMetadata(t *testing.T) {
	a := cleanupTestApp()
	provider := &closingMetadataFixture{started: make(chan struct{}), release: make(chan struct{})}
	a.Metadata.Provider = metadata_provider.NewDynamicProvider(provider)
	var release sync.Once
	t.Cleanup(func() { release.Do(func() { close(provider.release) }) })
	providerDone := make(chan struct{})
	go func() { _ = a.Metadata.Provider.Close(); close(providerDone) }()
	waitCleanup(t, provider.started)
	var sharedClosed atomic.Bool
	a.AddCleanupFunction(func() { sharedClosed.Store(true) })
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	a.Cleanup(ctx)
	if sharedClosed.Load() {
		t.Fatal("shared resources closed before metadata join")
	}
	release.Do(func() { close(provider.release) })
	waitCleanup(t, providerDone)
	waitCleanup(t, a.cleanupDone)
	if !sharedClosed.Load() {
		t.Fatal("cleanup callback did not run")
	}
}

func TestMetadataPublicationAfterCloseDisposesCandidate(t *testing.T) {
	old := tmdb.NewClient("", "es-ES")
	m := MetadataProviders{tmdbClient: old, Provider: metadata_provider.NewDynamicProvider(&metadata_provider.ProviderImpl{})}
	if err := m.Provider.Close(); err != nil {
		t.Fatal(err)
	}
	candidate := &closingMetadataFixture{started: make(chan struct{}), release: make(chan struct{})}
	close(candidate.release)
	m.publishTMDB(tmdb.NewClient("", "en-US"), candidate)
	waitCleanup(t, candidate.started)
	if m.GetTMDBClient() != old {
		t.Fatal("rejected publication replaced the client snapshot")
	}
}

func (p *closingMetadataFixture) Close() error {
	close(p.started)
	<-p.release
	return nil
}

func TestCleanupJoinsMetadataBeforeSharedResources(t *testing.T) {
	a := cleanupTestApp()
	provider := &closingMetadataFixture{started: make(chan struct{}), release: make(chan struct{})}
	a.Metadata.Provider = metadata_provider.NewDynamicProvider(provider)
	workerStarted, workerRelease := make(chan struct{}), make(chan struct{})
	var releaseWorker, releaseProvider sync.Once
	defer func() {
		releaseWorker.Do(func() { close(workerRelease) })
		releaseProvider.Do(func() { close(provider.release) })
	}()
	if !a.StartBackground(func() { close(workerStarted); <-a.ShutdownCtx().Done(); <-workerRelease }) {
		t.Fatal("worker rejected")
	}
	<-workerStarted
	var sharedClosed atomic.Bool
	a.AddCleanupFunction(func() { sharedClosed.Store(true) })
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	a.Cleanup(ctx)
	cancel()
	select {
	case <-provider.started:
		t.Fatal("provider closed before app worker completed")
	default:
	}
	if a.StartBackground(func() { t.Error("late worker ran") }) {
		t.Fatal("late worker admitted")
	}
	releaseWorker.Do(func() { close(workerRelease) })
	waitCleanup(t, provider.started)
	if sharedClosed.Load() {
		t.Fatal("shared resource closed before metadata producer joined")
	}
	releaseProvider.Do(func() { close(provider.release) })
	waitCleanup(t, a.cleanupDone)
	if !sharedClosed.Load() {
		t.Fatal("cleanup did not close shared resource after metadata")
	}
}
