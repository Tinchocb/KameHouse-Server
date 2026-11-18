package filecache

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type blockedPersistenceValue struct {
	started chan struct{}
	release chan struct{}
}

func (v blockedPersistenceValue) MarshalJSON() ([]byte, error) {
	close(v.started)
	<-v.release
	return []byte(`"saved"`), nil
}

func TestFlushWaitsForWriteAlreadyInProgress(t *testing.T) {
	v := blockedPersistenceValue{started: make(chan struct{}), release: make(chan struct{})}
	var releaseOnce sync.Once
	unblock := func() { releaseOnce.Do(func() { close(v.release) }) }
	defer unblock()
	store := &CacheStore{filePath: filepath.Join(t.TempDir(), "data.cache"), data: map[string]*cacheItem{"key": {Value: v}}, dirty: true}
	first := make(chan error, 1)
	go func() { first <- store.Flush() }()
	select {
	case <-v.started:
	case <-time.After(5 * time.Second):
		t.Fatal("first flush did not start encoding")
	}
	second := make(chan error, 1)
	go func() { second <- store.Flush() }()
	returnedEarly := false
	select {
	case <-second:
		returnedEarly = true
	case <-time.After(100 * time.Millisecond):
	}
	unblock()
	require.NoError(t, <-first)
	if !returnedEarly {
		require.NoError(t, <-second)
	}
	require.False(t, returnedEarly, "flush reported success before the pending write finished")
	require.FileExists(t, store.filePath)
}

func TestFlushRetriesFailedWrite(t *testing.T) {
	dir := t.TempDir()
	store := &CacheStore{filePath: filepath.Join(dir, "missing", "data.cache"), data: map[string]*cacheItem{"key": {Value: "pending"}}, dirty: true}
	require.Error(t, store.Flush())
	require.NoError(t, os.Mkdir(filepath.Dir(store.filePath), 0700))
	require.NoError(t, store.Flush())
	data, err := os.ReadFile(store.filePath)
	require.NoError(t, err)
	require.Contains(t, string(data), "pending")
}

func TestCloseFlushesHealthyBucketsDespiteFailure(t *testing.T) {
	c, err := NewCacher(t.TempDir())
	require.NoError(t, err)
	c.stores["healthy"] = &CacheStore{filePath: filepath.Join(c.dir, "healthy.cache"), data: map[string]*cacheItem{"key": {Value: "saved"}}, dirty: true}
	// A second close must retry failed buckets after their directories are repaired.
	names := []string{"bucket-first", "bucket-second", "bucket-third"}
	for _, name := range names {
		c.stores[name] = &CacheStore{filePath: filepath.Join(c.dir, name, "data.cache"), data: map[string]*cacheItem{"key": {Value: name}}, dirty: true}
	}
	err = c.Close()
	require.Error(t, err)
	require.FileExists(t, c.stores["healthy"].filePath)
	for _, name := range names {
		require.Contains(t, err.Error(), name)
		require.NoError(t, os.Mkdir(filepath.Join(c.dir, name), 0700))
	}
	require.NoError(t, c.Close())
	for _, store := range c.stores {
		require.FileExists(t, store.filePath)
	}
}

func TestInitialSetFailureRetriedByClose(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "cache")
	c, err := NewCacher(dir)
	require.NoError(t, err)
	require.NoError(t, os.Remove(dir)) // Empty test directory only.
	require.Error(t, c.Set(NewBucket("data", time.Hour), "key", "pending"))
	require.NoError(t, os.Mkdir(dir, 0700))
	require.NoError(t, c.Close())
	data, err := os.ReadFile(filepath.Join(dir, "data.cache"))
	require.NoError(t, err)
	require.Contains(t, string(data), "pending")
}

func TestNullCacheDataDoesNotPanicOrDiscardValidEntries(t *testing.T) {
	for _, contents := range []string{`null`, `{"bad":null,"good":{"value":"kept"}}`} {
		t.Run(contents, func(t *testing.T) {
			c, err := NewCacher(t.TempDir())
			require.NoError(t, err)
			defer c.Close()
			require.NoError(t, os.WriteFile(filepath.Join(c.dir, "data.cache"), []byte(contents), 0600))
			bucket := NewBucket("data", time.Hour)
			var value string
			found, err := c.Get(bucket, "bad", &value)
			require.NoError(t, err)
			require.False(t, found)
			require.NoError(t, c.Set(bucket, "new", "saved"))
			all, err := GetAll[string](c, bucket)
			require.NoError(t, err)
			require.Equal(t, "saved", all["new"])
			if contents != "null" {
				require.Equal(t, "kept", all["good"])
			}
		})
	}
}
