package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

// JobStatus represents the lifecycle state of a job.
type JobStatus string

const (
	JobStatusPending   JobStatus = "pending"
	JobStatusRunning   JobStatus = "running"
	JobStatusCompleted JobStatus = "completed"
	JobStatusFailed    JobStatus = "failed"
	JobStatusCancelled JobStatus = "cancelled"
)

// Job represents a unit of work in the persistent job queue.
type Job struct {
	ID          string            `json:"id"`
	Type        string            `json:"type"`
	Status      JobStatus         `json:"status"`
	Payload     json.RawMessage   `json:"payload,omitempty"`
	Result      json.RawMessage   `json:"result,omitempty"`
	Error       string            `json:"error,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	StartedAt   *time.Time        `json:"started_at,omitempty"`
	CompletedAt *time.Time        `json:"completed_at,omitempty"`
	Retries     int               `json:"retries"`
	MaxRetries  int               `json:"max_retries"`
	Priority    int               `json:"priority"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// JobHandler is the function signature for processing a job.
type JobHandler func(ctx context.Context, job *Job) error

// Manager is a persistent, pause/resume capable job queue.
// Jobs are persisted to a JSON file so they survive server restarts.
type Manager struct {
	mu       sync.Mutex
	jobs     []*Job
	handlers map[string]JobHandler
	logger   *zerolog.Logger
	filePath string

	ctx       context.Context
	cancel    context.CancelFunc
	wg        sync.WaitGroup
	workerCh  chan *Job
	isRunning bool
}

// NewManager creates a new job queue manager.
// dataDir: directory for the persistent jobs.json file.
// workerCount: number of concurrent worker goroutines.
func NewManager(dataDir string, workerCount int, logger *zerolog.Logger) *Manager {
	if workerCount < 1 {
		workerCount = 2
	}

	ctx, cancel := context.WithCancel(context.Background())

	m := &Manager{
		jobs:     make([]*Job, 0),
		handlers: make(map[string]JobHandler),
		logger:   logger,
		filePath: filepath.Join(dataDir, "jobs.json"),
		ctx:      ctx,
		cancel:   cancel,
		workerCh: make(chan *Job, 100),
	}

	// Load persisted jobs
	m.loadFromDisk()

	// Start workers
	for i := 0; i < workerCount; i++ {
		m.wg.Add(1)
		go m.worker(i)
	}
	m.isRunning = true

	// Re-enqueue any jobs that were running when the server last shut down
	m.recoverInterruptedJobs()

	logger.Info().Int("workers", workerCount).Msg("job_queue: Manager started")

	return m
}

// RegisterHandler registers a handler for a specific job type.
func (m *Manager) RegisterHandler(jobType string, handler JobHandler) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.handlers[jobType] = handler
	m.logger.Info().Str("type", jobType).Msg("job_queue: Handler registered")
}

// Enqueue adds a new job to the queue.
func (m *Manager) Enqueue(jobType string, payload interface{}, opts ...JobOption) (string, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payload: %w", err)
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

	m.mu.Lock()
	m.jobs = append(m.jobs, job)
	m.saveToDiskLocked()
	m.mu.Unlock()

	// Dispatch to workers
	select {
	case m.workerCh <- job:
	default:
		m.logger.Warn().Str("id", job.ID).Msg("job_queue: Worker channel full, job will be picked up later")
	}

	m.logger.Info().Str("id", job.ID).Str("type", jobType).Msg("job_queue: Job enqueued")
	return job.ID, nil
}

// GetJob returns a job by its ID.
func (m *Manager) GetJob(id string) *Job {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, j := range m.jobs {
		if j.ID == id {
			return j
		}
	}
	return nil
}

// ListJobs returns all jobs, optionally filtered by status.
func (m *Manager) ListJobs(status *JobStatus) []*Job {
	m.mu.Lock()
	defer m.mu.Unlock()

	if status == nil {
		result := make([]*Job, len(m.jobs))
		copy(result, m.jobs)
		return result
	}

	var filtered []*Job
	for _, j := range m.jobs {
		if j.Status == *status {
			filtered = append(filtered, j)
		}
	}
	return filtered
}

// CancelJob attempts to cancel a pending or running job.
func (m *Manager) CancelJob(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, j := range m.jobs {
		if j.ID == id {
			if j.Status == JobStatusCompleted || j.Status == JobStatusCancelled {
				return fmt.Errorf("job %s already in terminal state: %s", id, j.Status)
			}
			j.Status = JobStatusCancelled
			now := time.Now()
			j.CompletedAt = &now
			m.saveToDiskLocked()
			m.logger.Info().Str("id", id).Msg("job_queue: Job cancelled")
			return nil
		}
	}
	return fmt.Errorf("job %s not found", id)
}

// Shutdown gracefully stops the job queue, waiting for in-progress jobs.
func (m *Manager) Shutdown() {
	m.logger.Info().Msg("job_queue: Shutting down...")
	m.cancel()
	close(m.workerCh)
	m.wg.Wait()
	m.mu.Lock()
	m.saveToDiskLocked()
	m.isRunning = false
	m.mu.Unlock()
	m.logger.Info().Msg("job_queue: Shutdown complete")
}

// Purge removes completed and cancelled jobs older than the given duration.
func (m *Manager) Purge(olderThan time.Duration) int {
	m.mu.Lock()
	defer m.mu.Unlock()

	cutoff := time.Now().Add(-olderThan)
	var kept []*Job
	purged := 0

	for _, j := range m.jobs {
		if (j.Status == JobStatusCompleted || j.Status == JobStatusCancelled || j.Status == JobStatusFailed) &&
			j.CompletedAt != nil && j.CompletedAt.Before(cutoff) {
			purged++
			continue
		}
		kept = append(kept, j)
	}

	m.jobs = kept
	m.saveToDiskLocked()
	return purged
}

// ──────────────────────────────────────────────────────────────────────
// Internal
// ──────────────────────────────────────────────────────────────────────

func (m *Manager) worker(id int) {
	defer m.wg.Done()

	for job := range m.workerCh {
		// Check if cancelled
		if m.ctx.Err() != nil {
			return
		}

		m.processJob(job)
	}
}

func (m *Manager) processJob(job *Job) {
	m.mu.Lock()
	handler, ok := m.handlers[job.Type]
	if !ok {
		job.Status = JobStatusFailed
		job.Error = fmt.Sprintf("no handler registered for job type: %s", job.Type)
		m.saveToDiskLocked()
		m.mu.Unlock()
		return
	}

	if job.Status == JobStatusCancelled {
		m.mu.Unlock()
		return
	}

	job.Status = JobStatusRunning
	now := time.Now()
	job.StartedAt = &now
	m.saveToDiskLocked()
	m.mu.Unlock()

	// Execute with timeout context
	jobCtx, jobCancel := context.WithTimeout(m.ctx, 30*time.Minute)
	defer jobCancel()

	err := handler(jobCtx, job)

	m.mu.Lock()
	defer m.mu.Unlock()

	completedAt := time.Now()
	job.CompletedAt = &completedAt

	if err != nil {
		job.Retries++
		if job.Retries < job.MaxRetries {
			job.Status = JobStatusPending
			job.Error = fmt.Sprintf("attempt %d failed: %v", job.Retries, err)
			m.logger.Warn().Str("id", job.ID).Int("attempt", job.Retries).Err(err).Msg("job_queue: Job failed, will retry")

			// Re-enqueue for retry
			go func() {
				time.Sleep(time.Duration(job.Retries) * 5 * time.Second) // Exponential-ish backoff
				select {
				case m.workerCh <- job:
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
		m.logger.Info().Str("id", job.ID).Str("duration", completedAt.Sub(*job.StartedAt).String()).Msg("job_queue: Job completed")
	}

	m.saveToDiskLocked()
}

func (m *Manager) recoverInterruptedJobs() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, j := range m.jobs {
		if j.Status == JobStatusRunning || j.Status == JobStatusPending {
			j.Status = JobStatusPending
			go func(job *Job) {
				select {
				case m.workerCh <- job:
				case <-m.ctx.Done():
				}
			}(j)
		}
	}
}

func (m *Manager) loadFromDisk() {
	data, err := os.ReadFile(m.filePath)
	if err != nil {
		if !os.IsNotExist(err) {
			m.logger.Error().Err(err).Msg("job_queue: Failed to load jobs from disk")
		}
		return
	}

	if err := json.Unmarshal(data, &m.jobs); err != nil {
		m.logger.Error().Err(err).Msg("job_queue: Failed to parse jobs file")
	}
}

func (m *Manager) saveToDiskLocked() {
	data, err := json.MarshalIndent(m.jobs, "", "  ")
	if err != nil {
		m.logger.Error().Err(err).Msg("job_queue: Failed to marshal jobs")
		return
	}

	if err := os.MkdirAll(filepath.Dir(m.filePath), 0755); err != nil {
		m.logger.Error().Err(err).Msg("job_queue: Failed to create directory")
		return
	}

	if err := os.WriteFile(m.filePath, data, 0644); err != nil {
		m.logger.Error().Err(err).Msg("job_queue: Failed to save jobs to disk")
	}
}

// ──────────────────────────────────────────────────────────────────────
// Options
// ──────────────────────────────────────────────────────────────────────

// JobOption is a functional option for configuring a job.
type JobOption func(*Job)

// WithMaxRetries sets the maximum retry count.
func WithMaxRetries(n int) JobOption {
	return func(j *Job) { j.MaxRetries = n }
}

// WithPriority sets the job priority (higher = more important).
func WithPriority(p int) JobOption {
	return func(j *Job) { j.Priority = p }
}

// WithMetadata adds metadata key-value pairs to the job.
func WithMetadata(kv map[string]string) JobOption {
	return func(j *Job) {
		for k, v := range kv {
			j.Metadata[k] = v
		}
	}
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

func generateJobID() string {
	return fmt.Sprintf("job_%d", time.Now().UnixNano())
}
