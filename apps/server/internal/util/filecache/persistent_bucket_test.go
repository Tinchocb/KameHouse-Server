package filecache

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestPersistentBucketSurvivesCacheLocationChange(t *testing.T) {
	stable := t.TempDir()
	first, err := NewCacherWithPersistentBucket(t.TempDir(), "watch_history", stable)
	require.NoError(t, err)
	bucket := NewBucket("watch_history", time.Hour)
	require.NoError(t, first.Set(bucket, "episode", "position-123"))
	require.NoError(t, first.Close())
	second, err := NewCacherWithPersistentBucket(t.TempDir(), "watch_history", stable)
	require.NoError(t, err)
	defer second.Close()
	var value string
	found, err := second.Get(bucket, "episode", &value)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "position-123", value)
}

func TestPersistentBucketCopiesLegacyWithoutDeletingOrOverwriting(t *testing.T) {
	oldDir := t.TempDir()
	legacy, err := NewCacher(oldDir)
	require.NoError(t, err)
	bucket := NewBucket("watch_history", time.Hour)
	require.NoError(t, legacy.Set(bucket, "episode", "legacy-position"))
	require.NoError(t, legacy.Close())
	stable := t.TempDir()
	migrated, err := NewCacherWithPersistentBucket(oldDir, "watch_history", stable)
	require.NoError(t, err)
	var value string
	found, err := migrated.Get(bucket, "episode", &value)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "legacy-position", value)
	require.NoError(t, migrated.Set(bucket, "episode", "new-position"))
	require.NoError(t, migrated.Close())
	_, err = os.Stat(filepath.Join(oldDir, "watch_history.cache"))
	require.NoError(t, err)
	reopened, err := NewCacherWithPersistentBucket(oldDir, "watch_history", stable)
	require.NoError(t, err)
	defer reopened.Close()
	found, err = reopened.Get(bucket, "episode", &value)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "new-position", value)
}
