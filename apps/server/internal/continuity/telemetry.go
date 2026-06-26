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
	repository *db.WatchHistoryRepository
	ticker     *time.Ticker
	quit       chan struct{}
	logger     *zerolog.Logger
}

// NewTelemetryManager initializes the TelemetryManager
func NewTelemetryManager(manager *Manager, logger *zerolog.Logger, flushInterval time.Duration) *TelemetryManager {
	tm := &TelemetryManager{
		buffer:     make(map[telemetryKey]telemetryEntry),
		repository: db.NewWatchHistoryRepository(manager.db.Gorm()),
		quit:       make(chan struct{}),
		logger:     logger,
	}
	tm.Start(flushInterval)
	tm.logger.Info().Dur("flushInterval", flushInterval).Msg("telemetry: Initialized High-Speed Buffered Telemetry Manager")
	return tm
}

// UpdateProgress safely and instantly updates the memory buffer with a typed entry.
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
}

// Start launches the Flush Engine Background Worker.
func (tm *TelemetryManager) Start(flushInterval time.Duration) {
	tm.ticker = time.NewTicker(flushInterval)
	go func() {
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

		// If ratio is >= 90%, mark the media/episode as completed
		if entry.Duration > 0 && (entry.CurrentTime/entry.Duration) >= IgnoreRatioThreshold {
			// Convert AccountID to string (or handle appropriately since UserMediaProgress uses AnonUserId as string)
			anonUserId := fmt.Sprintf("%d", entry.AccountID)
			completedProgress = append(completedProgress, models.UserMediaProgress{
				AnonUserId: anonUserId,
				MediaID:    entry.MediaID,
				Status:     "completed",
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
		// Update UserMediaProgress to status='completed' in db
		// Using the repository's underlying DB (gorm.DB)
		for _, prog := range completedProgress {
			err := tm.repository.DB.Clauses(clause.OnConflict{
				Columns: []clause.Column{
					{Name: "anon_user_id"},
					{Name: "media_id"},
				},
				DoUpdates: clause.AssignmentColumns([]string{"status", "progress"}),
			}).Create(&prog).Error
			if err != nil {
				tm.logger.Error().Err(err).Int("mediaID", prog.MediaID).Msg("telemetry: Failed to mark media progress as completed")
			} else {
				tm.logger.Debug().Int("mediaID", prog.MediaID).Msg("telemetry: Automatically marked media progress as completed")
			}
		}
	}
}

// Stop initiates a graceful shutdown and blocks until the final synchronous flush is performed.
func (tm *TelemetryManager) Stop() {
	if tm.ticker != nil {
		tm.ticker.Stop()
	}
	// Send signal to close the background worker
	tm.quit <- struct{}{}
}


