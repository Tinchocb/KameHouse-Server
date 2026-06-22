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
// Uses before/after pairs with InstanceSet/InstanceGet to reliably measure elapsed time,
// since GORM v2 stores its internal timing with a private context key type that cannot
// be read via a plain string key.
func (s *SlowTraceLogger) RegisterCallbacks(db *gorm.DB) {
	const startKey = "kamehouse:start_at"
	const key = "kamehouse:slow_trace"

	before := func(db *gorm.DB) {
		db.InstanceSet(startKey, time.Now())
	}
	after := s.makeAfterCallback(startKey)

	_ = db.Callback().Query().Before("gorm:query").Register(key+"_before_query", before)
	_ = db.Callback().Query().After("gorm:query").Register(key+"_after_query", after)
	_ = db.Callback().Create().Before("gorm:create").Register(key+"_before_create", before)
	_ = db.Callback().Create().After("gorm:create").Register(key+"_after_create", after)
	_ = db.Callback().Update().Before("gorm:update").Register(key+"_before_update", before)
	_ = db.Callback().Update().After("gorm:update").Register(key+"_after_update", after)
	_ = db.Callback().Delete().Before("gorm:delete").Register(key+"_before_delete", before)
	_ = db.Callback().Delete().After("gorm:delete").Register(key+"_after_delete", after)
}

// makeAfterCallback returns a GORM after-callback that reads the start time stored by
// the paired before-callback via InstanceSet/InstanceGet.
func (s *SlowTraceLogger) makeAfterCallback(startKey string) func(*gorm.DB) {
	return func(db *gorm.DB) {
		if db.Statement == nil {
			return
		}

		startVal, ok := db.InstanceGet(startKey)
		if !ok {
			return
		}
		startTime, ok := startVal.(time.Time)
		if !ok {
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
