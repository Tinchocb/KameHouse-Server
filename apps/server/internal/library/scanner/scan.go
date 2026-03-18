// EXPERIMENTAL: This file contains the ScannerAgent concurrent pipeline.
// It is NOT connected to the production TMDB/Platform scanning flow.
// Production scanning is handled by Scanner in scan_legacy.go.
// This agent is retained for future iteration on a channel-based architecture.
package scanner

import (
	"context"
	"fmt"
	"io/fs"
	"path/filepath"
	"strings"
	"time"

	"kamehouse/internal/database/db"
	"kamehouse/internal/library/parser"
	"kamehouse/internal/metadata"

	"kamehouse/internal/queue"
	"github.com/rs/zerolog"
	"github.com/samber/lo"
)

// AgentConfig holds the tuning parameters for the Autonomous Scanner.
type AgentConfig struct {
	Workers       int
	MinConfidence float64
	BatchSize     int
}

// ScannerAgentOptions holds optional dependencies for the ScannerAgent.
type ScannerAgentOptions struct {
	MediaContainer *MediaContainer
	Database       *db.Database
	Logger         *zerolog.Logger
	QueueManager   *queue.Manager
}

// ScannerAgent is the autonomous AI-driven file scanner.
type ScannerAgent struct {
	rootDir        string
	config         AgentConfig
	tracker        *ProgressTracker
	dirCache       *DirCache // Directory-level cache to prevent redundant API calls
	mediaContainer *MediaContainer
	database       *db.Database
	fetcher        *metadata.Fetcher
	logger         *zerolog.Logger
	queueManager   *queue.Manager

	triggerCh chan struct{}
}

// TriggerScan initiates a scan request using a non-blocking channel send.
func (a *ScannerAgent) TriggerScan() {
	select {
	case a.triggerCh <- struct{}{}: // Trigger event in channel
	default:
		// Drop if already pending
	}
}

// StartDebouncer runs the timer/channel pattern to ensure only one full scan
// is triggered after a quiet period of 2 seconds.
func (a *ScannerAgent) StartDebouncer(ctx context.Context) {
	debounceDuration := 2 * time.Second
	var timer *time.Timer

	for {
		select {
		case <-ctx.Done():
			if timer != nil {
				timer.Stop()
			}
			return
		case <-a.triggerCh:
			if timer != nil {
				timer.Stop()
			}
			// Reset quiet period timer
			timer = time.AfterFunc(debounceDuration, func() {
				// Execute scan asynchronously so the debouncer loop is never blocked
				go func() {
					err := a.Scan(ctx)
					if err != nil && err != context.Canceled && a.logger != nil {
						a.logger.Error().Err(err).Msg("ScannerAgent: Scan pipeline failed")
					}
				}()
			})
		}
	}
}

// NewScannerAgent instantiates a new concurrent scanner pipeline with telemetry.
func NewScannerAgent(rootDir string, opts ...ScannerAgentOptions) *ScannerAgent {
	workers := defaultWorkers(0) // resolves to NumCPU*2, clamped to [4,16]

	agent := &ScannerAgent{
		rootDir:  rootDir,
		tracker:  NewProgressTracker(),
		dirCache: NewDirCache(),
		config: AgentConfig{
			Workers:       workers,
			MinConfidence: 0.75, // 75% confidence threshold for automated matches
			BatchSize:     100,  // Batch size for SQLite inserts
		},
		triggerCh: make(chan struct{}, 1),
	}

	if len(opts) > 0 {
		agent.mediaContainer = opts[0].MediaContainer
		agent.database = opts[0].Database
		agent.logger = opts[0].Logger
		agent.queueManager = opts[0].QueueManager
	}

	return agent
}

// Scan handles the fast ingestion Phase 1. It scans the disk to map files, catalogues them,
// and purely dispatches tasks via queue/manager instead of blocking the main thread.
func (a *ScannerAgent) Scan(ctx context.Context) error {
	// STAGE 1 (Ingestion): Scan disk to map all fast-paths into memory
	paths, err := a.ingestFS(ctx)
	if err != nil {
		return err
	}

	// STAGE 2: Dispatch Block Processing to Queue Manager
	// Instead of blocking horizontally for metadata/matching, just send pure events to queue.
	if a.queueManager != nil {
		a.logger.Info().Int("count", len(paths)).Msg("ScannerAgent: Dispatching paths to async queue...")
		batches := lo.Chunk(paths, a.config.BatchSize)
		for _, batch := range batches {
			// Enqueue each batch to be picked up by the 'library.match' consumer.
			_, err := a.queueManager.Enqueue("library.match", map[string]interface{}{
				"paths": batch,
			})
			if err != nil {
				a.logger.Error().Err(err).Msg("ScannerAgent: Failed to enqueue batch")
			}
		}
	} else {
		// Fallback for isolated testing instances if no QueueManager exists.
		a.logger.Warn().Msg("ScannerAgent: QueueManager is nil, skipping matching dispatch.")
	}

	// Ensure final visual update is guaranteed to hit the frontend
	a.tracker.ForceEmit()
	return nil
}

// ingestFS reads the file system and returns a pre-allocated slice of valid paths.
func (a *ScannerAgent) ingestFS(ctx context.Context) ([]string, error) {
	var paths []string
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

		select {
		case <-ctx.Done(): // Instantly aborts if user cancels via UI
			return ctx.Err()
		default:
			paths = append(paths, path)
		}
		return nil
	})

	if err != nil && err != context.Canceled && a.logger != nil {
		a.logger.Error().Err(err).Msg("ScannerAgent: Ingestion error")
	}
	return paths, err
}

// processPath acts as the Brain of the agent. Scores heuristics for a single file.
func (a *ScannerAgent) processPath(ctx context.Context, path string) MediaMatch {
	// Graceful check prior to heavy calc
	if ctx.Err() != nil {
		return MediaMatch{}
	}

	dir := filepath.Dir(path)
	cachedEntry := a.dirCache.Load(dir)

	var match MediaMatch
	if cachedEntry != nil {
		// Fast path: reuse cached directory result
		pm := Normalize(path)
		
		// Run regex parser for Episode/Resolution extraction
		parsed := parser.Parse(path)
		
		match = MediaMatch{
			ParsedMedia: pm,
			CleanTitle:  parsed.Title,
			ExternalID:  fmt.Sprintf("TMDB:%d", cachedEntry.MediaID),
			Confidence:  cachedEntry.Confidence,
		}
	} else {
		// Slow path: full analysis
		match = a.Analyze(path)
		
		// Run regex parser
		parsed := parser.Parse(path)
		
		// Use fetcher to get proper TMDB metadata and cache it
		if parsed.Title != "" {
			meta, _ := a.fetcher.Search(parsed.Title)
			if meta.Title != "" {
				// We attach the resolved title overriding the raw filename scrape
				match.CleanTitle = meta.Title 
			match.Synopsis = meta.Synopsis
			match.PosterURL = meta.PosterURL
			} else {
				match.CleanTitle = parsed.Title
			}
		}

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

	return match
}

// Analyze connects the scanner to the NLP parser and identity resolver.
func (a *ScannerAgent) Analyze(path string) MediaMatch {
	pm := Normalize(path)
	return a.ScoreAndResolve(pm, path)
}
