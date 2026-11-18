package filecache

import (
	"context"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestRemovalCanCancelWhileWaitingForWriter(t *testing.T) {
	c, err := NewCacher(t.TempDir())
	require.NoError(t, err)
	store, err := c.getStore("media")
	require.NoError(t, err)
	store.saveMu.Lock()
	ctx, cancel := context.WithTimeout(t.Context(), 20*time.Millisecond)
	defer cancel()
	removed := make(chan error, 1)
	go func() { removed <- c.RemoveAllByContext(ctx, func(string) bool { return true }) }()
	select {
	case err := <-removed:
		store.saveMu.Unlock()
		require.ErrorIs(t, err, context.DeadlineExceeded)
	case <-time.After(2 * time.Second):
		store.saveMu.Unlock()
		<-removed
		t.Fatal("clear could not abandon its wait for a writer")
	}
	require.Same(t, store, c.stores["media"])
}

func TestRemovalJoinsInflightWriteAndDiscardsItsResult(t *testing.T) {
	c, err := NewCacher(t.TempDir())
	require.NoError(t, err)
	v := blockedPersistenceValue{started: make(chan struct{}), release: make(chan struct{})}
	var once sync.Once
	unblock := func() { once.Do(func() { close(v.release) }) }
	defer unblock()
	store, err := c.getStore("media")
	require.NoError(t, err)
	store.data["key"] = &cacheItem{Value: v}
	store.dirty = true
	writeDone := make(chan error, 1)
	go func() { writeDone <- store.Flush() }()
	select {
	case <-v.started:
	case <-time.After(5 * time.Second):
		t.Fatal("write did not start")
	}
	removed := make(chan error, 1)
	go func() { removed <- c.RemoveAllBy(func(string) bool { return true }) }()
	// Other buckets remain accessible while the clear waits for this writer.
	_, err = c.getStore("unrelated")
	require.NoError(t, err)
	unblock()
	require.NoError(t, <-writeDone)
	require.NoError(t, <-removed)
	require.NoError(t, store.Flush())
	require.NoFileExists(t, store.filePath)
}

func TestRemovedBucketCannotBeRepersistedByPendingSave(t *testing.T) {
	c, err := NewCacher(t.TempDir())
	require.NoError(t, err)
	defer c.Close()
	bucket := NewBucket("media", time.Hour)
	require.NoError(t, c.Set(bucket, "key", "old"))
	require.NoError(t, c.Set(bucket, "key", "pending"))
	old, err := c.getStore(bucket.name)
	require.NoError(t, err)
	require.NoError(t, c.RemoveAllBy(func(string) bool { return true }))
	// Exercise the same callback that an already queued timer can execute.
	require.NoError(t, old.Flush())
	require.NoFileExists(t, old.filePath)
	var value string
	found, err := c.Get(bucket, "key", &value)
	require.NoError(t, err)
	require.False(t, found)
	require.NoError(t, c.Set(bucket, "key", "new"))
	require.NoError(t, c.Close())
	reopened, err := NewCacher(c.dir)
	require.NoError(t, err)
	defer reopened.Close()
	found, err = reopened.Get(bucket, "key", &value)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "new", value)
}

func TestRemovalIncludesUnwrittenBucketsAndPreservesPersistentHistory(t *testing.T) {
	dir, historyDir := t.TempDir(), t.TempDir()
	c, err := NewCacherWithPersistentBucket(dir, "history", historyDir)
	require.NoError(t, err)
	defer c.Close()
	require.NoError(t, c.Set(NewBucket("history", time.Hour), "key", "watched"))
	store, err := c.getStore("unwritten")
	require.NoError(t, err)
	store.mu.Lock()
	store.data["key"] = &cacheItem{Value: "old"}
	store.mu.Unlock()
	store.scheduleSave(time.Hour)
	require.NoError(t, c.RemoveAllBy(func(string) bool { return true }))
	require.NoError(t, store.Flush())
	require.NoFileExists(t, store.filePath)
	var value string
	found, err := c.Get(NewBucket("history", time.Hour), "key", &value)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "watched", value)
	require.FileExists(t, filepath.Join(historyDir, "history.cache"))
}

func TestRemoveFailureRetainsBucketAndReportsError(t *testing.T) {
	c, err := NewCacher(t.TempDir())
	require.NoError(t, err)
	defer c.Close()
	bucket := NewBucket("media", time.Hour)
	require.NoError(t, c.Set(bucket, "key", "keep"))
	// Turn the file into a nonempty directory from the filter, after enumeration.
	err = c.RemoveAllBy(func(name string) bool {
		path := filepath.Join(c.dir, name)
		require.NoError(t, os.Remove(path))
		require.NoError(t, os.Mkdir(path, 0700))
		require.NoError(t, os.WriteFile(filepath.Join(path, "busy"), []byte("x"), 0600))
		return true
	})
	require.Error(t, err)
	var value string
	found, err := c.Get(bucket, "key", &value)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "keep", value)
}
