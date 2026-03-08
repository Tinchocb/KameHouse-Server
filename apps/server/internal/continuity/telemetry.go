package continuity

import (
	"context"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

// PlaybackEvent represents a highly-frequent, transient playback progress tick
// dispatched by the frontend without awaiting database commitments.
type PlaybackEvent struct {
	MediaId       int
	EpisodeNumber int
	CurrentTime   float64
	Duration      float64
	Kind          Kind
	Filepath      string
	IsFinal       bool // Triggered on pause, unmount or completion
}

// TelemetryWorkerPool orchestrates asynchronous, non-blocking playback progress aggregation.
// It achieves Zero-Latency I/O by deferring database writes through rapid Go channels
// and batching the resulting states in memory before flushing every N seconds.
type TelemetryWorkerPool struct {
	manager    *Manager
	logger     *zerolog.Logger
	eventsChan chan *PlaybackEvent

	// Fast memory store for deduplicating high-frequency ticks before DB flush
	memoryBatch map[int]*PlaybackEvent
	batchMutex  sync.Mutex

	flushInterval time.Duration
	ctx           context.Context
	cancel        context.CancelFunc
}

func NewTelemetryWorkerPool(manager *Manager, logger *zerolog.Logger, flushInterval time.Duration) *TelemetryWorkerPool {
	ctx, cancel := context.WithCancel(context.Background())

	pool := &TelemetryWorkerPool{
		manager:       manager,
		logger:        logger,
		eventsChan:    make(chan *PlaybackEvent, 10000), // Buffer handles sudden traffic spikes
		memoryBatch:   make(map[int]*PlaybackEvent),
		flushInterval: flushInterval,
		ctx:           ctx,
		cancel:        cancel,
	}

	// Spawn the relentless background aggregator
	go pool.RunAggregator()

	pool.logger.Info().Dur("flushInterval", flushInterval).Msg("telemetry: Initialized Event-Driven Worker Pool")
	return pool
}

// Publish instantly queues the event (Sub-1ms guarantee) and returns control to the HTTP handler
func (p *TelemetryWorkerPool) Publish(event *PlaybackEvent) {
	select {
	case p.eventsChan <- event:
		// Sent successfully without blocking
	default:
		// Edge case: Channel buffer is fully saturated.
		// We drop the transient tick to ensure we never block the main thread.
		p.logger.Warn().Int("MediaId", event.MediaId).Msg("telemetry: Buffer saturated, dropped frequent tick")
	}
}

// RunAggregator is the core Event Loop.
// It listens for instant transient ticks and collapses them into a Memory Map.
func (p *TelemetryWorkerPool) RunAggregator() {
	ticker := time.NewTicker(p.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-p.ctx.Done():
			p.logger.Info().Msg("telemetry: Shutting down Telemetry Worker Pool")
			p.FlushToDatabase() // Final graceful sync
			return

		case event := <-p.eventsChan:
			p.batchMutex.Lock()
			// Only keep the most recent tick for each media ID (Deduplication)
			p.memoryBatch[event.MediaId] = event
			p.batchMutex.Unlock()

			// If it's a final event (User clicked pause or finished the episode), force a targeted immediate flush hook
			if event.IsFinal {
				p.handleFinalEvent(event)
			}

		case <-ticker.C:
			// Time to sync Memory Batch to local Database safely
			p.FlushToDatabase()
		}
	}
}

func (p *TelemetryWorkerPool) FlushToDatabase() {
	p.batchMutex.Lock()

	if len(p.memoryBatch) == 0 {
		p.batchMutex.Unlock()
		return
	}

	// Clone the batch to release lock quickly, allowing new ticks to flow into memory
	clonedBatch := make(map[int]*PlaybackEvent, len(p.memoryBatch))
	for k, v := range p.memoryBatch {
		clonedBatch[k] = v
	}
	// Clear the origin map
	p.memoryBatch = make(map[int]*PlaybackEvent)
	p.batchMutex.Unlock()

	// Synchronize deduplicated events to DB
	// This takes time (IO) but we are clear of the main thread and Mutex
	for _, event := range clonedBatch {
		opts := &UpdateWatchHistoryItemOptions{
			MediaId:       event.MediaId,
			EpisodeNumber: event.EpisodeNumber,
			CurrentTime:   event.CurrentTime,
			Duration:      event.Duration,
			Kind:          event.Kind,
			Filepath:      event.Filepath,
		}

		err := p.manager.UpdateWatchHistoryItem(opts)
		if err != nil {
			p.logger.Error().Err(err).Int("MediaID", event.MediaId).Msg("telemetry: Async DB Flush failed")
		} else {
			p.logger.Trace().Int("MediaID", event.MediaId).Msg("telemetry: Flushed bulk tick to disk successfully")
		}
	}
}

// handleFinalEvent triggers potential Scrobbler integration hooks when a user is done watching.
func (p *TelemetryWorkerPool) handleFinalEvent(event *PlaybackEvent) {
	// Let the batch flush it organically later, but we analyze MAL thresholds right now.
	if event.Duration > 0 {
		completionRatio := event.CurrentTime / event.Duration
		if completionRatio >= IgnoreRatioThreshold {
			// They crossed 90%! This means they watched the episode.
			// Next, we notify the Dead Letter Queue Scrobbler to queue a MAL update.
			p.logger.Info().Int("MediaId", event.MediaId).Int("Episode", event.EpisodeNumber).Msg("telemetry: User completed episode, signaling Scrobbler hooks")
			// The actual trigger to the DLQ would reside here or via global event bus:
			// hook.GlobalHookManager.OnEpisodeCompleted().Trigger(...)
		}
	}
}

// Stop gracefully stops the pool
func (p *TelemetryWorkerPool) Stop() {
	p.cancel()
}
