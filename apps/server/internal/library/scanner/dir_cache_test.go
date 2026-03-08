package scanner

import (
	"sync"
	"testing"
	"time"
)

func TestDirCache_GetOrFetch_NoPanic(t *testing.T) {
	cache := NewDirCache()

	entry := cache.GetOrFetch("/anime/Dragon Ball Z", func() *DirCacheEntry {
		return &DirCacheEntry{
			MediaID:    12345,
			Title:      "Dragon Ball Z",
			Confidence: 0.95,
			FetchedAt:  time.Now(),
		}
	})

	if entry == nil {
		t.Fatal("expected non-nil entry from GetOrFetch")
	}
	if entry.MediaID != 12345 {
		t.Fatalf("expected MediaID 12345, got %d", entry.MediaID)
	}
	if entry.Title != "Dragon Ball Z" {
		t.Fatalf("expected title 'Dragon Ball Z', got '%s'", entry.Title)
	}
}

func TestDirCache_GetOrFetch_SecondCallReturnsCached(t *testing.T) {
	cache := NewDirCache()
	callCount := 0

	fetchFn := func() *DirCacheEntry {
		callCount++
		return &DirCacheEntry{
			MediaID:    42,
			Title:      "One Piece",
			Confidence: 0.99,
			FetchedAt:  time.Now(),
		}
	}

	entry1 := cache.GetOrFetch("/anime/One Piece", fetchFn)
	entry2 := cache.GetOrFetch("/anime/One Piece", fetchFn)

	if callCount != 1 {
		t.Fatalf("fetchFn should only be called once, was called %d times", callCount)
	}
	if entry1.MediaID != entry2.MediaID {
		t.Fatalf("expected same entry from both calls, got %d vs %d", entry1.MediaID, entry2.MediaID)
	}
}

func TestDirCache_GetOrFetch_ConcurrentNoPanic(t *testing.T) {
	cache := NewDirCache()
	const goroutines = 100

	var wg sync.WaitGroup
	results := make([]*DirCacheEntry, goroutines)

	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func(idx int) {
			defer wg.Done()
			results[idx] = cache.GetOrFetch("/anime/Naruto", func() *DirCacheEntry {
				return &DirCacheEntry{
					MediaID:    999,
					Title:      "Naruto",
					Confidence: 0.90,
					FetchedAt:  time.Now(),
				}
			})
		}(i)
	}

	wg.Wait()

	for i, r := range results {
		if r == nil {
			t.Fatalf("goroutine %d returned nil", i)
		}
		if r.MediaID != 999 {
			t.Fatalf("goroutine %d got unexpected MediaID %d", i, r.MediaID)
		}
	}
}

func TestDirCache_Load_AfterGetOrFetch(t *testing.T) {
	cache := NewDirCache()

	// Before any fetch, Load should return nil
	if got := cache.Load("/anime/Bleach"); got != nil {
		t.Fatalf("expected nil from Load before any fetch, got %+v", got)
	}

	// Fetch
	cache.GetOrFetch("/anime/Bleach", func() *DirCacheEntry {
		return &DirCacheEntry{
			MediaID:    777,
			Title:      "Bleach",
			Confidence: 0.88,
			FetchedAt:  time.Now(),
		}
	})

	// After fetch, Load should return the entry
	got := cache.Load("/anime/Bleach")
	if got == nil {
		t.Fatal("expected non-nil from Load after GetOrFetch")
	}
	if got.MediaID != 777 {
		t.Fatalf("expected MediaID 777, got %d", got.MediaID)
	}
}

func TestDirCache_ConcurrentLoadAndGetOrFetch(t *testing.T) {
	cache := NewDirCache()
	const goroutines = 50

	var wg sync.WaitGroup
	wg.Add(goroutines * 2) // half Load, half GetOrFetch

	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			cache.GetOrFetch("/anime/Attack on Titan", func() *DirCacheEntry {
				return &DirCacheEntry{
					MediaID:    111,
					Title:      "Attack on Titan",
					Confidence: 0.92,
					FetchedAt:  time.Now(),
				}
			})
		}()

		go func() {
			defer wg.Done()
			// Load may return nil (race with GetOrFetch), that's OK —
			// just verify no panic
			cache.Load("/anime/Attack on Titan")
		}()
	}

	wg.Wait()
}

func TestDirCache_Size(t *testing.T) {
	cache := NewDirCache()

	if s := cache.Size(); s != 0 {
		t.Fatalf("expected size 0, got %d", s)
	}

	cache.GetOrFetch("/a", func() *DirCacheEntry {
		return &DirCacheEntry{MediaID: 1}
	})
	cache.GetOrFetch("/b", func() *DirCacheEntry {
		return &DirCacheEntry{MediaID: 2}
	})

	if s := cache.Size(); s != 2 {
		t.Fatalf("expected size 2, got %d", s)
	}
}
