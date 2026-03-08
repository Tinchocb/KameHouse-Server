package streaming

import (
	"context"
	"errors"
	"testing"
	"time"
)

// Mock local resolver
type mockLocal struct {
	res *StreamResult
	err error
}

func (m *mockLocal) ResolveLocal(ctx context.Context, req StreamRequest) (*StreamResult, error) {
	return m.res, m.err
}

// Mock remote resolver
type mockRemote struct {
	name  string
	res   []*StreamResult
	err   error
	delay time.Duration
}

func (m *mockRemote) Name() string { return m.name }

func (m *mockRemote) ResolveRemote(ctx context.Context, req StreamRequest) ([]*StreamResult, error) {
	if m.delay > 0 {
		select {
		case <-time.After(m.delay):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return m.res, m.err
}

func TestHybridPlaybackOrchestrator_LocalHit(t *testing.T) {
	local := &mockLocal{
		res: &StreamResult{URL: "file://local/hit"},
		err: nil,
	}

	orch := NewHybridPlaybackOrchestrator(local, nil)
	defer orch.Stop()

	res, err := orch.Resolve(context.Background(), StreamRequest{})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if res.URL != "file://local/hit" {
		t.Errorf("expected local hit URL, got %v", res.URL)
	}
}

func TestHybridPlaybackOrchestrator_RemoteHit(t *testing.T) {
	local := &mockLocal{res: nil, err: ErrMediaNotFound}
	remote := &mockRemote{
		name: "test-addon",
		res:  []*StreamResult{{URL: "magnet:?xt=test"}},
		err:  nil,
	}

	orch := NewHybridPlaybackOrchestrator(local, []RemoteResolver{remote})
	defer orch.Stop()

	res, err := orch.Resolve(context.Background(), StreamRequest{})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if res.URL != "magnet:?xt=test" {
		t.Errorf("expected remote URL, got %v", res.URL)
	}
}

func TestHybridPlaybackOrchestrator_CircuitBreaker(t *testing.T) {
	local := &mockLocal{res: nil, err: ErrMediaNotFound}
	// Remote that always fails
	remote := &mockRemote{
		name: "failing-addon",
		res:  nil,
		err:  errors.New("addon error"),
	}

	orch := NewHybridPlaybackOrchestrator(local, []RemoteResolver{remote})
	defer orch.Stop()

	// Default failure threshold is 3. We'll trigger it 3 times.
	for i := 0; i < 3; i++ {
		_, err := orch.Resolve(context.Background(), StreamRequest{})
		if !errors.Is(err, ErrMediaNotFound) {
			t.Fatalf("expected ErrMediaNotFound, got %v", err)
		}
	}

	// Now the circuit should be open
	cb := orch.circuitBreakers["failing-addon"]
	cb.mu.RLock()
	state := cb.state
	cb.mu.RUnlock()

	if state != CircuitOpen {
		t.Fatalf("expected circuit to be Open after failures, got %v", state)
	}
}

func TestHybridPlaybackOrchestrator_Timeout(t *testing.T) {
	local := &mockLocal{res: nil, err: ErrMediaNotFound}
	remote := &mockRemote{
		name:  "slow-addon",
		res:   []*StreamResult{{URL: "magnet:?xt=slow"}},
		delay: 10 * time.Second, // longer than the 8s timeout
	}

	orch := NewHybridPlaybackOrchestrator(local, []RemoteResolver{remote})
	defer orch.Stop()

	// Use a short caller context to avoid waiting 8s for the test
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	_, err := orch.Resolve(ctx, StreamRequest{})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected context timeout, got %v", err)
	}
}
