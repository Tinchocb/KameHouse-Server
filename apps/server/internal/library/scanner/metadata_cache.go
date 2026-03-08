package scanner

import (
	"context"
	"strings"
	"sync"
	"time"

	"kamehouse/internal/database/models/dto"
	librarymetadata "kamehouse/internal/library/metadata"

	"golang.org/x/sync/singleflight"
)

// ─────────────────────────────────────────────────────────────────────────────
// metadataFetchCache — per-scan, in-memory, concurrent-safe metadata cache.
//
// Lifecycle: Create one per Scan() call, discard after. Contains no global
// state so it is naturally garbage-collected once the scan goroutine exits.
//
// Concurrency model:
//   - singleflight.Group collapses concurrent requests for the same title into
//     one outbound HTTP call. Workers 2-N block until worker 1 completes and
//     then receive the shared *dto.NormalizedMedia.
//   - sync.Map stores completed results so subsequent calls for the same title
//     skip the provider round-trip entirely.
// ─────────────────────────────────────────────────────────────────────────────

// metadataFetchCache wraps singleflight + sync.Map for deduplicated, cached
// external metadata lookups during a single scanner pass.
type metadataFetchCache struct {
	sf    singleflight.Group
	cache sync.Map // key: normalised title → *dto.NormalizedMedia
}

// newMetadataFetchCache returns a zero-value, ready-to-use cache.
// Allocate one per Scan() invocation; discard after the scan completes.
func newMetadataFetchCache() *metadataFetchCache {
	return &metadataFetchCache{}
}

// cacheKey normalises a title string into a stable lookup key.
// Lower-case + trim so "Attack on Titan" and "attack on titan" share an entry.
func cacheKey(title string) string {
	return strings.ToLower(strings.TrimSpace(title))
}

// Lookup attempts to retrieve a cached result, returning (entry, true) if found.
func (c *metadataFetchCache) Lookup(title string) (*dto.NormalizedMedia, bool) {
	v, ok := c.cache.Load(cacheKey(title))
	if !ok {
		return nil, false
	}
	return v.(*dto.NormalizedMedia), true
}

// FetchOnce ensures exactly ONE outbound provider call is made per unique title
// across all concurrently running workers.
//
// Algorithm:
//  1. Check the local cache (sync.Map) — cache hit: return immediately.
//  2. Deduplicate concurrent callers via singleflight — only the first goroutine
//     makes the HTTP call; others await the result.
//  3. On success, store the result in sync.Map for future callers.
//  4. HTTP 429 responses are retried with exponential back-off (1s → 2s → 4s)
//     up to 3 attempts before propagating the error.
func (c *metadataFetchCache) FetchOnce(
	ctx context.Context,
	title string,
	providers []librarymetadata.Provider,
) (*dto.NormalizedMedia, error) {
	key := cacheKey(title)

	// Fast-path: already resolved by a previous worker.
	if cached, ok := c.cache.Load(key); ok {
		return cached.(*dto.NormalizedMedia), nil
	}

	// Deduplicate: collapse N concurrent requests for `key` into one HTTP call.
	v, err, _ := c.sf.Do(key, func() (interface{}, error) {
		// Re-check cache inside singleflight in case it was populated while
		// this goroutine was waiting for the group lock.
		if cached, ok := c.cache.Load(key); ok {
			return cached.(*dto.NormalizedMedia), nil
		}

		var result *dto.NormalizedMedia

		for _, provider := range providers {
			var searchRes []*dto.NormalizedMedia

			// Exponential back-off for HTTP 429 from the external provider.
			retryErr := retryWithBackoff(ctx, 3, func() error {
				var err error
				searchRes, err = provider.SearchMedia(title)
				return err
			})
			if retryErr != nil || len(searchRes) == 0 {
				continue // try next provider
			}

			result = searchRes[0]
			break
		}

		if result == nil {
			// Nothing found — return nil without caching so future calls can retry.
			return nil, nil
		}

		// Store in sync.Map before returning from singleflight so waiting
		// goroutines skip the provider round-trip on their next request.
		c.cache.Store(key, result)
		return result, nil
	})

	if err != nil {
		return nil, err
	}
	if v == nil {
		return nil, nil
	}
	return v.(*dto.NormalizedMedia), nil
}

// Clear releases all cached entries. Call after the scan pipeline completes to
// allow GC to reclaim the cached NormalizedMedia structs.
func (c *metadataFetchCache) Clear() {
	c.cache.Range(func(k, _ any) bool {
		c.cache.Delete(k)
		return true
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// retryWithBackoffDuration is an alias for use by external callers that need
// a configurable initial delay (tests, etc.). The scanner uses retryWithBackoff
// defined in media_fetcher.go (initial delay = 1 s).
// ─────────────────────────────────────────────────────────────────────────────

// retryProviderCall wraps a provider call with 429-aware exponential backoff
// and a hard context deadline so a hung upstream cannot stall the scanner
// indefinitely.
func retryProviderCall(
	ctx context.Context,
	maxAttempts int,
	initialDelay time.Duration,
	fn func() error,
) error {
	delay := initialDelay
	for attempt := 0; attempt < maxAttempts; attempt++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		err := fn()
		if err == nil {
			return nil
		}
		if !strings.Contains(err.Error(), "429") {
			return err // non-rate-limit errors are not retried
		}
		if attempt == maxAttempts-1 {
			return errRateLimited
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
			delay *= 2
		}
	}
	return errRateLimited
}
