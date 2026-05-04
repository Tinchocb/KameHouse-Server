package streaming

import (
	"context"
	"errors"
	"time"

	"golang.org/x/sync/errgroup"
	"kamehouse/internal/util"
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

// LocalPlaybackOrchestrator implements StreamResolutionService.
// It manages local file resolution and applies a semaphore cap on concurrent transcode sessions.
type LocalPlaybackOrchestrator struct {
	localResolver LocalResolver
	// transcodeSem is a channel-based semaphore capping concurrent FFmpeg sessions.
	transcodeSem chan struct{}

	reqCh chan streamReqMsg
	quit  chan struct{}
}

// NewLocalPlaybackOrchestrator initializes the orchestrator with a default concurrency cap.
func NewLocalPlaybackOrchestrator(local LocalResolver) *LocalPlaybackOrchestrator {
	return newOrchestrator(local, MaxTranscodeSessions)
}

// newOrchestrator is the internal constructor.
func newOrchestrator(local LocalResolver, maxTranscode int) *LocalPlaybackOrchestrator {
	sem := make(chan struct{}, maxTranscode)
	for i := 0; i < maxTranscode; i++ {
		sem <- struct{}{}
	}

	h := &LocalPlaybackOrchestrator{
		localResolver: local,
		transcodeSem:  sem,
		reqCh:         make(chan streamReqMsg, defaultReqBufferSize),
		quit:          make(chan struct{}),
	}

	go func() {
		defer util.RecoverInModule("streaming/orchestrator/loop")
		h.loop()
	}()
	return h
}

// loop is the actor loop.
func (h *LocalPlaybackOrchestrator) loop() {
	for {
		select {
		case <-h.quit:
			return
		case msg := <-h.reqCh:
			go func(msg streamReqMsg) {
				defer util.RecoverInModule("streaming/orchestrator/handleRequest")
				h.handleRequest(msg)
			}(msg)
		}
	}
}

// Stop gracefully terminates the orchestrator loop.
func (h *LocalPlaybackOrchestrator) Stop() {
	close(h.quit)
}

// handleRequest processes a single stream resolution request.
func (h *LocalPlaybackOrchestrator) handleRequest(msg streamReqMsg) {
	// ── 1. Local Path ────────────────────────────────────────────────────────
	if h.localResolver != nil {
		r, err := h.localResolver.ResolveLocal(msg.ctx, msg.req)
		if err == nil && r != nil {
			msg.resultCh <- resolveResponse{result: r}
			return
		}

		// ── 2. Local resolver returned a real result but likely needs transcoding.
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

	msg.resultCh <- resolveResponse{err: ErrMediaNotFound}
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
