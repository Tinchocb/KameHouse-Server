package parallel

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCancellationStopsSchedulingAndJoinsAdmittedCallbacks(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	started := make(chan struct{}, 3)
	release, done := make(chan struct{}), make(chan struct{})
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	defer unblock()
	var calls atomic.Int32
	go func() {
		EachTaskLimitContext(ctx, make([]int, 10000), 3, func(int, int) {
			calls.Add(1)
			select {
			case started <- struct{}{}:
			default:
			}
			<-release
		})
		close(done)
	}()
	for range 3 {
		select {
		case <-started:
		case <-time.After(3 * time.Second):
			t.Fatal("pool did not start three workers")
		}
	}
	cancel()
	select {
	case <-done:
		t.Fatal("pool abandoned callbacks still using their resources")
	default:
	}
	unblock()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("pool did not join workers")
	}
	require.Equal(t, int32(3), calls.Load())
	EachTaskLimitContext(ctx, []int{1}, 1, func(int, int) { t.Fatal("cancelled pool started work") })
}
