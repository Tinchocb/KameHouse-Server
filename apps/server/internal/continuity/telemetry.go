package continuity

import (
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"sync"
	"time"

	"github.com/rs/zerolog"
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
	flushMu    sync.Mutex
	stopped    bool
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
	defer tm.mu.Unlock()
	if tm.stopped {
		return
	}
	key := telemetryKey{AccountID: accountID, MediaID: mediaID, EpisodeNumber: episodeNumber}
	tm.buffer[key] = telemetryEntry{
		AccountID:     accountID,
		MediaID:       mediaID,
		EpisodeNumber: episodeNumber,
		CurrentTime:   currentTime,
		Duration:      duration,
	}

	// Update continuity file cache simultaneously for instant sync across endpoints
	// Keep both mirrors in the same arrival order and let Stop wait for this write.
	if tm.manager != nil {
		_ = tm.manager.UpdateWatchHistoryItem(&UpdateWatchHistoryItemOptions{
			CurrentTime:   currentTime,
			Duration:      duration,
			MediaID:       mediaID,
			EpisodeNumber: episodeNumber,
			Kind:          MediastreamKind,
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
	// A retry of an older batch must never commit after a newer flush.
	tm.flushMu.Lock()
	defer tm.flushMu.Unlock()
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
	}

	if len(records) > 0 {
		if err := tm.repository.UpsertBatch(records); err != nil {
			// UpsertBatch is transactional. Retain the failed batch for the next
			// tick, but never overwrite a newer beat received during database I/O.
			tm.mu.Lock()
			for key, entry := range localBatch {
				if _, newer := tm.buffer[key]; !newer {
					tm.buffer[key] = entry
				}
			}
			tm.mu.Unlock()
			tm.logger.Error().Err(err).Int("batchSize", len(records)).Msg("telemetry: Async DB Flush failed")
		} else {
			tm.logger.Trace().Int("batchSize", len(records)).Msg("telemetry: Flushed bulk tick to disk successfully")
		}
	}
}

// Stop initiates a graceful shutdown and blocks until the final synchronous flush is performed.
func (tm *TelemetryManager) Stop() {
	tm.stopOnce.Do(func() {
		// Finish accepted updates before the final flush and reject late producers.
		tm.mu.Lock()
		tm.stopped = true
		tm.mu.Unlock()
		if tm.ticker != nil {
			tm.ticker.Stop()
		}
		// Signal background worker to do final flush and wait for completion
		close(tm.quit)
		tm.wg.Wait()
	})
}
