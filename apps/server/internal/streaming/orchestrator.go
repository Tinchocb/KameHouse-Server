package streaming

import (
	"context"
	"time"

	"golang.org/x/sync/errgroup"
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
// It achieves Stremio/Torrentio-like zero-latency UX by wrapping local and remote resolvers over channels.
type HybridPlaybackOrchestrator struct {
	localResolver   LocalResolver
	remoteResolvers map[string]RemoteResolver
	circuitBreakers map[string]*CircuitBreaker

	reqCh chan streamReqMsg
	quit  chan struct{}
}

// NewHybridPlaybackOrchestrator initializes the orchestrator.
func NewHybridPlaybackOrchestrator(local LocalResolver, remotes []RemoteResolver) *HybridPlaybackOrchestrator {
	h := &HybridPlaybackOrchestrator{
		localResolver:   local,
		remoteResolvers: make(map[string]RemoteResolver),
		circuitBreakers: make(map[string]*CircuitBreaker),
		reqCh:           make(chan streamReqMsg, 100), // Buffered to handle traffic spikes smoothly
		quit:            make(chan struct{}),
	}

	for _, r := range remotes {
		name := r.Name()
		h.remoteResolvers[name] = r
		h.circuitBreakers[name] = NewCircuitBreaker(DefaultCircuitBreakerConfig)
	}

	// Spin up the background actor
	go h.loop()
	return h
}

// loop is the main actor loop processing sequential tasks concurrently
// without explicit locking logic, avoiding data races.
func (h *HybridPlaybackOrchestrator) loop() {
	for {
		select {
		case <-h.quit:
			return
		case msg := <-h.reqCh:
			// Spawn worker goroutines per request to keep the orchestrator non-blocking
			go h.handleRequest(msg)
		}
	}
}

// Stop gracefully terminates the orchestrator loop.
func (h *HybridPlaybackOrchestrator) Stop() {
	close(h.quit)
}

// handleRequest processes a single integration routing request.
func (h *HybridPlaybackOrchestrator) handleRequest(msg streamReqMsg) {
	// 1. Fast Path: Local DB Memory-Mapped Query Cache Check
	if h.localResolver != nil {
		if res, err := h.localResolver.ResolveLocal(msg.ctx, msg.req); err == nil && res != nil {
			msg.resultCh <- resolveResponse{result: res, err: nil}
			return
		}
	}

	// 2. Slow Path Constraint: Strict contexts for zero-latency graceful degradation
	remoteCtx, cancel := context.WithTimeout(msg.ctx, 8*time.Second)
	defer cancel()

	g, ctx := errgroup.WithContext(remoteCtx)

	// Buffered channel for stream results across concurrent resolvers
	resultsCh := make(chan *StreamResult, len(h.remoteResolvers)*50)

	// Scatter: Launch goroutine pool to query external Torrent/Debrid addons concurrently
	for name, r := range h.remoteResolvers {
		name, resolver := name, r
		cb := h.circuitBreakers[name]

		g.Go(func() error {
			res, err := cb.Execute(ctx, func(c context.Context) ([]*StreamResult, error) {
				return resolver.ResolveRemote(c, msg.req)
			})
			if err != nil {
				// We don't fail the errgroup; we just gracefully ignore this failing remote
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

	// Close results channel when all remote resolvers finish
	go func() {
		_ = g.Wait()
		close(resultsCh)
	}()

	// Gather: Return fastest valid stream or gracefully degrade to 404
	select {
	case res, ok := <-resultsCh:
		if !ok || res == nil {
			// All resolvers finished but returned absolutely nothing
			msg.resultCh <- resolveResponse{err: ErrMediaNotFound}
			return
		}
		// Zero-latency return: First payload across the finish line wins.
		msg.resultCh <- resolveResponse{result: res}
		return
	case <-remoteCtx.Done():
		// Graceful Degradation: Context Timeout.
		// Immediately return 404 stream quickly rather than hanging the client.
		msg.resultCh <- resolveResponse{err: ErrMediaNotFound}
		return
	}
}

// Resolve exposes the stream resolution by pushing messages into the actor's queue.
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
