package cassette

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestSessionWaitReady_ContextCancelled(t *testing.T) {
	s := &Session{ready: make(chan struct{})}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()

	if err := s.WaitReady(ctx); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected deadline exceeded while keyframes are pending, got %v", err)
	}
}

func TestSessionWaitReady_ReturnsExtractionError(t *testing.T) {
	want := errors.New("boom")
	s := &Session{ready: make(chan struct{}), err: want}
	close(s.ready)

	if err := s.WaitReady(context.Background()); !errors.Is(err, want) {
		t.Fatalf("expected extraction error, got %v", err)
	}
}

func TestLimitedBuffer_OversizedWriteKeepsTail(t *testing.T) {
	b := NewLimitedBuffer(8)
	_, _ = b.Write([]byte("abc"))
	_, _ = b.Write([]byte(strings.Repeat("x", 20) + "12345678"))

	if got := b.String(); got != "12345678" {
		t.Fatalf("expected last 8 bytes, got %q", got)
	}
}
