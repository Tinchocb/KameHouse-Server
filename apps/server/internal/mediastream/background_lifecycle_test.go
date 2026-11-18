package mediastream

import (
	"context"
	"sync"
	"testing"
	"time"

	"kamehouse/internal/mediastream/videofile"

	"github.com/stretchr/testify/require"
)

func TestCleanupCancelsQueuedAttachmentWithoutAcquiringSlot(t *testing.T) {
	r := newDriveSubsRepo(t, "unused")
	previous := attachmentSemaphore
	attachmentSemaphore = make(chan struct{}, 1)
	attachmentSemaphore <- struct{}{}
	defer func() { <-attachmentSemaphore; attachmentSemaphore = previous }()
	r.playbackManager.startAttachmentExtraction("input.mkv", "queued", &videofile.MediaInfo{}, false)
	v, ok := r.playbackManager.extractionJobs.Load("queued")
	require.True(t, ok)
	r.OnCleanup()
	select {
	case <-v.(*extractionJob).done:
	default:
		t.Fatal("cleanup returned with an extraction still waiting for a slot")
	}
	require.ErrorIs(t, r.workContext().Err(), context.Canceled)
	require.False(t, r.startWork(func(context.Context) { t.Error("work admitted after cleanup") }))
}

func TestCleanupJoinsWorkAfterCancellation(t *testing.T) {
	r := &Repository{}
	cancelled, release, stopped := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	defer unblock()
	require.True(t, r.startWork(func(ctx context.Context) { <-ctx.Done(); close(cancelled); <-release }))
	go func() { r.OnCleanup(); close(stopped) }()
	select {
	case <-cancelled:
	case <-time.After(5 * time.Second):
		t.Fatal("cleanup did not cancel background work")
	}
	select {
	case <-stopped:
		t.Fatal("cleanup did not wait for the cancelled worker to release resources")
	case <-time.After(50 * time.Millisecond):
	}
	unblock()
	select {
	case <-stopped:
	case <-time.After(5 * time.Second):
		t.Fatal("cleanup did not finish")
	}
}
