package db

import (
	"sync"
	"time"

	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

// DbWriteOperation is a generic callback that will be executed inside a single global transaction.
type DbWriteOperation func(tx *gorm.DB) error

// BufferedWriter queues DB write operations and flushes them in bulk.
// This single-threaded writer prevents "database is locked" errors in SQLite WAL mode.
type BufferedWriter struct {
	db             *gorm.DB
	logger         *zerolog.Logger
	mu             sync.Mutex
	flushMu        sync.Mutex
	queue          []DbWriteOperation
	maxBatch       int
	interval       time.Duration
	stopChan       chan struct{}
	doneChan       chan struct{}
	OnError        func(error)
	isShuttingDown bool
	isClosed       bool
	once           sync.Once
}

func NewBufferedWriter(db *gorm.DB, logger *zerolog.Logger, maxBatch int, flushInterval time.Duration) *BufferedWriter {
	bw := &BufferedWriter{
		db:       db,
		logger:   logger,
		queue:    make([]DbWriteOperation, 0, maxBatch),
		maxBatch: maxBatch,
		interval: flushInterval,
		stopChan: make(chan struct{}),
		doneChan: make(chan struct{}),
	}

	go bw.committerDaemon()

	return bw
}

// Enqueue adds a write operation to the RingBuffer. It returns immediately (non-blocking).
// If the system is shutting down, it executes the operation synchronously under flushMu to prevent race with Close.
func (bw *BufferedWriter) Enqueue(op DbWriteOperation) {
	bw.mu.Lock()
	if bw.isClosed {
		bw.mu.Unlock()
		bw.logger.Warn().Msg("db/buffered_writer: Enqueue called after database writer is closed, ignoring operation")
		return
	}
	if bw.isShuttingDown {
		bw.mu.Unlock()
		bw.logger.Warn().Msg("db/buffered_writer: Enqueue called while shutting down, executing synchronously under flushMu")
		bw.flushMu.Lock()
		defer bw.flushMu.Unlock()
		bw.mu.Lock()
		if bw.isClosed {
			bw.mu.Unlock()
			return
		}
		bw.mu.Unlock()
		if err := bw.db.Transaction(op); err != nil {
			bw.logger.Error().Err(err).Msg("db/buffered_writer: Synchronous shutdown write failed")
			if bw.OnError != nil {
				bw.OnError(err)
			}
		}
		return
	}

	// Backpressure: si la cola excede 2000 elementos, ejecutar un flush forzado para evitar OOM
	if len(bw.queue) >= 2000 {
		bw.mu.Unlock()
		bw.logger.Warn().Msg("db/buffered_writer: Queue reached 2000 operations, applying backpressure flush")
		if errs := bw.Flush(); len(errs) > 0 {
			bw.logger.Error().Int("failed", len(errs)).Msg("db/buffered_writer: Backpressure flush had failures")
		}
		bw.mu.Lock()
	}

	bw.queue = append(bw.queue, op)

	// Fast flush if batch size is reached
	shouldFlush := len(bw.queue) >= bw.maxBatch
	bw.mu.Unlock()

	if shouldFlush {
		bw.Flush()
	}
}

// Flush explicitly forces all pending operations to execute immediately.
// Returns the per-operation errors (empty slice when all succeeded or no ops). The batch shares
// one transaction for speed, but a failing op no longer reports success: it is
// logged, forwarded to OnError and included in the return value.
func (bw *BufferedWriter) Flush() []error {
	bw.flushMu.Lock()
	defer bw.flushMu.Unlock()

	bw.mu.Lock()
	if len(bw.queue) == 0 {
		bw.mu.Unlock()
		return []error{}
	}

	// Take ownership of the current batch and construct a new slice for future queues
	batch := bw.queue
	bw.queue = make([]DbWriteOperation, 0, bw.maxBatch)
	bw.mu.Unlock()

	if len(batch) > 0 {
		bw.logger.Trace().Msgf("db/buffered_writer: Flushing %d db write operations", len(batch))

		var errs []error
		err := bw.db.Transaction(func(tx *gorm.DB) error {
			for _, op := range batch {
				if err := op(tx); err != nil {
					bw.logger.Error().Err(err).Msg("db/buffered_writer: Operation failed during batch flush, skipping operation")
					if bw.OnError != nil {
						bw.OnError(err)
					}
					errs = append(errs, err)
					// We continue processing the other operations even if one fails
				}
			}
			return nil
		})

		if err != nil {
			bw.logger.Error().Err(err).Msg("db/buffered_writer: Failed to commit transaction batch")
			errs = append(errs, err)
		}
		return errs
	}
	return nil
}

// committerDaemon runs in the background and flushes the queue every X milliseconds.
func (bw *BufferedWriter) committerDaemon() {
	ticker := time.NewTicker(bw.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			bw.Flush()
		case <-bw.stopChan:
			// Flush any remaining items before shutting down
			bw.Flush()
			close(bw.doneChan)
			return
		}
	}
}

// Shutdown gracefully stops the buffered writer and waits for the daemon to finish flushing.
func (bw *BufferedWriter) Shutdown() {
	bw.once.Do(func() {
		bw.mu.Lock()
		bw.isShuttingDown = true
		close(bw.stopChan)
		bw.mu.Unlock()

		// Wait for the daemon to finish its final flush with timeout
		select {
		case <-bw.doneChan:
		case <-time.After(5 * time.Second):
			bw.logger.Warn().Msg("db/buffered_writer: Shutdown timed out waiting for committer daemon")
		}

		bw.flushMu.Lock()
		bw.mu.Lock()
		bw.isClosed = true
		bw.mu.Unlock()
		bw.flushMu.Unlock()
	})
}
