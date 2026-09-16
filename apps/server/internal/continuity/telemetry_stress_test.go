package continuity

import (
	"context"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/test_utils"
	"kamehouse/internal/util"
	"kamehouse/internal/util/filecache"
	"path/filepath"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTelemetryManager_Stress(t *testing.T) {
	test_utils.SetTwoLevelDeep()
	test_utils.InitTestProvider(t)

	logger := util.NewLogger()
	tempDir := t.TempDir()

	database, err := db.NewDatabase(context.Background(), tempDir, "test-telemetry", logger)
	require.NoError(t, err)

	cacher, err := filecache.NewCacher(filepath.Join(tempDir, "cache"))
	require.NoError(t, err)

	manager := NewManager(&NewManagerOptions{
		FileCacher: cacher,
		Logger:     logger,
		Database:   database,
	})
	require.NotNil(t, manager)

	// Simulate 500 concurrent incoming HTTP requests pushing events into the Queue.
	var wg sync.WaitGroup
	workers := 500
	wg.Add(workers)

	for i := 0; i < workers; i++ {
		go func(workerID int) {
			defer wg.Done()

			// Each worker pushes 10 fast progress updates (simulating a few seconds of watching)
			for j := 0; j < 10; j++ {
				manager.TelemetryManager.UpdateProgress(1, 1, 1, float64(workerID*10+j), 1000.0)
			}
		}(i)
	}

	// Wait for all HTTP handlers to finish queuing
	wg.Wait()

	// Stop() cleanly flushes remaining queue events and stops background workers
	manager.TelemetryManager.Stop()

	// Verify that the entry exists in the DB
	var records []models.WatchHistory
	err = database.Gorm().Find(&records).Error
	require.NoError(t, err)

	// Because of deduplication across 500 concurrent goroutines updating mediaID 1,
	// only the absolute last processed tick should survive. We expect 1 item.
	require.Len(t, records, 1)
	require.Equal(t, 1, records[0].MediaID)
}
