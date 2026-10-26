package cassette

import (
	"context"
	"errors"
	"sync"
	"testing"
)

func TestSegmentWaitForInvalidIndexDuringGrow(t *testing.T) {
	st := NewSegmentTable(1)
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for n := 2; n < 10000; n++ {
			st.Grow(n)
		}
	}()
	for i := 0; i < 20000; i++ {
		if err := st.WaitFor(context.Background(), -1, nil); !errors.Is(err, ErrSegmentOutOfRange) {
			t.Errorf("expected out-of-range error, got %v", err)
			break
		}
	}
	wg.Wait()
}
