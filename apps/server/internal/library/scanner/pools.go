package scanner

import (
	"context"
	"runtime"
	"sync"
)

// ─── WorkerPool ───────────────────────────────────────────────────────────────

// WorkerPool is a bounded goroutine pool for CPU-heavy scan tasks.
// All tasks share the same context; once ctx is cancelled in-flight tasks are
// skipped and no new tasks are accepted.
//
// Usage:
//
//	pool := NewWorkerPool(ctx, runtime.NumCPU()*2)
//	for _, path := range paths {
//	    pool.Submit(func(ctx context.Context) { process(ctx, path) })
//	}
//	pool.Wait()
type WorkerPool struct {
	jobs chan func(context.Context)
	wg   sync.WaitGroup
	ctx  context.Context
}

// defaultWorkers returns a sensible default bounded to [4, 16].
func defaultWorkers(n int) int {
	if n <= 0 {
		n = runtime.NumCPU() * 2
	}
	if n < 4 {
		n = 4
	}
	if n > 16 {
		n = 16
	}
	return n
}

// NewWorkerPool creates a pool with `workers` goroutines and starts them immediately.
// Callers MUST call Wait() to drain the pool.
func NewWorkerPool(ctx context.Context, workers int) *WorkerPool {
	workers = defaultWorkers(workers)
	p := &WorkerPool{
		jobs: make(chan func(context.Context), workers*4), // 4× buffer reduces producer stalls
		ctx:  ctx,
	}
	for i := 0; i < workers; i++ {
		p.wg.Add(1)
		go func() {
			defer p.wg.Done()
			for task := range p.jobs {
				if ctx.Err() != nil {
					continue // drain channel on cancellation without executing
				}
				task(ctx)
			}
		}()
	}
	return p
}

// Submit enqueues a task. Blocks only if the internal buffer is full (i.e. all
// workers are saturated). If the pool context is canceled, it returns early.
func (p *WorkerPool) Submit(task func(context.Context)) {
	select {
	case <-p.ctx.Done():
		return
	case p.jobs <- task:
	}
}

// Wait closes the jobs channel and blocks until all in-flight tasks complete.
// Must be called exactly once per pool after all Submit calls are done.
func (p *WorkerPool) Wait() {
	close(p.jobs)
	p.wg.Wait()
}
