package continuity

import (
	"fmt"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"gorm.io/gorm/clause"
)

// telemetryEntry is the in-memory buffer entry for a single playback position.
type telemetryEntry struct {
	AccountID     uint
	MediaID       int
	EpisodeNumber int
	CurrentTime   float64
	Duration      float64
}

// telemetryKey uniquely identifies a playback session.
type telemetryKey struct {
	AccountID     uint
	MediaID       int
	EpisodeNumber int
}

// TelemetryManager orchestrates high-speed, thread-safe playback progress buffering.
type TelemetryManager struct {
	mu         sync.RWMutex
	buffer     map[telemetryKey]telemetryEntry
	manager    *Manager
	repository *db.WatchHistoryRepository
	ticker     *time.Ticker
	quit       chan struct{}
	wg         sync.WaitGroup
	stopOnce   sync.Once
	logger     *zerolog.Logger
}

// NewTelemetryManager initializes the TelemetryManager
func NewTelemetryManager(manager *Manager, logger *zerolog.Logger, flushInterval time.Duration) *TelemetryManager {
	tm := &TelemetryManager{
		buffer:     make(map[telemetryKey]telemetryEntry),
		manager:    manager,
		repository: db.NewWatchHistoryRepository(manager.db.Gorm()),
		quit:       make(chan struct{}),
		logger:     logger,
	}
	tm.Start(flushInterval)
	tm.logger.Info().Dur("flushInterval", flushInterval).Msg("telemetry: Initialized High-Speed Buffered Telemetry Manager")
	return tm
}

// UpdateProgress safely and instantly updates the memory buffer and file cache.
func (tm *TelemetryManager) UpdateProgress(accountID uint, mediaID, episodeNumber int, currentTime, duration float64) {
	tm.mu.Lock()
	key := telemetryKey{AccountID: accountID, MediaID: mediaID, EpisodeNumber: episodeNumber}
	tm.buffer[key] = telemetryEntry{
		AccountID:     accountID,
		MediaID:       mediaID,
		EpisodeNumber: episodeNumber,
		CurrentTime:   currentTime,
		Duration:      duration,
	}
	tm.mu.Unlock()

	// Update continuity file cache simultaneously for instant sync across endpoints
	if tm.manager != nil {
		_ = tm.manager.UpdateWatchHistoryItem(&UpdateWatchHistoryItemOptions{
			CurrentTime:   currentTime,
			Duration:      duration,
			MediaID:       mediaID,
			EpisodeNumber: episodeNumber,
			Kind:          MediastreamKind,
			Predictive:    false,
		})
	}
}

// Start launches the Flush Engine Background Worker.
func (tm *TelemetryManager) Start(flushInterval time.Duration) {
	tm.ticker = time.NewTicker(flushInterval)
	tm.wg.Add(1)
	go func() {
		defer tm.wg.Done()
		defer func() {
			if r := recover(); r != nil {
				tm.logger.Error().Interface("panic", r).Msg("telemetry: panic in background flush worker")
			}
		}()
		for {
			select {
			case <-tm.ticker.C:
				tm.flush()
			case <-tm.quit:
				tm.flush() // Ensure no progress is lost on server shutdown
				return
			}
		}
	}()
}

// flush safely duplicates the map and calls the DB repository outside the lock.
func (tm *TelemetryManager) flush() {
	tm.mu.Lock()
	if len(tm.buffer) == 0 {
		tm.mu.Unlock()
		return
	}

	// Copy and reinitialize
	localBatch := make(map[telemetryKey]telemetryEntry, len(tm.buffer))
	for k, v := range tm.buffer {
		localBatch[k] = v
	}
	tm.buffer = make(map[telemetryKey]telemetryEntry)
	tm.mu.Unlock()

	var records []models.WatchHistory
	var completedProgress []models.UserMediaProgress

	for _, entry := range localBatch {
		if entry.MediaID <= 0 {
			continue
		}

		// Keep track of watch history
		records = append(records, models.WatchHistory{
			AccountID:     entry.AccountID,
			MediaID:       entry.MediaID,
			EpisodeNumber: entry.EpisodeNumber,
			CurrentTime:   entry.CurrentTime,
			Duration:      entry.Duration,
		})

		// If ratio is >= 90%, record the progress
		if entry.Duration > 0 && (entry.CurrentTime/entry.Duration) >= IgnoreRatioThreshold {
			anonUserId := fmt.Sprintf("%d", entry.AccountID)
			status := "watching"
			if entry.MediaID >= 1_000_000 {
				status = "completed"
			}
			completedProgress = append(completedProgress, models.UserMediaProgress{
				AnonUserId: anonUserId,
				MediaID:    entry.MediaID,
				Status:     status,
				Progress:   entry.EpisodeNumber,
			})
		}
	}

	if len(records) > 0 {
		if err := tm.repository.UpsertBatch(records); err != nil {
			tm.logger.Error().Err(err).Int("batchSize", len(records)).Msg("telemetry: Async DB Flush failed")
		} else {
			tm.logger.Trace().Int("batchSize", len(records)).Msg("telemetry: Flushed bulk tick to disk successfully")
		}
	}

	if len(completedProgress) > 0 {
		// Bulk Upsert in batches to avoid locking SQLite.
		// Sin transacción a propósito (SkipDefaultTransaction=true): cada fila es
		// un upsert independiente e idempotente y el flush no reintenta, así que
		// un todo-o-nada convertiría un fallo parcial en pérdida total.
		err := tm.repository.DB.Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "anon_user_id"},
				{Name: "media_id"},
			},
			DoUpdates: clause.AssignmentColumns([]string{"status", "progress"}),
		}).CreateInBatches(completedProgress, 50).Error
		if err != nil {
			tm.logger.Error().Err(err).Msg("telemetry: Bulk media progress update failed")
		} else {
			tm.logger.Debug().Int("count", len(completedProgress)).Msg("telemetry: Bulk updated media progress")
		}
	}
}

// Stop initiates a graceful shutdown and blocks until the final synchronous flush is performed.
func (tm *TelemetryManager) Stop() {
	tm.stopOnce.Do(func() {
		if tm.ticker != nil {
			tm.ticker.Stop()
		}
		// Signal background worker to do final flush and wait for completion
		close(tm.quit)
		tm.wg.Wait()
	})
}


