package maintenance

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
)

func TestScheduler(t *testing.T) {
	logger := zerolog.Nop()
	scheduler := NewScheduler(&logger)

	var runs int32
	job := Job{
		Name:         "test-job",
		Interval:     20 * time.Millisecond,
		InitialDelay: 0,
		Run: func(ctx context.Context) {
			atomic.AddInt32(&runs, 1)
		},
	}

	scheduler.Add(job)

	ctx, cancel := context.WithCancel(context.Background())
	scheduler.Start(ctx)

	// wait until the job runs at least twice
	assert.Eventually(t, func() bool {
		return atomic.LoadInt32(&runs) >= 2
	}, 2*time.Second, 10*time.Millisecond, "expected job to run at least 2 times")

	cancel()

	finalRuns := atomic.LoadInt32(&runs)
	// Verify it does not keep incrementing after cancel
	time.Sleep(30 * time.Millisecond)
	postCancelRuns := atomic.LoadInt32(&runs)
	if postCancelRuns != finalRuns {
		t.Errorf("Job continued running after cancel. Runs before: %d, after: %d", finalRuns, postCancelRuns)
	}
}

func TestScheduler_PanicRecovery(t *testing.T) {
	logger := zerolog.Nop()
	scheduler := NewScheduler(&logger)

	var runs int32
	job := Job{
		Name:         "panic-job",
		Interval:     10 * time.Millisecond,
		InitialDelay: 0,
		Run: func(ctx context.Context) {
			atomic.AddInt32(&runs, 1)
			panic("simulated panic")
		},
	}

	scheduler.Add(job)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	scheduler.Start(ctx)

	assert.Eventually(t, func() bool {
		return atomic.LoadInt32(&runs) >= 2
	}, 2*time.Second, 10*time.Millisecond, "expected panic-job to recover and run at least 2 times")
}
