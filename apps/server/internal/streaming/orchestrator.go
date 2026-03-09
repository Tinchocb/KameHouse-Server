package streaming

import (
	"context"
	"errors"
	"time"

	"golang.org/x/sync/errgroup"
)

const (
	// MaxTranscodeSessions caps simultaneous FFmpeg processes to prevent CPU saturation.
	MaxTranscodeSessions = 4
	// DefaultReqBufferSize is the actor channel buffer for handling traffic spikes.
	defaultReqBufferSize = 100
)

// LocalResolver interface for extremely fast local file resolution.
type LocalResolver interface {
	ResolveLocal(ctx context.Context, req StreamRequest) (*StreamResult, error)
}

// RemoteResolver interface for external addon scraping (e.g. Torrentio).
type RemoteResolver interface {
	Name() string
	ResolveRemote(ctx context.Context, req StreamRequest) ([]*StreamResult, error)
}

type streamReqMsg struct {
	ctx      context.Context
	req      StreamRequest
	resultCh chan<- resolveResponse
}

type resolveResponse struct {
	result *StreamResult
	err    error
}

// StreamResolutionService is the unified service interface.
type StreamResolutionService interface {
	Resolve(ctx context.Context, req StreamRequest) (*StreamResult, error)
}

// HybridPlaybackOrchestrator implements StreamResolutionService using an Actor Model.
// It achieves Stremio/Torrentio-like zero-latency UX by wrapping local and remote resolvers
// over channels, with a semaphore cap on concurrent transcode sessions.
type HybridPlaybackOrchestrator struct {
	localResolver   LocalResolver
	remoteResolvers map[string]RemoteResolver
	circuitBreakers map[string]*CircuitBreaker
	// localCircuitBreaker guards the local resolver path independently from remote ones.
	localCircuitBreaker *CircuitBreaker
	// transcodeSem is a channel-based semaphore capping concurrent FFmpeg sessions.
	// Injected to keep the orchestrator fully testable.
	transcodeSem chan struct{}

	reqCh chan streamReqMsg
	quit  chan struct{}
}

// NewHybridPlaybackOrchestrator initializes the orchestrator with a default concurrency cap.
func NewHybridPlaybackOrchestrator(local LocalResolver, remotes []RemoteResolver) *HybridPlaybackOrchestrator {
	return newOrchestrator(local, remotes, MaxTranscodeSessions)
}

// newOrchestrator is the internal constructor, exposed for tests to inject a custom semaphore size.
func newOrchestrator(local LocalResolver, remotes []RemoteResolver, maxTranscode int) *HybridPlaybackOrchestrator {
	sem := make(chan struct{}, maxTranscode)
	// Pre-fill so each acquire is a receive (release is a send back).
	for i := 0; i < maxTranscode; i++ {
		sem <- struct{}{}
	}

	h := &HybridPlaybackOrchestrator{
		localResolver:       local,
		remoteResolvers:     make(map[string]RemoteResolver),
		circuitBreakers:     make(map[string]*CircuitBreaker),
		localCircuitBreaker: NewCircuitBreaker(DefaultCircuitBreakerConfig),
		transcodeSem:        sem,
		reqCh:               make(chan streamReqMsg, defaultReqBufferSize),
		quit:                make(chan struct{}),
	}

	for _, r := range remotes {
		name := r.Name()
		h.remoteResolvers[name] = r
		h.circuitBreakers[name] = NewCircuitBreaker(DefaultCircuitBreakerConfig)
	}

	go h.loop()
	return h
}

// loop is the actor loop — sequentially dispatches concurrent per-request workers.
func (h *HybridPlaybackOrchestrator) loop() {
	for {
		select {
		case <-h.quit:
			return
		case msg := <-h.reqCh:
			go h.handleRequest(msg)
		}
	}
}

// Stop gracefully terminates the orchestrator loop.
func (h *HybridPlaybackOrchestrator) Stop() {
	close(h.quit)
}

// handleRequest processes a single stream resolution request.
func (h *HybridPlaybackOrchestrator) handleRequest(msg streamReqMsg) {
	// ── 1. Local Fast Path ────────────────────────────────────────────────────
	// Query circuit breaker before touching the local resolver to bail immediately
	// if repeated local failures have tripped the breaker.
	if h.localResolver != nil {
		res, err := h.localCircuitBreaker.Execute(msg.ctx, func(c context.Context) ([]*StreamResult, error) {
			r, e := h.localResolver.ResolveLocal(c, msg.req)
			if e != nil {
				return nil, e
			}
			return []*StreamResult{r}, nil
		})
		if err == nil && len(res) > 0 && res[0] != nil {
			msg.resultCh <- resolveResponse{result: res[0]}
			return
		}

		// ── 1b. Circuit is open for local resolver — skip the transcode fallback.
		if errors.Is(err, ErrCircuitOpen) {
			msg.resultCh <- resolveResponse{err: ErrMediaNotFound}
			return
		}

		// ── 1c. Local resolver returned a real result but likely needs transcoding.
		// Non-blocking semaphore acquire: if all slots taken, fail fast.
		select {
		case <-h.transcodeSem:
			// Acquired a slot — release it on handler exit.
			defer func() { h.transcodeSem <- struct{}{} }()
		default:
			// All transcode slots occupied — reject immediately.
			msg.resultCh <- resolveResponse{err: ErrServerSaturated}
			return
		}
	}

	// ── 2. Remote Slow Path ───────────────────────────────────────────────────
	remoteCtx, cancel := context.WithTimeout(msg.ctx, 8*time.Second)
	defer cancel()

	g, ctx := errgroup.WithContext(remoteCtx)
	resultsCh := make(chan *StreamResult, len(h.remoteResolvers)*50)

	// Scatter: query all remote resolvers concurrently, guarding each with its circuit breaker.
	for name, r := range h.remoteResolvers {
		name, resolver := name, r
		cb := h.circuitBreakers[name]

		g.Go(func() error {
			res, err := cb.Execute(ctx, func(c context.Context) ([]*StreamResult, error) {
				return resolver.ResolveRemote(c, msg.req)
			})
			if err != nil {
				// Gracefully absorb per-resolver errors; don't abort sibling goroutines.
				return nil
			}
			for _, streamRes := range res {
				select {
				case <-ctx.Done():
					return nil
				case resultsCh <- streamRes:
				}
			}
			return nil
		})
	}

	// Close results channel once all resolver goroutines settle.
	go func() {
		_ = g.Wait()
		close(resultsCh)
	}()

	// Gather: first valid result wins (zero-latency race pattern).
	select {
	case res, ok := <-resultsCh:
		if !ok || res == nil {
			msg.resultCh <- resolveResponse{err: ErrMediaNotFound}
			return
		}
		msg.resultCh <- resolveResponse{result: res}
	case <-remoteCtx.Done():
		msg.resultCh <- resolveResponse{err: ErrMediaNotFound}
	}
}

// Resolve pushes a resolution request into the actor queue and waits for the response.
func (h *HybridPlaybackOrchestrator) Resolve(ctx context.Context, req StreamRequest) (*StreamResult, error) {
	resultCh := make(chan resolveResponse, 1)

	select {
	case h.reqCh <- streamReqMsg{ctx: ctx, req: req, resultCh: resultCh}:
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	select {
	case res := <-resultCh:
		return res.result, res.err
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}
