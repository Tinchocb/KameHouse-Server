package mediastream

import (
	"context"
	"sync"
)

type repositoryBackground struct {
	mu      sync.Mutex
	ctx     context.Context
	cancel  context.CancelFunc
	closed  bool
	workers sync.WaitGroup
}

func (r *Repository) workContext() context.Context {
	s := &r.background
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.contextLocked()
}

func (s *repositoryBackground) contextLocked() context.Context {
	if s.ctx == nil {
		s.ctx, s.cancel = context.WithCancel(context.Background())
		if s.closed {
			s.cancel()
		}
	}
	return s.ctx
}

func (r *Repository) startWork(work func(context.Context)) bool {
	s := &r.background
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return false
	}
	ctx := s.contextLocked()
	s.workers.Add(1)
	go func() { defer s.workers.Done(); work(ctx) }()
	return true
}

func (r *Repository) stopWork() {
	s := &r.background
	s.mu.Lock()
	s.closed = true
	cancel := s.cancel
	s.mu.Unlock()
	// Close admission first. Registry shutdown uses a separate lock order and
	// must not run while holding the background mutex (openers admit under it).
	r.shutdownDriveWindows()
	if cancel != nil {
		cancel()
	}
	s.workers.Wait()
}
