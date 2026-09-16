package parallel

import (
	"sync"
)

// EachTask iterates over elements of collection and invokes the task function for each element.
// `task` is called in parallel.
func EachTask[T any](collection []T, task func(item T, index int)) {
	var wg sync.WaitGroup

	for i, item := range collection {
		wg.Add(1)
		go func(_item T, _i int) {
			defer wg.Done()
			task(_item, _i)
		}(item, i)
	}

	wg.Wait()
}
