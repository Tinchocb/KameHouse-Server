package db

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"gorm.io/gorm"
)

// SlowTraceEntry represents a single slow query log entry.
type SlowTraceEntry struct {
	Timestamp  string  `json:"timestamp"`
	Duration   string  `json:"duration"`
	DurationMs float64 `json:"duration_ms"`
	SQL        string  `json:"sql"`
	Rows       int64   `json:"rows"`
	Error      string  `json:"error,omitempty"`
}

// SlowTraceLogger records queries that exceed a configurable threshold
// to a `slow_traces.json` file for post-mortem analysis.
type SlowTraceLogger struct {
	mu        sync.Mutex
	filePath  string
	threshold time.Duration
	entries   []SlowTraceEntry
	maxBuffer int
}

// NewSlowTraceLogger creates a new slow trace logger.
// threshold: queries slower than this are logged (default 500ms).
// dataDir: the directory where slow_traces.json will be written.
func NewSlowTraceLogger(dataDir string, threshold time.Duration) *SlowTraceLogger {
	if threshold == 0 {
		threshold = 500 * time.Millisecond
	}

	return &SlowTraceLogger{
		filePath:  filepath.Join(dataDir, "slow_traces.json"),
		threshold: threshold,
		entries:   make([]SlowTraceEntry, 0, 64),
		maxBuffer: 50,
	}
}

// RegisterCallbacks installs the slow query logging callbacks on the GORM DB instance.
func (s *SlowTraceLogger) RegisterCallbacks(db *gorm.DB) {
	callbackName := "kamehouse:slow_trace"

	_ = db.Callback().Query().After("gorm:query").Register(callbackName+"_query", s.afterCallback)
	_ = db.Callback().Create().After("gorm:create").Register(callbackName+"_create", s.afterCallback)
	_ = db.Callback().Update().After("gorm:update").Register(callbackName+"_update", s.afterCallback)
	_ = db.Callback().Delete().After("gorm:delete").Register(callbackName+"_delete", s.afterCallback)
}

// afterCallback is the GORM callback that checks elapsed time and logs slow queries.
func (s *SlowTraceLogger) afterCallback(db *gorm.DB) {
	if db.Statement == nil {
		return
	}

	// GORM stores the start time in the context via its internal "gorm:started_at" key
	startTime, ok := db.Statement.Context.Value("gorm:started_at").(time.Time)
	if !ok {
		// Fallback: use DryRun elapsed if available, or skip
		return
	}

	elapsed := time.Since(startTime)
	if elapsed < s.threshold {
		return
	}

	entry := SlowTraceEntry{
		Timestamp:  time.Now().UTC().Format(time.RFC3339Nano),
		Duration:   elapsed.String(),
		DurationMs: float64(elapsed.Milliseconds()),
		SQL:        db.Statement.SQL.String(),
		Rows:       db.Statement.RowsAffected,
	}

	if db.Error != nil {
		entry.Error = db.Error.Error()
	}

	s.mu.Lock()
	s.entries = append(s.entries, entry)

	// Flush to disk when buffer is full
	if len(s.entries) >= s.maxBuffer {
		s.flushLocked()
	}
	s.mu.Unlock()
}

// Flush writes all buffered entries to slow_traces.json.
func (s *SlowTraceLogger) Flush() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.flushLocked()
}

// flushLocked writes entries to disk. Must be called with s.mu held.
func (s *SlowTraceLogger) flushLocked() {
	if len(s.entries) == 0 {
		return
	}

	// Read existing entries from file
	var existing []SlowTraceEntry
	data, err := os.ReadFile(s.filePath)
	if err == nil && len(data) > 0 {
		_ = json.Unmarshal(data, &existing)
	}

	// Append new entries
	combined := append(existing, s.entries...)

	// Keep only the most recent 500 entries to prevent unbounded growth
	const maxEntries = 500
	if len(combined) > maxEntries {
		combined = combined[len(combined)-maxEntries:]
	}

	// Write back
	output, err := json.MarshalIndent(combined, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "slow_trace_logger: failed to marshal: %v\n", err)
		return
	}

	if err := os.WriteFile(s.filePath, output, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "slow_trace_logger: failed to write: %v\n", err)
	}

	// Clear buffer
	s.entries = s.entries[:0]
}
