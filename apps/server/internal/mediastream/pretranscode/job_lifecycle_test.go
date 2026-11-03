package pretranscode

import (
	"context"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"kamehouse/internal/util/resourcebudget"
)

func lifecycleManager(t *testing.T) (*Manager, string) {
	t.Helper()
	previous := resourcebudget.Shared
	resourcebudget.Shared = resourcebudget.NewCoordinator(0, nil)
	t.Cleanup(func() { resourcebudget.Shared = previous })
	base := t.TempDir()
	src := filepath.Join(base, "file.mkv")
	if err := os.WriteFile(src, []byte("fixture"), 0600); err != nil {
		t.Fatal(err)
	}
	m := testManager(t, filepath.Join(base, "output"))
	t.Cleanup(m.Stop)
	return m, src
}

func lifecycleWait(t *testing.T, done <-chan struct{}) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("lifecycle operation did not finish")
	}
}

func TestJobSnapshotsDoNotAliasWorkerState(t *testing.T) {
	m, src := lifecycleManager(t)
	first, err := m.Enqueue(src)
	if err != nil {
		t.Fatal(err)
	}
	first.Status, first.FilePath = StatusCompleted, "caller mutation"
	second, err := m.Enqueue(src)
	if err != nil {
		t.Fatal(err)
	}
	if second.Status != StatusQueued || second.FilePath != src {
		t.Fatal("enqueue exposed the internal job")
	}
	finished := time.Now()
	m.finish(second.Hash, StatusCompleted, "", &finished)
	listed := m.Jobs()
	*listed[0].EndedAt = time.Time{}
	if m.Jobs()[0].EndedAt.IsZero() {
		t.Fatal("EndedAt was shared")
	}
	// Responses remain stable while another goroutine updates progress.
	done := make(chan struct{})
	go func() {
		defer close(done)
		for i := 0; i < 100; i++ {
			m.setStatus(second.Hash, StatusRunning, float64(i))
		}
	}()
	for i := 0; i < 100; i++ {
		if _, err := json.Marshal(second); err != nil {
			t.Fatal(err)
		}
		m.Jobs()
	}
	lifecycleWait(t, done)
}

func TestCancelledAndReplacedQueueEntriesCannotStart(t *testing.T) {
	m, src := lifecycleManager(t)
	snapshot, err := m.Enqueue(src)
	if err != nil {
		t.Fatal(err)
	}
	old := <-m.queue
	if !m.Cancel(snapshot.Hash) {
		t.Fatal("cancel failed")
	}
	if _, err := m.Enqueue(src); err != nil {
		t.Fatal(err)
	}
	var calls atomic.Int32
	encode := func(context.Context, *PreTranscodeJob) error { calls.Add(1); return nil }
	m.runWith(old, encode)
	if calls.Load() != 0 {
		t.Fatal("obsolete queue entry ran after cancellation")
	}
	m.runWith(<-m.queue, encode)
	if calls.Load() != 1 {
		t.Fatal("replacement did not run")
	}
}

func TestDeleteWaitsForCleanupAndPreventsReenqueue(t *testing.T) {
	m, src := lifecycleManager(t)
	snapshot, err := m.Enqueue(src)
	if err != nil {
		t.Fatal(err)
	}
	job := <-m.queue
	started, cancelled, release, returned := make(chan struct{}), make(chan struct{}), make(chan struct{}), make(chan struct{})
	var once sync.Once
	t.Cleanup(func() { once.Do(func() { close(release) }) })
	go func() {
		defer close(returned)
		m.runWith(job, func(ctx context.Context, _ *PreTranscodeJob) error {
			close(started)
			<-ctx.Done()
			close(cancelled)
			<-release
			return ctx.Err()
		})
	}()
	lifecycleWait(t, started)
	deleted := make(chan struct{})
	var deleteErr error
	go func() { defer close(deleted); deleteErr = m.Delete(snapshot.Hash) }()
	lifecycleWait(t, cancelled)
	if _, err := m.Enqueue(src); err == nil {
		t.Fatal("reenqueued while previous work was still cleaning up")
	}
	select {
	case <-deleted:
		t.Fatal("delete returned before cleanup")
	default:
	}
	once.Do(func() { close(release) })
	lifecycleWait(t, returned)
	lifecycleWait(t, deleted)
	if deleteErr != nil {
		t.Fatal(deleteErr)
	}
	if _, err := m.Enqueue(src); err != nil {
		t.Fatal(err)
	}
	writePlaylist(t, m, snapshot.Hash)
	m.runWith(job, func(context.Context, *PreTranscodeJob) error { t.Error("old job restarted"); return nil })
	if !m.IsAvailable(snapshot.Hash) {
		t.Fatal("old generation removed the replacement output")
	}
}

func TestConcurrentStopWaitsForProcessCleanup(t *testing.T) {
	m, src := lifecycleManager(t)
	if _, err := m.Enqueue(src); err != nil {
		t.Fatal(err)
	}
	job := <-m.queue
	started, cancelled, release := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var once sync.Once
	t.Cleanup(func() { once.Do(func() { close(release) }) })
	go m.runWith(job, func(ctx context.Context, _ *PreTranscodeJob) error {
		close(started)
		<-ctx.Done()
		close(cancelled)
		<-release
		return ctx.Err()
	})
	lifecycleWait(t, started)
	stopped := make(chan struct{})
	go func() {
		defer close(stopped)
		var wg sync.WaitGroup
		for i := 0; i < 8; i++ {
			wg.Add(1)
			go func() { defer wg.Done(); m.Stop() }()
		}
		wg.Wait()
	}()
	lifecycleWait(t, cancelled)
	select {
	case <-stopped:
		t.Fatal("stop returned before cleanup")
	default:
	}
	once.Do(func() { close(release) })
	lifecycleWait(t, stopped)
	m.Start()
	if _, err := m.Enqueue(src); err == nil {
		t.Fatal("stopped manager accepted work")
	}
}

func TestPlaybackPreemptionRetriesSameJob(t *testing.T) {
	m, src := lifecycleManager(t)
	if _, err := m.Enqueue(src); err != nil {
		t.Fatal(err)
	}
	job := <-m.queue
	started, finished := make(chan struct{}), make(chan struct{})
	var calls atomic.Int32
	go func() {
		defer close(finished)
		m.runWith(job, func(ctx context.Context, _ *PreTranscodeJob) error {
			if calls.Add(1) == 1 {
				close(started)
				<-ctx.Done()
				return ctx.Err()
			}
			return nil
		})
	}()
	lifecycleWait(t, started)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	release, err := resourcebudget.Shared.Live(ctx)
	if err != nil {
		t.Fatal(err)
	}
	release()
	lifecycleWait(t, finished)
	if calls.Load() != 2 || m.Jobs()[0].Status != StatusCompleted {
		t.Fatal("playback priority did not retry the admitted job")
	}
}

func TestCancellationUnblocksProgressWithoutWriterEOF(t *testing.T) {
	m := testManager(t, t.TempDir())
	reader, writer := io.Pipe()
	defer writer.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() { defer close(done); m.trackProgressContext(ctx, reader, "unused", 1) }()
	cancel()
	lifecycleWait(t, done)
}
