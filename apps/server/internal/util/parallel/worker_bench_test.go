package parallel

import (
	"sync/atomic"
	"testing"
)

func BenchmarkEachTaskLimit(b *testing.B) {
	items := make([]int, 10000)
	var count atomic.Int64
	b.ReportAllocs()
	for b.Loop() {
		EachTaskLimit(items, 8, func(int, int) { count.Add(1) })
	}
	if count.Load() != int64(b.N)*int64(len(items)) {
		b.Fatal("tasks lost")
	}
}
