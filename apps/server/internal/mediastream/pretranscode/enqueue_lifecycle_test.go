package pretranscode

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestEnqueueProbeDoesNotBlockJobsAndStopCancelsIt(t *testing.T) {
	m := testManager(t, t.TempDir())
	hash := strings.Repeat("a", 40)
	writePlaylist(t, m, hash)
	started := make(chan struct{})
	result := make(chan error, 1)
	go func() {
		_, err := m.enqueue("fixture.mkv", hash, func(ctx context.Context, _, _ string) (sourceStreams, error) {
			close(started)
			<-ctx.Done()
			return sourceStreams{}, ctx.Err()
		})
		result <- err
	}()
	t.Cleanup(m.Stop)
	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("probe never started")
	}
	snapshots := make(chan []*PreTranscodeJob, 1)
	go func() { snapshots <- m.Jobs() }()
	select {
	case jobs := <-snapshots:
		if len(jobs) != 1 {
			t.Fatalf("jobs = %d", len(jobs))
		}
	case <-time.After(time.Second):
		t.Fatal("Jobs blocked behind ffprobe")
	}
	stopped := make(chan struct{})
	go func() { m.Stop(); close(stopped) }()
	select {
	case <-stopped:
	case <-time.After(3 * time.Second):
		t.Fatal("Stop did not cancel/join probe")
	}
	if err := <-result; err == nil {
		t.Fatal("cancelled probe published completed job")
	}
	if m.Jobs()[0].Status != StatusFailed {
		t.Fatal("cancelled probe marked available")
	}
}

func TestConcurrentEnqueuesRespectProbeCapacity(t *testing.T) {
	m := testManager(t, t.TempDir()) // one probe slot
	t.Cleanup(m.Stop)
	const count = 8
	for i := range count {
		writePlaylist(t, m, fmt.Sprintf("%040x", i))
	}
	var active, peak atomic.Int32
	started, release := make(chan struct{}), make(chan struct{})
	var announce sync.Once
	probe := func(ctx context.Context, _, _ string) (sourceStreams, error) {
		n := active.Add(1)
		defer active.Add(-1)
		for old := peak.Load(); n > old; old = peak.Load() {
			if peak.CompareAndSwap(old, n) {
				break
			}
		}
		announce.Do(func() { close(started) })
		select {
		case <-ctx.Done():
			return sourceStreams{}, ctx.Err()
		case <-release:
			return sourceStreams{}, nil
		}
	}
	results := make(chan error, count)
	for i := range count {
		go func(i int) { _, err := m.enqueue("fixture.mkv", fmt.Sprintf("%040x", i), probe); results <- err }(i)
	}
	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("probe did not start")
	}
	deadline := time.After(3 * time.Second)
	ticker := time.NewTicker(time.Millisecond)
	defer ticker.Stop()
	for len(m.Jobs()) < count {
		select {
		case <-deadline:
			t.Fatal("jobs blocked behind probe")
		case <-ticker.C:
		}
	}
	// Stop cancels both the running producer and every admission waiting for a slot.
	stopped := make(chan struct{})
	go func() { m.Stop(); close(stopped) }()
	select {
	case <-stopped:
	case <-time.After(3 * time.Second):
		t.Fatal("Stop blocked on probe capacity")
	}
	for range count {
		select {
		case err := <-results:
			if err == nil {
				t.Fatal("shutdown published a job")
			}
		case <-time.After(time.Second):
			t.Fatal("enqueue did not return")
		}
	}
	if peak.Load() != 1 {
		t.Fatalf("peak probes = %d, want 1", peak.Load())
	}
	if len(m.probeSlots) != 0 {
		t.Fatal("probe slot leaked")
	}
}

func TestPruneJobsKeepsActiveWorkAndDiskOutput(t *testing.T) {
	m := testManager(t, t.TempDir())
	for i := range 300 {
		hash := fmt.Sprintf("%040x", i)
		m.jobs[hash] = &PreTranscodeJob{Hash: hash, Status: StatusCompleted, QueuedAt: time.Unix(int64(i), 0)}
	}
	writePlaylist(t, m, fmt.Sprintf("%040x", 0))
	active := &PreTranscodeJob{Hash: "active", Status: StatusRunning}
	stopping := &PreTranscodeJob{Hash: "stopping", Status: StatusFailed, done: make(chan struct{})}
	m.jobs[active.Hash], m.jobs[stopping.Hash] = active, stopping
	if n := len(m.Jobs()); n != 258 {
		t.Fatalf("retained %d jobs, want 256 terminal + 2 active", n)
	}
	if m.jobs[active.Hash] != active || m.jobs[stopping.Hash] != stopping {
		t.Fatal("evicted active job")
	}
	if !m.IsAvailable(fmt.Sprintf("%040x", 0)) {
		t.Fatal("metadata pruning deleted output")
	}
}

func TestDeleteCancelsProbeBeforeRemovingOutput(t *testing.T) {
	m := testManager(t, t.TempDir())
	t.Cleanup(m.Stop)
	hash := strings.Repeat("b", 40)
	writePlaylist(t, m, hash)
	started, result := make(chan struct{}), make(chan error, 1)
	go func() {
		_, err := m.enqueue("fixture.mkv", hash, func(ctx context.Context, _, _ string) (sourceStreams, error) {
			close(started)
			<-ctx.Done()
			return sourceStreams{}, ctx.Err()
		})
		result <- err
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("probe never started")
	}
	// Duplicate requests share the reservation, without probing or queueing again.
	if _, err := m.enqueue("fixture.mkv", hash, func(context.Context, string, string) (sourceStreams, error) {
		t.Fatal("duplicate probe")
		return sourceStreams{}, nil
	}); err != nil {
		t.Fatal(err)
	}
	deleted := make(chan error, 1)
	go func() { deleted <- m.Delete(hash) }()
	select {
	case err := <-deleted:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("Delete blocked behind probe")
	}
	if err := <-result; err == nil {
		t.Fatal("deleted job was published")
	}
	if m.IsAvailable(hash) || len(m.Jobs()) != 0 {
		t.Fatal("deleted output/job survived")
	}
}
