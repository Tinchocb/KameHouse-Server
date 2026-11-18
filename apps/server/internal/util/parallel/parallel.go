package parallel

import (
	"context"
	"runtime"
	"sync"
	"sync/atomic"
)

// EachTask iterates over elements of collection and invokes the task function for each element.
// `task` is called in parallel.
func EachTask[T any](collection []T, task func(item T, index int)) {
	EachTaskLimit(collection, min(8, runtime.GOMAXPROCS(0)), task)
}

// EachTaskLimit uses a fixed worker pool; goroutine count does not grow with N.
func EachTaskLimit[T any](collection []T, concurrency int, task func(item T, index int)) {
	EachTaskLimitContext(context.Background(), collection, concurrency, task)
}

// EachTaskLimitContext stops claiming work on cancellation and joins callbacks
// already running. Callbacks performing I/O must also honor ctx.
func EachTaskLimitContext[T any](ctx context.Context, collection []T, concurrency int, task func(item T, index int)) {
	concurrency = min(len(collection), max(1, concurrency))
	if concurrency == 0 || ctx.Err() != nil {
		return
	}
	var next atomic.Int64
	var wg sync.WaitGroup
	for range concurrency {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for ctx.Err() == nil {
				i := int(next.Add(1) - 1)
				if i >= len(collection) {
					return
				}
				task(collection[i], i)
			}
		}()
	}
	wg.Wait()
}
