package filecache

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestPersistentValuesPreservePrecisionAndRoundTrip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "values.cache")
	// Larger than the greatest exactly representable float64 integer.
	require.NoError(t, os.WriteFile(path, []byte(`{"one":{"value":{"name":"original","size":9007199254740993,"tracks":["aac"]}},"two":{"value":{"name":"unread","size":9007199254740995}}}`), 0600))
	c, err := NewCacher(dir)
	require.NoError(t, err)
	bucket := NewBucket("values", time.Hour)
	var got performanceValue
	ok, err := c.Get(bucket, "one", &got)
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, int64(9007199254740993), got.Size)
	// Flush a mix of hydrated and still-encoded values.
	require.NoError(t, c.Set(bucket, "new", performanceValue{Name: "new"}))
	require.NoError(t, c.Close())
	reopened, err := NewCacher(dir)
	require.NoError(t, err)
	defer reopened.Close()
	all, err := GetAll[performanceValue](reopened, bucket)
	require.NoError(t, err)
	require.Equal(t, int64(9007199254740993), all["one"].Size)
	require.Equal(t, int64(9007199254740995), all["two"].Size)
	require.Equal(t, "new", all["new"].Name)
}

func TestConcurrentBucketOpenJoinsLoad(t *testing.T) {
	c, err := NewCacher(t.TempDir())
	require.NoError(t, err)
	defer c.Close()
	path := filepath.Join(c.dir, "media.cache")
	require.NoError(t, os.WriteFile(path, []byte(`{"persisted":{"value":"on disk"}}`), 0600))
	store := &CacheStore{filePath: path, data: make(map[string]*cacheItem)}
	// Hold the disk load, simulating a bucket published before loading starts.
	store.mu.Lock()
	c.stores["media"] = store
	results := make(chan error, 16)
	var started sync.WaitGroup
	for range 16 {
		started.Add(1)
		go func() {
			started.Done()
			var value string
			found, err := c.Get(NewBucket("media", time.Hour), "persisted", &value)
			if err == nil && (!found || value != "on disk") {
				err = fmt.Errorf("premature cache miss: %t %q", found, value)
			}
			results <- err
		}()
	}
	started.Wait()
	store.mu.Unlock()
	for range 16 {
		require.NoError(t, <-results)
	}
}

func TestFailedBucketLoadCanRetry(t *testing.T) {
	dir := t.TempDir()
	c, err := NewCacher(dir)
	require.NoError(t, err)
	defer c.Close()
	path := filepath.Join(dir, "retry.cache")
	failed := &CacheStore{loadErr: errors.New("disk unavailable")}
	failed.loadOnce.Do(func() {})
	c.stores["retry"] = failed
	var value string
	_, err = c.Get(NewBucket("retry", time.Hour), "key", &value)
	require.Error(t, err)
	require.NoError(t, os.WriteFile(path, []byte(`{"key":{"value":"recovered"}}`), 0600))
	ok, err := c.Get(NewBucket("retry", time.Hour), "key", &value)
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, "recovered", value)
}

func TestPersistedExpirationAndMissingValue(t *testing.T) {
	c, err := NewCacher(t.TempDir())
	require.NoError(t, err)
	defer c.Close()
	path := filepath.Join(c.dir, "expiry.cache")
	require.NoError(t, os.WriteFile(path, []byte(`{"expired":{"value":"old","expiration":"2000-01-01T00:00:00Z"},"missing":{},"valid":{"value":"ok","expiration":"2099-01-01T00:00:00Z","updated_at":"2026-11-06T00:00:00Z"}}`), 0600))
	bucket := NewBucket("expiry", time.Hour)
	var value *string
	ok, err := c.Get(bucket, "expired", &value)
	require.NoError(t, err)
	require.False(t, ok)
	ok, err = c.Get(bucket, "missing", &value)
	require.NoError(t, err)
	require.True(t, ok)
	require.Nil(t, value)
	ok, err = c.Get(bucket, "valid", &value)
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, "ok", *value)
}
