package skipdetect

import (
	"context"
	"kamehouse/internal/util/resourcebudget"
	"sync/atomic"
	"testing"
	"time"
)

func TestFingerprintResumesAfterPreview(t *testing.T) {
	old := resourcebudget.Shared
	resourcebudget.Shared = resourcebudget.NewCoordinator(0, nil)
	defer func() { resourcebudget.Shared = old }()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	started := make(chan struct{})
	finished := make(chan error, 1)
	var calls atomic.Int32
	go func() {
		_, _, err := runFingerprint(ctx, func(work context.Context) ([]int, float64, error) {
			if calls.Add(1) == 1 {
				close(started)
				<-work.Done()
				return nil, 0, work.Err()
			}
			return []int{42}, 1, nil
		})
		finished <- err
	}()
	<-started
	release, err := resourcebudget.Shared.Preview(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 1 {
		t.Fatal("fingerprint resumed before preview finished")
	}
	release()
	if err := <-finished; err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 2 {
		t.Fatal("interrupted fingerprint not retried")
	}
}
func TestCachedFingerprintDoesNotWaitForPlayback(t *testing.T) {
	old := resourcebudget.Shared
	resourcebudget.Shared = resourcebudget.NewCoordinator(time.Hour, nil)
	defer func() { resourcebudget.Shared = old }()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	release, err := resourcebudget.Shared.Live(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer release()
	root := t.TempDir()
	path := "gdrive://test/episode.mkv"
	key, err := ComputeFingerprintCacheKey(path, 0, 30, 0)
	if err != nil {
		t.Fatal(err)
	}
	if err = PutCachedFingerprint(root, key, &CachedFingerprint{Fingerprint: []int{1, 2}, Duration: 30}); err != nil {
		t.Fatal(err)
	}
	fp, _, err := FingerprintRangeCached(ctx, root, "missing", "missing", path, "unused", 0, 30, 0)
	if err != nil || len(fp) != 2 {
		t.Fatalf("cache blocked or missed: %v", err)
	}
}
