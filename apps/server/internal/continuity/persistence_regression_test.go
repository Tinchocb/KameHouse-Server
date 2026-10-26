package continuity

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/util/filecache"

	"github.com/glebarez/sqlite"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// Only the history schema is needed; no application migrations, real data or workers.
func newPersistenceFixture(t *testing.T) (*Manager, *TelemetryManager, *gorm.DB) {
	t.Helper()
	dir := t.TempDir()
	gdb, err := gorm.Open(sqlite.Open(filepath.Join(dir, "history.db")), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, gdb.AutoMigrate(&models.WatchHistory{}))
	sqlDB, err := gdb.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	cacher, err := filecache.NewCacher(filepath.Join(dir, "cache"))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, cacher.Close()) })
	bucket := filecache.NewBucket(WatchHistoryBucketName, time.Hour)
	logger := zerolog.Nop()
	m := &Manager{fileCacher: cacher, watchHistoryFileCacheBucket: &bucket, logger: &logger}
	tm := &TelemetryManager{
		buffer: make(map[telemetryKey]telemetryEntry), manager: m,
		repository: db.NewWatchHistoryRepository(gdb), logger: &logger, quit: make(chan struct{}),
	}
	return m, tm, gdb
}

func TestProgressRetryAfterDatabaseFailure(t *testing.T) {
	_, tm, gdb := newPersistenceFixture(t)
	require.NoError(t, gdb.Exec(`CREATE TRIGGER fail_history BEFORE INSERT ON watch_histories BEGIN SELECT RAISE(FAIL, 'temporary failure'); END`).Error)
	// End of episode followed by the next episode of a marathon.
	tm.UpdateProgress(1, 42, 1, 990, 1000)
	tm.UpdateProgress(1, 42, 2, 120, 1000)
	tm.flush()
	require.NoError(t, gdb.Exec(`DROP TRIGGER fail_history`).Error)
	tm.flush()
	var rows []models.WatchHistory
	require.NoError(t, gdb.Order("episode_number").Find(&rows).Error)
	require.Len(t, rows, 2, "a transient failure must not discard either episode")
	require.Equal(t, 990.0, rows[0].CurrentTime)
	require.Equal(t, 120.0, rows[1].CurrentTime)
}

func TestProgressRetryPreservesNewerBeat(t *testing.T) {
	_, tm, gdb := newPersistenceFixture(t)
	tm.UpdateProgress(1, 42, 1, 100, 1000)
	tm.UpdateProgress(1, 42, 2, 120, 1000)
	const callback = "test:failed_flush_new_beat"
	require.NoError(t, gdb.Callback().Create().Before("gorm:create").Register(callback, func(tx *gorm.DB) {
		tm.UpdateProgress(1, 42, 1, 50, 1000) // Legitimate backward seek during I/O.
		tx.AddError(errors.New("temporary failure"))
	}))
	tm.flush()
	require.NoError(t, gdb.Callback().Create().Remove(callback))
	tm.flush()
	var rows []models.WatchHistory
	require.NoError(t, gdb.Order("episode_number").Find(&rows).Error)
	require.Len(t, rows, 2)
	require.Equal(t, 50.0, rows[0].CurrentTime, "retry must keep the newer seek, not the greatest position")
	require.Equal(t, 120.0, rows[1].CurrentTime)
}

func TestProgressHistoryPublishesImmutableSnapshots(t *testing.T) {
	m, _, _ := newPersistenceFixture(t)
	require.NoError(t, m.UpdateWatchHistoryItem(&UpdateWatchHistoryItemOptions{MediaID: 42, EpisodeNumber: 1, CurrentTime: 100, Duration: 1000}))
	var published *WatchHistoryItem
	found, err := m.fileCacher.Get(*m.watchHistoryFileCacheBucket, "42_1", &published)
	require.NoError(t, err)
	require.True(t, found)
	require.NoError(t, m.UpdateWatchHistoryItem(&UpdateWatchHistoryItemOptions{MediaID: 42, EpisodeNumber: 1, CurrentTime: 200, Duration: 1000}))
	require.Equal(t, 100.0, published.CurrentTime, "cache serializers can retain an earlier snapshot outside the manager lock")
	require.Equal(t, 200.0, m.GetWatchHistoryItem(42).Item.CurrentTime)
}

func TestProgressCompletionCannotDeleteNewerPosition(t *testing.T) {
	previous := runtime.GOMAXPROCS(1)
	defer runtime.GOMAXPROCS(previous)
	m, _, _ := newPersistenceFixture(t)
	cacheDir := t.TempDir()
	cacher, err := filecache.NewCacher(cacheDir)
	require.NoError(t, err)
	m.fileCacher = cacher
	t.Cleanup(func() { require.NoError(t, cacher.Close()) })
	for _, position := range []float64{950, 960, 200} {
		require.NoError(t, m.UpdateWatchHistoryItem(&UpdateWatchHistoryItemOptions{MediaID: 42, EpisodeNumber: 1, CurrentTime: position, Duration: 1000}))
	}
	// Let delayed deletion run, then reopen the persisted bucket as after a restart.
	time.Sleep(50 * time.Millisecond)
	require.NoError(t, m.fileCacher.Close())
	reopened, err := filecache.NewCacher(cacheDir)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, reopened.Close()) })
	items, err := filecache.GetAll[*WatchHistoryItem](reopened, *m.watchHistoryFileCacheBucket)
	require.NoError(t, err)
	require.Contains(t, items, "42_1", "a completion cleanup must not delete the later rewind")
	require.Equal(t, 200.0, items["42_1"].CurrentTime)
}

func TestProgressConcurrentSnapshotEncoding(t *testing.T) {
	m, _, _ := newPersistenceFixture(t)
	require.NoError(t, m.UpdateWatchHistoryItem(&UpdateWatchHistoryItemOptions{MediaID: 42, EpisodeNumber: 1, CurrentTime: 100, Duration: 1000}))
	var workers sync.WaitGroup
	workers.Go(func() {
		for i := range 500 {
			if err := m.UpdateWatchHistoryItem(&UpdateWatchHistoryItemOptions{MediaID: 42, EpisodeNumber: 1, CurrentTime: float64(100 + i), Duration: 1000}); err != nil {
				t.Error(err)
			}
		}
	})
	workers.Go(func() {
		for range 500 {
			var snapshot *WatchHistoryItem
			if _, err := m.fileCacher.Get(*m.watchHistoryFileCacheBucket, "42_1", &snapshot); err != nil {
				t.Error(err)
			}
			// saveToFile also serializes published values outside the cache lock.
			if _, err := json.Marshal(snapshot); err != nil {
				t.Error(err)
			}
		}
	})
	workers.Wait()
}

func TestProgressStopIsTerminal(t *testing.T) {
	m, tm, gdb := newPersistenceFixture(t)
	tm.Start(time.Hour)
	t.Cleanup(tm.Stop)
	tm.UpdateProgress(1, 42, 1, 100, 1000)
	tm.Stop()
	tm.UpdateProgress(1, 42, 2, 200, 1000)
	require.Empty(t, tm.buffer, "late calls cannot enqueue work after the final flush")
	require.Equal(t, 1, m.GetWatchHistoryItem(42).Item.EpisodeNumber, "late calls cannot write the file cache after Stop")
	var rows []models.WatchHistory
	require.NoError(t, gdb.Find(&rows).Error)
	require.Len(t, rows, 1)
	require.Equal(t, 1, rows[0].EpisodeNumber)
}
