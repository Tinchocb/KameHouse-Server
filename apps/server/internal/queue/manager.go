package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// JobStatus represents the lifecycle state of a job.
type JobStatus string

const (
	JobStatusPending   JobStatus = "pending"
	JobStatusRunning   JobStatus = "running"
	JobStatusCompleted JobStatus = "completed"
	JobStatusFailed    JobStatus = "failed"
	JobStatusCancelled JobStatus = "cancelled"
	// JobStatusPaused is set on running jobs when the server shuts down mid-stream.
	JobStatusPaused JobStatus = "paused"
)

// Job is the GORM-persisted model for a queue task.
// It doubles as the in-memory work unit to keep the stack flat.
type Job struct {
	ID          string            `json:"id"                  gorm:"primaryKey"`
	Type        string            `json:"type"                gorm:"not null;index"`
	Status      JobStatus         `json:"status"              gorm:"not null;index"`
	Payload     json.RawMessage   `json:"payload,omitempty"   gorm:"type:text"`
	Result      json.RawMessage   `json:"result,omitempty"    gorm:"type:text"`
	Error       string            `json:"error,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	StartedAt   *time.Time        `json:"started_at,omitempty"`
	CompletedAt *time.Time        `json:"completed_at,omitempty"`
	Retries     int               `json:"retries"`
	MaxRetries  int               `json:"max_retries"`
	Priority    int               `json:"priority"`
	MetadataRaw string            `json:"-"                   gorm:"column:metadata;type:text"`
	Metadata    map[string]string `json:"metadata,omitempty"  gorm:"-"`
}

// TableName overrides the default GORM table name.
func (Job) TableName() string { return "queue_jobs" }

// JobHandler is the function signature for processing a job.
type JobHandler func(ctx context.Context, job *Job) error

// cancelHandle wraps a per-job cancel so workers can be interrupted on shutdown.
type cancelHandle struct {
	cancel context.CancelFunc
}

// Manager is a persistent, bounded-worker-pool job queue backed by SQLite.
// It is decoupled from download logic — it only knows *when* to dispatch jobs, not *how*.
type Manager struct {
	mu sync.RWMutex

	// in-memory mirror of DB rows for sub-ms reads (ID → job pointer)
	index    map[string]*Job
	handlers map[string]JobHandler
	// per-job cancel functions for graceful shutdown interrupt
	running map[string]*cancelHandle

	logger *zerolog.Logger
	gormdb *gorm.DB

	ctx      context.Context
	cancel   context.CancelFunc
	wg       sync.WaitGroup
	workerCh chan *Job
}

// NewManager creates a new job queue manager backed by SQLite.
// gormdb: an already-opened *gorm.DB (the project's db.Database.Gorm()).
// workerCount: max concurrent active workers.
func NewManager(gormdb *gorm.DB, workerCount int, logger *zerolog.Logger) (*Manager, error) {
	if workerCount < 1 {
		workerCount = 3
	}

	// Auto-migrate so the table exists on first run with zero manual SQL.
	if err := gormdb.AutoMigrate(&Job{}); err != nil {
		return nil, fmt.Errorf("queue: failed to migrate schema: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	m := &Manager{
		index:    make(map[string]*Job),
		handlers: make(map[string]JobHandler),
		running:  make(map[string]*cancelHandle),
		logger:   logger,
		gormdb:   gormdb,
		ctx:      ctx,
		cancel:   cancel,
		// Buffered at 5× workers so enqueuers never block on a momentary burst.
		workerCh: make(chan *Job, workerCount*5),
	}

	// Start the bounded worker pool.
	for i := range workerCount {
		m.wg.Add(1)
		go m.worker(i)
	}

	logger.Info().Int("workers", workerCount).Msg("job_queue: Manager started")
	return m, nil
}

// ── Public API ────────────────────────────────────────────────────────────────

// RegisterHandler registers a handler for a specific job type.
func (m *Manager) RegisterHandler(jobType string, handler JobHandler) {
	m.mu.Lock()
	m.handlers[jobType] = handler
	m.mu.Unlock()
	m.logger.Info().Str("type", jobType).Msg("job_queue: Handler registered")
}

// Enqueue persists a new job to SQLite and dispatches it to the worker pool.
func (m *Manager) Enqueue(jobType string, payload interface{}, opts ...JobOption) (string, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("queue: failed to marshal payload: %w", err)
	}

	job := &Job{
		ID:         generateJobID(),
		Type:       jobType,
		Status:     JobStatusPending,
		Payload:    payloadBytes,
		CreatedAt:  time.Now(),
		MaxRetries: 3,
		Priority:   0,
		Metadata:   make(map[string]string),
	}
	for _, opt := range opts {
		opt(job)
	}

	if err := m.persistJob(job); err != nil {
		return "", fmt.Errorf("queue: failed to persist job: %w", err)
	}

	m.mu.Lock()
	m.index[job.ID] = job
	m.mu.Unlock()

	m.dispatch(job)
	m.logger.Info().Str("id", job.ID).Str("type", jobType).Msg("job_queue: Job enqueued")
	return job.ID, nil
}

// GetJob returns a job by ID from the in-memory mirror (sub-ms, no DB hit).
func (m *Manager) GetJob(id string) *Job {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.index[id]
}

// ListJobs returns all jobs from the in-memory mirror, optionally filtered by status.
func (m *Manager) ListJobs(status *JobStatus) []*Job {
	m.mu.RLock()
	defer m.mu.RUnlock()

	out := make([]*Job, 0, len(m.index))
	for _, j := range m.index {
		if status == nil || j.Status == *status {
			out = append(out, j)
		}
	}
	return out
}

// CancelJob marks a job as cancelled in both memory and DB.
func (m *Manager) CancelJob(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	job, ok := m.index[id]
	if !ok {
		return fmt.Errorf("queue: job %s not found", id)
	}
	if job.Status == JobStatusCompleted || job.Status == JobStatusCancelled {
		return fmt.Errorf("queue: job %s is already in terminal state %s", id, job.Status)
	}

	// Interrupt the worker if it is currently executing this job.
	if jc, running := m.running[id]; running {
		jc.cancel()
	}

	now := time.Now()
	job.Status = JobStatusCancelled
	job.CompletedAt = &now

	if err := m.updateStatus(job); err != nil {
		m.logger.Error().Str("id", id).Err(err).Msg("job_queue: Failed to persist cancel")
	}
	m.logger.Info().Str("id", id).Msg("job_queue: Job cancelled")
	return nil
}

// RestorePendingJobs loads un-finished jobs from SQLite on startup and re-queues them.
// Call this after RegisterHandler to ensure handlers are in place before dispatch.
func (m *Manager) RestorePendingJobs() {
	var jobs []*Job
	if err := m.gormdb.
		Where("status IN ?", []JobStatus{JobStatusPending, JobStatusPaused, JobStatusRunning}).
		Find(&jobs).Error; err != nil {
		m.logger.Error().Err(err).Msg("job_queue: Failed to restore pending jobs")
		return
	}

	m.mu.Lock()
	for _, j := range jobs {
		j.Status = JobStatusPending // treat paused/running as pending on restart
		m.index[j.ID] = j
	}
	m.mu.Unlock()

	// Persist the status reset and re-dispatch outside the lock.
	for _, j := range jobs {
		_ = m.updateStatus(j)
		m.dispatch(j)
	}
	m.logger.Info().Int("count", len(jobs)).Msg("job_queue: Restored jobs from DB")
}

// Shutdown stops the manager, marks running jobs as Paused, and waits for workers to drain.
func (m *Manager) Shutdown() {
	m.logger.Info().Msg("job_queue: Shutting down...")

	// Cancel the manager context — all job contexts derive from this.
	m.cancel()

	// Mark all currently-running jobs as Paused before they exit.
	m.mu.Lock()
	for id, j := range m.index {
		if j.Status == JobStatusRunning {
			j.Status = JobStatusPaused
			_ = m.updateStatus(j)
			m.logger.Debug().Str("id", id).Msg("job_queue: Job paused for graceful shutdown")
		}
	}
	m.mu.Unlock()

	close(m.workerCh)
	m.wg.Wait()
	m.logger.Info().Msg("job_queue: Shutdown complete")
}

// Purge removes terminal jobs older than the given duration from both memory and DB.
func (m *Manager) Purge(olderThan time.Duration) int {
	cutoff := time.Now().Add(-olderThan)

	m.mu.Lock()
	defer m.mu.Unlock()

	purged := 0
	for id, j := range m.index {
		terminal := j.Status == JobStatusCompleted || j.Status == JobStatusCancelled || j.Status == JobStatusFailed
		if terminal && j.CompletedAt != nil && j.CompletedAt.Before(cutoff) {
			delete(m.index, id)
			purged++
		}
	}

	if purged > 0 {
		m.gormdb.
			Where("status IN ? AND completed_at < ?", []JobStatus{JobStatusCompleted, JobStatusCancelled, JobStatusFailed}, cutoff).
			Delete(&Job{})
	}
	return purged
}

// ── Internal ──────────────────────────────────────────────────────────────────

// dispatch sends a job to the worker channel, logging a warning if it is full.
func (m *Manager) dispatch(job *Job) {
	select {
	case m.workerCh <- job:
	default:
		m.logger.Warn().Str("id", job.ID).Msg("job_queue: Worker channel full, job will be retried on next RestorePendingJobs cycle")
	}
}

// worker is a bounded goroutine that processes jobs from the channel.
func (m *Manager) worker(id int) {
	defer m.wg.Done()
	for {
		select {
		case <-m.ctx.Done():
			return
		case job, ok := <-m.workerCh:
			if !ok {
				return
			}
			m.processJob(job)
		}
	}
}

func (m *Manager) processJob(job *Job) {
	m.mu.RLock()
	handler, hasHandler := m.handlers[job.Type]
	m.mu.RUnlock()

	if !hasHandler {
		m.finalizeJob(job, fmt.Errorf("no handler for job type: %s", job.Type))
		return
	}

	m.mu.Lock()
	if job.Status == JobStatusCancelled {
		m.mu.Unlock()
		return
	}
	now := time.Now()
	job.Status = JobStatusRunning
	job.StartedAt = &now

	// Create a per-job cancel so Shutdown/CancelJob can interrupt this specific handler.
	jobCtx, jobCancel := context.WithCancel(m.ctx)
	m.running[job.ID] = &cancelHandle{cancel: jobCancel}
	m.mu.Unlock()

	_ = m.updateStatus(job)

	defer func() {
		jobCancel()
		m.mu.Lock()
		delete(m.running, job.ID)
		m.mu.Unlock()
	}()

	err := handler(jobCtx, job)
	m.finalizeJob(job, err)
}

func (m *Manager) finalizeJob(job *Job, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	job.CompletedAt = &now

	if err != nil {
		job.Retries++
		if job.Retries < job.MaxRetries {
			job.Status = JobStatusPending
			job.Error = fmt.Sprintf("attempt %d: %v", job.Retries, err)
			m.logger.Warn().Str("id", job.ID).Int("attempt", job.Retries).Err(err).Msg("job_queue: Job failed, scheduling retry")
			// Exponential backoff re-dispatch outside the lock.
			delay := time.Duration(job.Retries) * 5 * time.Second
			retryJob := job
			go func() {
				select {
				case <-time.After(delay):
					m.dispatch(retryJob)
				case <-m.ctx.Done():
				}
			}()
		} else {
			job.Status = JobStatusFailed
			job.Error = err.Error()
			m.logger.Error().Str("id", job.ID).Err(err).Msg("job_queue: Job permanently failed")
		}
	} else {
		job.Status = JobStatusCompleted
		m.logger.Info().
			Str("id", job.ID).
			Str("duration", now.Sub(*job.StartedAt).String()).
			Msg("job_queue: Job completed")
	}

	_ = m.updateStatus(job)
}

// persistJob inserts or updates a job row (upsert on ID conflict).
func (m *Manager) persistJob(job *Job) error {
	return m.gormdb.Clauses(clause.OnConflict{UpdateAll: true}).Create(job).Error
}

// updateStatus saves the mutable fields of a job to SQLite.
func (m *Manager) updateStatus(job *Job) error {
	return m.gormdb.Model(job).Updates(map[string]interface{}{
		"status":       job.Status,
		"error":        job.Error,
		"retries":      job.Retries,
		"result":       job.Result,
		"started_at":   job.StartedAt,
		"completed_at": job.CompletedAt,
	}).Error
}

// ── Options ───────────────────────────────────────────────────────────────────

// JobOption is a functional option for configuring a job.
type JobOption func(*Job)

// WithMaxRetries sets the maximum retry count.
func WithMaxRetries(n int) JobOption { return func(j *Job) { j.MaxRetries = n } }

// WithPriority sets the job priority (higher = more important).
func WithPriority(p int) JobOption { return func(j *Job) { j.Priority = p } }

// WithMetadata adds metadata key-value pairs to the job.
func WithMetadata(kv map[string]string) JobOption {
	return func(j *Job) {
		for k, v := range kv {
			j.Metadata[k] = v
		}
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func generateJobID() string {
	return fmt.Sprintf("job_%d", time.Now().UnixNano())
}
