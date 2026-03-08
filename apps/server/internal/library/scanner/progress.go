package scanner

import (
	"sync"
	"sync/atomic"
	"time"

	"kamehouse/internal/hook"
)

// ProgressTracker manages high-frequency streaming events to the frontend.
// It uses atomics for blindingly fast lock-free counter updates across thousands of workers
// and a mutex-guarded debounce window to prevent React UI freezing.
type ProgressTracker struct {
	TotalFilesFound atomic.Int64
	FilesProcessed  atomic.Int64

	// Mutex guarantees thread-safe writes to the shared debounce payload
	mu          sync.Mutex
	currentFile string
	needsReview []string
	lastEmit    time.Time
}

func NewProgressTracker() *ProgressTracker {
	return &ProgressTracker{
		needsReview: make([]string, 0, 1000),
		lastEmit:    time.Now(),
	}
}

// AddFound increments the top-line count of total files discovered on disk
func (p *ProgressTracker) AddFound() {
	p.TotalFilesFound.Add(1)
}

// RecordProcessed increments the processed counter and conditionally emits an event
func (p *ProgressTracker) RecordProcessed(file string, isLowConfidence bool) {
	processed := p.FilesProcessed.Add(1)

	p.mu.Lock()
	defer p.mu.Unlock()

	p.currentFile = file
	if isLowConfidence {
		p.needsReview = append(p.needsReview, file)
	}

	// DEBOUNCE LOGIC:
	// Only emit an event to the websocket if 250ms have passed OR we hit a clean 100-file interval.
	// This prevents the go routine from overwhelming the React UI renderer.
	timeSinceEmit := time.Since(p.lastEmit)
	if timeSinceEmit >= 250*time.Millisecond || processed%100 == 0 {
		p.emit()
	}
}

// ForceEmit bypasses the debouncer (used for final updates or massive errors)
func (p *ProgressTracker) ForceEmit() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.emit()
}

// emit MUST be called within a locked mutex. It dispatches the payload via the global hook manager.
func (p *ProgressTracker) emit() {
	p.lastEmit = time.Now()

	// Snapshot the needsReview array to prevent race conditions downstream
	// while avoiding massive allocations by re-using slices when possible.
	reviewSnapshot := make([]string, len(p.needsReview))
	copy(reviewSnapshot, p.needsReview)

	event := &ScanProgressEvent{
		TotalFilesFound: p.TotalFilesFound.Load(),
		FilesProcessed:  p.FilesProcessed.Load(),
		CurrentFile:     p.currentFile,
		NeedsReview:     reviewSnapshot,
	}

	// Dispatch asynchronously so the scanner pipeline isn't blocked by slow websocket clients
	go func(evt *ScanProgressEvent) {
		// Suppress trigger errors since nobody expects the scanner to handle a disconnected UI
		_ = hook.GlobalHookManager.OnScanProgress().Trigger(evt)
	}(event)
}
