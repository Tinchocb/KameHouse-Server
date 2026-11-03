package cassette

import (
	"context"
	"errors"
	"os/exec"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"
)

// Observing Done makes the test wait until GetSegment has reached its wait
// context, rather than relying on sleeps to cancel an in-flight fragment.
type observedFragmentContext struct {
	context.Context
	waiting chan struct{}
	once    sync.Once
}

func (c *observedFragmentContext) Done() <-chan struct{} {
	c.once.Do(func() { close(c.waiting) })
	return c.Context.Done()
}

func fragmentCancellationPipeline(t *testing.T) (*Pipeline, *atomic.Int32) {
	t.Helper()
	l := zerolog.Nop()
	killed := &atomic.Int32{}
	dir := t.TempDir()
	p := &Pipeline{
		kind: AudioKind, label: "shared audio", ctx: context.Background(),
		session: &Session{Keyframes: &KeyframeIndex{
			Keyframes: []float64{0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20}, IsDone: true,
		}},
		segments: NewSegmentTable(11), velocity: NewVelocityEstimator(30 * time.Second),
		killCh: make(chan struct{}), logger: &l, governor: NewGovernor(1, false, &l),
		outPathFmt: func(int) string { return filepath.Join(dir, "segment-%d.ts") },
		heads: []head{
			{segment: 0, end: 5, gen: 1, cmd: &exec.Cmd{}, cancel: func() { killed.Add(1) }},
			{segment: 5, end: 10, gen: 2, cmd: &exec.Cmd{}, cancel: func() { killed.Add(1) }},
		},
	}
	return p, killed
}

func TestCancelledFragmentDoesNotTouchSharedProducers(t *testing.T) {
	p, killed := fragmentCancellationPipeline(t)
	// An obsolete request must not be recorded as a backwards seek either.
	p.velocity.Record(9)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := p.GetSegment(ctx, 0); !errors.Is(err, context.Canceled) {
		t.Fatalf("expected cancellation, got %v", err)
	}
	if killed.Load() != 0 || p.velocity.DetectSeek(5) {
		t.Fatal("obsolete fragment changed producer or seek state")
	}
}

func TestFragmentCancellationPreservesAnotherActiveRequest(t *testing.T) {
	p, killed := fragmentCancellationPipeline(t)
	// A pre-fix retry must remain bounded without starting an actual process.
	release, err := p.governor.Acquire(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	active, cancelActive := context.WithTimeout(context.Background(), 3*time.Second)
	obsolete, cancelObsolete := context.WithTimeout(context.Background(), 3*time.Second)
	activeCtx := &observedFragmentContext{Context: active, waiting: make(chan struct{})}
	obsoleteCtx := &observedFragmentContext{Context: obsolete, waiting: make(chan struct{})}
	activeResult := make(chan error, 1)
	obsoleteResult := make(chan error, 1)
	var wg sync.WaitGroup
	t.Cleanup(func() {
		cancelObsolete()
		cancelActive()
		wg.Wait()
		release()
	})
	wg.Go(func() { _, err := p.GetSegment(activeCtx, 7); activeResult <- err })
	<-activeCtx.waiting
	wg.Go(func() { _, err := p.GetSegment(obsoleteCtx, 2); obsoleteResult <- err })
	<-obsoleteCtx.waiting
	cancelObsolete()
	if err := <-obsoleteResult; !errors.Is(err, context.Canceled) {
		t.Fatalf("expected cancellation, got %v", err)
	}
	if killed.Load() != 0 {
		t.Fatalf("canceling one fragment killed %d shared producers", killed.Load())
	}
	select {
	case <-p.killCh:
		t.Fatal("canceling a fragment aborted the shared wait channel")
	default:
	}
	p.segments.MarkReady(7, 1)
	if err := <-activeResult; err != nil {
		t.Fatalf("other client's fragment failed: %v", err)
	}
	// Explicit session/seek cleanup must still release both producers.
	p.killAllHeads()
	if killed.Load() != 2 {
		t.Fatalf("explicit cleanup left producers running: killed=%d", killed.Load())
	}
}
