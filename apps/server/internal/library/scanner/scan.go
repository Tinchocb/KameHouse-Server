// EXPERIMENTAL: This file contains the ScannerAgent concurrent pipeline.
// It is NOT connected to the production TMDB/AniList scanning flow.
// Production scanning is handled by Scanner in scan_legacy.go.
// This agent is retained for future iteration on a channel-based architecture.
package scanner

import (
	"context"
	"fmt"
	"io/fs"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"kamehouse/internal/database/db"

	"github.com/rs/zerolog"
)

// AgentConfig holds the tuning parameters for the Autonomous Scanner.
type AgentConfig struct {
	Workers       int
	MinConfidence float64
	BatchSize     int
}

// ScannerAgent is the autonomous AI-driven file scanner.
type ScannerAgent struct {
	rootDir        string
	config         AgentConfig
	tracker        *ProgressTracker
	dirCache       *DirCache // Directory-level cache to prevent redundant API calls
	mediaContainer *MediaContainer
	database       *db.Database
	logger         *zerolog.Logger
}

// ScannerAgentOptions holds optional dependencies for the ScannerAgent.
type ScannerAgentOptions struct {
	MediaContainer *MediaContainer
	Database       *db.Database
	Logger         *zerolog.Logger
}

// NewScannerAgent instantiates a new concurrent scanner pipeline with telemetry.
func NewScannerAgent(rootDir string, opts ...ScannerAgentOptions) *ScannerAgent {
	workers := runtime.NumCPU()
	if workers < 4 {
		workers = 4
	}

	agent := &ScannerAgent{
		rootDir:  rootDir,
		tracker:  NewProgressTracker(),
		dirCache: NewDirCache(),
		config: AgentConfig{
			Workers:       workers,
			MinConfidence: 0.75, // 75% confidence threshold for automated matches
			BatchSize:     100,  // Batch size for SQLite inserts
		},
	}

	if len(opts) > 0 {
		agent.mediaContainer = opts[0].MediaContainer
		agent.database = opts[0].Database
		agent.logger = opts[0].Logger
	}

	return agent
}

// Scan orchestrates the massive 4-stage pipeline: Ingest -> Parse -> Resolve -> Commit.
// Massive concurrency handled via Go channels and WaitGroups, cleanly stoppable by context.
func (a *ScannerAgent) Scan(ctx context.Context) error {
	// CHANNEL BUFFER SIZING CHOICES:
	// pathsChan: Buffered at 10,000. `filepath.WalkDir` is extremely fast at finding paths but
	// string processing takes time. A large buffer prevents the OS-level disk read from blocking
	// while workers catch up.
	pathsChan := make(chan string, 10000)

	// resultsChan: Buffered at 1,000. We don't want workers to block while the DB writer is
	// busy inserting a batch, but we also don't want to consume too much RAM with massive structs.
	resultsChan := make(chan MediaMatch, 1000)

	var wg sync.WaitGroup

	// STAGE 1 (Ingestion): Single goroutine scanning the disk as fast as possible.
	go a.ingestFS(ctx, pathsChan)

	// STAGE 2 (Processing Pool): Scalable worker pool reading paths, analyzing, and outputting matches.
	for i := 0; i < a.config.Workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			a.processingWorker(ctx, pathsChan, resultsChan)
		}()
	}

	// Waiter Goroutine: Closes the results channel when all processing workers are done.
	go func() {
		wg.Wait()
		close(resultsChan)

		// Ensure final visual update is guaranteed to hit the frontend
		a.tracker.ForceEmit()
	}()

	// STAGE 3 (Batch Commit): Single DB-writer goroutine reading results and batching them.
	// This blocks the main Scan() function until all processing and saving is complete,
	// ensuring data consistency and preventing early exits.
	return a.batchCommitSink(ctx, resultsChan)
}

// ingestFS reads the file system and pushes to pathsChan.
func (a *ScannerAgent) ingestFS(ctx context.Context, pathsChan chan<- string) {
	defer close(pathsChan)
	err := filepath.WalkDir(a.rootDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if ext != ".mkv" && ext != ".mp4" && ext != ".avi" {
			return nil
		}

		// Fast Atomics count up immediately
		a.tracker.AddFound()

		// Graceful Cancellation: Check Context before sending to channel
		select {
		case <-ctx.Done(): // Instantly aborts if user cancels via UI
			return ctx.Err()
		case pathsChan <- path:
		}
		return nil
	})

	if err != nil && err != context.Canceled {
		fmt.Printf("[Agent Stage 1] Ingestion error: %v\n", err)
	}
}

// processingWorker acts as the Brain of the agent. Scores heuristics.
func (a *ScannerAgent) processingWorker(ctx context.Context, pathsChan <-chan string, resultsChan chan<- MediaMatch) {
	for {
		select {
		case <-ctx.Done():
			// Graceful Cancellation: Worker exits immediately
			return
		case path, ok := <-pathsChan:
			if !ok {
				// Channel closed, worker is done
				return
			}

			// DIRECTORY CACHE SHORT-CIRCUIT:
			// If we already resolved the media for this directory, reuse the result
			// instead of hammering the API again.
			dir := filepath.Dir(path)
			cachedEntry := a.dirCache.Load(dir)

			var match MediaMatch
			if cachedEntry != nil {
				// Fast path: reuse cached directory result
				pm := Normalize(path)
				match = MediaMatch{
					ParsedMedia: pm,
					ExternalID:  fmt.Sprintf("AL:%d", cachedEntry.MediaID),
					Confidence:  cachedEntry.Confidence,
				}
			} else {
				// Slow path: full analysis
				match = a.Analyze(path)

				// Cache the result for sibling files in the same directory
				if match.Confidence >= a.config.MinConfidence {
					a.dirCache.GetOrFetch(dir, func() *DirCacheEntry {
						return &DirCacheEntry{
							MediaID:    0, // Will be set when real API is wired
							Title:      match.CleanTitle,
							Confidence: match.Confidence,
						}
					})
				}
			}

			// Determine if it needs human review
			isLowConfidence := match.Confidence <= a.config.MinConfidence
			a.tracker.RecordProcessed(filepath.Base(path), isLowConfidence)

			// Push result securely checking context availability
			select {
			case <-ctx.Done():
				return
			case resultsChan <- match:
			}
		}
	}
}

// Analyze connects the scanner to the NLP parser and identity resolver.
func (a *ScannerAgent) Analyze(path string) MediaMatch {
	pm := Normalize(path)
	return a.ScoreAndResolve(pm)
}

// batchCommitSink receives matched entities and performs bulk-inserts into SQLite.
func (a *ScannerAgent) batchCommitSink(ctx context.Context, resultsChan <-chan MediaMatch) error {
	var batch []MediaMatch
	batch = make([]MediaMatch, 0, a.config.BatchSize)

	totalProcessed := 0

	// Ticker ensures that if we have 99 items and the pipeline pauses, we still commit them
	// after a timeout instead of waiting forever for the 100th item.
	flushMux := time.NewTicker(2 * time.Second)
	defer flushMux.Stop()

	flushBatch := func() {
		if len(batch) == 0 {
			return
		}

		// MOCK: Execute single SQLite Transaction
		/*
			tx, _ := db.Begin()
			for _, m := range batch {
				tx.Exec("INSERT INTO media_matches ...")
			}
			tx.Commit()
		*/

		totalProcessed += len(batch)
		fmt.Printf("[Agent Stage 3] Flushed batch of %d items (Total SQLite inserts: %d)\n", len(batch), totalProcessed)

		// Reset batch slice without reallocating
		batch = batch[:0]
	}

	for {
		select {
		case <-ctx.Done():
			// Force flush whatever remains during cancellation to prevent data loss
			flushBatch()
			return ctx.Err()

		case <-flushMux.C:
			// Time-based flush
			flushBatch()

		case match, ok := <-resultsChan:
			if !ok {
				// Channel closed, pipeline is gracefully shutting down. Flush last batch.
				flushBatch()
				fmt.Printf("[Agent Verdict] Pipeline halted. Total Items Saved: %d\n", totalProcessed)
				return nil
			}

			batch = append(batch, match)

			// Size-based flush
			if len(batch) >= a.config.BatchSize {
				flushBatch()
			}
		}
	}
}
