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

// TestLocalPlaybackOrchestrator_LocalHit
func TestLocalPlaybackOrchestrator_LocalHit(t *testing.T) {
	local := &mockLocal{
		res: &StreamResult{URL: "file://local/hit"},
		err: nil,
	}

	orch := NewLocalPlaybackOrchestrator(local)
	defer orch.Stop()

	res, err := orch.Resolve(context.Background(), StreamRequest{})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if res.URL != "file://local/hit" {
		t.Errorf("expected local hit URL, got %v", res.URL)
	}
}
