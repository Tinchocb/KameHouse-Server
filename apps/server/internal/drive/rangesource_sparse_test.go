package drive

import (
	"bytes"
	"context"
	"path/filepath"
	"strconv"
	"testing"
	"time"
)

func waitSparseCacheIdle(tb testing.TB, cache *BlockCache) {
	tb.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for cache.inflightCount() != 0 {
		if time.Now().After(deadline) {
			tb.Fatal("sparse cache downloads did not finish")
		}
		time.Sleep(time.Millisecond)
	}
}

func readSparseFixture(tb testing.TB, cache *BlockCache, upstream *cacheUpstream, readAhead bool) {
	tb.Helper()
	fetch := cache.FetcherWithoutReadAhead("sparse", upstream.fetch)
	if readAhead {
		fetch = cache.Fetcher("sparse", upstream.fetch)
	}
	source := NewRangeSource(fetch, int64(len(upstream.data)))
	buf := make([]byte, 256)
	for _, block := range []int64{0, 16, 32, 48, 63} {
		offset := block*cache.blockSize + 31
		if n, err := source.ReadAt(context.Background(), buf, offset); err != nil || n != len(buf) || !bytes.Equal(buf, upstream.data[offset:offset+int64(len(buf))]) {
			tb.Fatalf("sparse read at %d: bytes=%d, err=%v", offset, n, err)
		}
	}
	waitSparseCacheIdle(tb, cache)
}

func TestSparseRangeSourceReadsOnlyDemandedBlocksAndReusesCache(t *testing.T) {
	const block = 64 << 10
	cache := newTestCache(t, block, 16<<20)
	cache.freeBytes = func(string) (uint64, error) { return blockCacheDiskReserve + 32<<20, nil }
	upstream := &cacheUpstream{data: testData(64 * block)}
	readSparseFixture(t, cache, upstream, false)
	if got := upstream.requests.Load(); got != 5 {
		t.Fatalf("five sparse reads downloaded %d blocks", got)
	}
	readSparseFixture(t, cache, upstream, false)
	if got := upstream.requests.Load(); got != 5 {
		t.Fatalf("warm sparse reads downloaded again: %d requests", got)
	}
}

// Compares the old playback policy with the subtitle policy on identical bytes,
// including completion of all speculative requests in the reported cost.
func BenchmarkSparseRangeSourcePolicy(b *testing.B) {
	const block = 64 << 10
	data := testData(64 * block)
	for _, readAhead := range []bool{true, false} {
		name := "demand_only"
		if readAhead {
			name = "playback_read_ahead"
		}
		b.Run(name, func(b *testing.B) {
			root := b.TempDir()
			var requests, transferred int64
			b.ReportAllocs()
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				cache, err := NewBlockCache(filepath.Join(root, strconv.Itoa(i)), block, 16<<20)
				if err != nil {
					b.Fatal(err)
				}
				cache.freeBytes = func(string) (uint64, error) { return blockCacheDiskReserve + 32<<20, nil }
				upstream := &cacheUpstream{data: data}
				readSparseFixture(b, cache, upstream, readAhead)
				requests += int64(upstream.requests.Load())
				transferred += upstream.served.Load()
			}
			b.ReportMetric(float64(requests)/float64(b.N), "req/op")
			b.ReportMetric(float64(transferred)/float64(b.N), "download_B/op")
		})
	}
}
