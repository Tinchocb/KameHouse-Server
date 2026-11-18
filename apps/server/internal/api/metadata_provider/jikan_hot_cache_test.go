package metadata_provider

import (
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"kamehouse/internal/api/jikan"
	apiMetadata "kamehouse/internal/api/metadata"
)

func BenchmarkJikanMemoryHit(b *testing.B) {
	p := NewJikanProviderImpl(nil, nil, nil, nil)
	p.cache[42] = &jikanCachedEntry{data: &apiMetadata.AnimeMetadata{EpisodeCount: 24}, expiresAt: time.Now().Add(time.Hour)}
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		result, err := p.GetAnimeMetadata(42)
		if err != nil || result.EpisodeCount != 24 {
			b.Fatalf("cache: %+v %v", result, err)
		}
	}
}

func TestJikanMemoryHitPreservesExpiryAndOutage(t *testing.T) {
	p := NewJikanProviderImpl(nil, nil, nil, nil)
	data := &apiMetadata.AnimeMetadata{EpisodeCount: 24}
	p.cache[42] = &jikanCachedEntry{data: data, expiresAt: time.Now().Add(time.Hour)}
	p.fetchFn = func(int) (*apiMetadata.AnimeMetadata, error) {
		t.Error("warm cache invoked the producer")
		return nil, errors.New("unexpected producer")
	}
	got, err := p.GetAnimeMetadata(42)
	if err != nil || got != data {
		t.Fatalf("warm cache: %+v %v", got, err)
	}
	p.unavailableUntil = time.Now().Add(time.Hour)
	if _, err := p.GetAnimeMetadata(42); !errors.Is(err, jikan.ErrUnavailable) {
		t.Fatalf("outage priority lost: %v", err)
	}
	p.unavailableUntil = time.Time{}
	var calls atomic.Int32
	p.fetchFn = func(int) (*apiMetadata.AnimeMetadata, error) {
		calls.Add(1)
		return &apiMetadata.AnimeMetadata{EpisodeCount: 30}, nil
	}
	p.cache[42].expiresAt = time.Now().Add(-time.Second)
	got, err = p.GetAnimeMetadata(42)
	if err != nil || got.EpisodeCount != 30 || calls.Load() != 1 {
		t.Fatalf("expired cache: %+v %v, calls=%d", got, err, calls.Load())
	}
}
