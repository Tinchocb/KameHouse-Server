package queue

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/rs/zerolog"
)

// ─────────────────────────────────────────────────────────────────────
// Job Worker Adapters
// ─────────────────────────────────────────────────────────────────────
// These adapters wrap existing autodownloader and scanner operations
// as job handlers that can be registered with the queue.Manager.
//
// Usage:
//   qm := queue.NewManager(dataDir, 2, logger)
//   qm.RegisterHandler("scan_library", queue.ScanLibraryWorker(scannerFn))
//   qm.RegisterHandler("auto_download", queue.AutoDownloadWorker(adFn))

// ScanLibraryPayload is the input for a library scan job.
type ScanLibraryPayload struct {
	LibraryPath string `json:"library_path"`
	Enhanced    bool   `json:"enhanced"`
}

// ScanLibraryFunc is the signature for the actual scan implementation.
type ScanLibraryFunc func(ctx context.Context, libraryPath string, enhanced bool) error

// ScanLibraryWorker wraps a scan function as a job handler.
func ScanLibraryWorker(scanFn ScanLibraryFunc) JobHandler {
	return func(ctx context.Context, job *Job) error {
		var payload ScanLibraryPayload
		if err := json.Unmarshal(job.Payload, &payload); err != nil {
			return fmt.Errorf("invalid scan payload: %w", err)
		}
		return scanFn(ctx, payload.LibraryPath, payload.Enhanced)
	}
}

// AutoDownloadPayload is the input for an auto-download check job.
type AutoDownloadPayload struct {
	RuleIDs []uint `json:"rule_ids,omitempty"` // empty = run all rules
}

// AutoDownloadFunc is the signature for the actual auto-download implementation.
type AutoDownloadFunc func(ctx context.Context, ruleIDs []uint) error

// AutoDownloadWorker wraps an auto-download function as a job handler.
func AutoDownloadWorker(adFn AutoDownloadFunc) JobHandler {
	return func(ctx context.Context, job *Job) error {
		var payload AutoDownloadPayload
		if err := json.Unmarshal(job.Payload, &payload); err != nil {
			return fmt.Errorf("invalid auto-download payload: %w", err)
		}
		return adFn(ctx, payload.RuleIDs)
	}
}

// MetadataRefreshPayload is the input for a metadata refresh job.
type MetadataRefreshPayload struct {
	MediaIDs []int `json:"media_ids,omitempty"` // empty = refresh all
}

// MetadataRefreshFunc is the signature for the actual metadata refresh.
type MetadataRefreshFunc func(ctx context.Context, mediaIDs []int) error

// MetadataRefreshWorker wraps a metadata refresh function as a job handler.
func MetadataRefreshWorker(refreshFn MetadataRefreshFunc) JobHandler {
	return func(ctx context.Context, job *Job) error {
		var payload MetadataRefreshPayload
		if err := json.Unmarshal(job.Payload, &payload); err != nil {
			return fmt.Errorf("invalid metadata refresh payload: %w", err)
		}
		return refreshFn(ctx, payload.MediaIDs)
	}
}

// RegisterDefaultWorkers registers all standard job types on the manager.
// scanFn, adFn, and refreshFn should be nil-safe (the handler will error
// if called with a nil function, but registration still succeeds).
func RegisterDefaultWorkers(m *Manager, scanFn ScanLibraryFunc, adFn AutoDownloadFunc, refreshFn MetadataRefreshFunc, logger *zerolog.Logger) {
	if scanFn != nil {
		m.RegisterHandler("scan_library", ScanLibraryWorker(scanFn))
	}
	if adFn != nil {
		m.RegisterHandler("auto_download", AutoDownloadWorker(adFn))
	}
	if refreshFn != nil {
		m.RegisterHandler("metadata_refresh", MetadataRefreshWorker(refreshFn))
	}
	logger.Info().Msg("job_queue: Default workers registered")
}
