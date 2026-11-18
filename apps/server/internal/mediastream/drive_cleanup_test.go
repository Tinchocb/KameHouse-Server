package mediastream

import (
	"context"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/mkvsubs"
	"kamehouse/internal/mkvsubs/mkvtest"

	"github.com/stretchr/testify/require"
)

func waitDriveCleanup(t *testing.T, ch <-chan struct{}) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(3 * time.Second):
		t.Fatal("Drive cleanup timed out")
	}
}

func TestCleanupJoinsPendingDriveWindowOpenAndRejectsLatePublication(t *testing.T) {
	r := newDriveSubsRepo(t, "unused")
	started, cancelled, release := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	defer unblock()
	synth := mkvtest.BuildSynth(mkvtest.SynthOptions{Secs: 2, Tracks: []mkvtest.SynthTrack{{Kind: mkvtest.KindSRT}}})
	r.SetDriveSourceFactory(func(ctx context.Context, _ string) (mkvsubs.Source, error) {
		close(started)
		<-ctx.Done()
		close(cancelled)
		<-release // simulate a source finishing late despite cancellation
		return mkvsubs.BytesSource(synth.Bytes), nil
	})
	result := make(chan error, 1)
	go func() { _, err := r.driveWindowSession(t.Context(), "gdrive://pending/episode.mkv"); result <- err }()
	waitDriveCleanup(t, started)
	closed := make(chan struct{})
	go func() { r.OnCleanup(); close(closed) }()
	waitDriveCleanup(t, cancelled)
	select {
	case <-closed:
		t.Fatal("cleanup abandoned the opening source")
	default:
	}
	unblock()
	waitDriveCleanup(t, closed)
	require.ErrorIs(t, <-result, context.Canceled)
	r.driveWin.mu.Lock()
	openCount, sessionCount := len(r.driveWin.opening), len(r.driveWin.sessions)
	r.driveWin.mu.Unlock()
	require.Zero(t, openCount)
	require.Zero(t, sessionCount)
	_, err := r.driveWindowSession(t.Context(), "gdrive://pending/episode.mkv")
	require.ErrorIs(t, err, context.Canceled)
}

type cancelMarkerContext struct {
	context.Context
	cancel context.CancelFunc
	path   string
}

func (ctx *cancelMarkerContext) Err() error {
	if data, err := os.ReadFile(ctx.path); err == nil && string(data) == "new-complete" {
		ctx.cancel()
	}
	return ctx.Context.Err()
}

func TestCancelledMarkerPublicationRestoresExistingCompletion(t *testing.T) {
	path := filepath.Join(t.TempDir(), "subs.done")
	require.NoError(t, os.WriteFile(path, []byte("previous-complete"), 0600))
	base, cancel := context.WithCancel(t.Context())
	defer cancel()
	ctx := &cancelMarkerContext{Context: base, cancel: cancel, path: path}
	require.ErrorIs(t, (&Repository{}).commitDriveSubtitleMarker(ctx, path, []byte("new-complete")), context.Canceled)
	got, err := os.ReadFile(path)
	require.NoError(t, err)
	require.Equal(t, "previous-complete", string(got))
}

type cleanupWindowSource struct {
	mkvsubs.BytesSource
	block                       atomic.Bool
	started, cancelled, release chan struct{}
	startOnce, cancelOnce       sync.Once
}

func (s *cleanupWindowSource) ReadAt(ctx context.Context, data []byte, off int64) (int, error) {
	if s.block.Load() {
		s.startOnce.Do(func() { close(s.started) })
		<-ctx.Done()
		s.cancelOnce.Do(func() { close(s.cancelled) })
		<-s.release
		return 0, ctx.Err()
	}
	return s.BytesSource.ReadAt(ctx, data, off)
}

func TestCleanupJoinsActiveDriveWindowReadAndReleasesSlot(t *testing.T) {
	r := newDriveSubsRepo(t, "unused")
	synth := mkvtest.BuildSynth(mkvtest.SynthOptions{Secs: 20, VideoBytesPerSec: 64 << 10, Tracks: []mkvtest.SynthTrack{{Kind: mkvtest.KindVideo}, {Kind: mkvtest.KindSRT, Events: []mkvtest.Event{{StartMs: 100, EndMs: 19000, Text: "fixture"}}}}})
	src := &cleanupWindowSource{BytesSource: mkvsubs.BytesSource(synth.Bytes), started: make(chan struct{}), cancelled: make(chan struct{}), release: make(chan struct{})}
	var once sync.Once
	unblock := func() { once.Do(func() { close(src.release) }) }
	defer unblock()
	r.SetDriveSourceFactory(func(context.Context, string) (mkvsubs.Source, error) { return src, nil })
	const path = "gdrive://active-reader/episode.mkv"
	_, err := r.driveWindowSession(t.Context(), path)
	require.NoError(t, err)
	slotsBefore := len(driveWindowSlots)
	src.block.Store(true)
	_, err = r.DriveSubtitleWindow(t.Context(), path, 0, true)
	require.NoError(t, err)
	waitDriveCleanup(t, src.started)
	closed := make(chan struct{})
	go func() { r.OnCleanup(); close(closed) }()
	waitDriveCleanup(t, src.cancelled)
	select {
	case <-closed:
		t.Fatal("cleanup returned before the reader released its slot")
	default:
	}
	unblock()
	waitDriveCleanup(t, closed)
	require.Equal(t, slotsBefore, len(driveWindowSlots))
	require.NoFileExists(t, driveSubsDonePath(r.CacheDir(), r.driveSubtitleHash(path)))
}

func TestCancelledFinalizationPreservesPreviousCompleteMarker(t *testing.T) {
	r := newDriveSubsRepo(t, "unused")
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	s := &driveWindowSession{ctx: ctx, hash: "existing"}
	marker := driveSubsDonePath(r.CacheDir(), s.hash)
	require.NoError(t, os.MkdirAll(filepath.Dir(marker), 0700))
	require.NoError(t, os.WriteFile(marker, []byte("previous-complete"), 0600))
	require.ErrorIs(t, s.finalize(r), context.Canceled)
	data, err := os.ReadFile(marker)
	require.NoError(t, err)
	require.Equal(t, "previous-complete", string(data))
}

func TestCleanupCancelsQueuedDriveExtractionAndIsolatesRepositories(t *testing.T) {
	r := newDriveSubsRepo(t, "unused")
	other := newDriveSubsRepo(t, "unused")
	const path = "gdrive://cleanup-owned/episode.mkv"
	driveSubSlot <- struct{}{}
	defer func() {
		r.CancelDriveSubtitleExtraction(path)
		other.CancelDriveSubtitleExtraction(path)
		<-driveSubSlot
		require.Eventually(t, func() bool { return r.DriveSubtitleStatus(path).State != DriveSubtitlesQueued }, time.Second, time.Millisecond)
	}()
	_, err := r.StartDriveSubtitleExtraction(path, "unused", &videofile.MediaInfo{}, 1)
	require.NoError(t, err)
	t.Run("isolated", func(t *testing.T) { require.Equal(t, DriveSubtitlesNone, other.DriveSubtitleStatus(path).State) })
	_, err = other.StartDriveSubtitleExtraction(path, "unused", &videofile.MediaInfo{}, 1)
	require.NoError(t, err)
	r.OnCleanup()
	t.Run("cancelled", func(t *testing.T) { require.Equal(t, DriveSubtitlesFailed, r.DriveSubtitleStatus(path).State) })
	require.Equal(t, DriveSubtitlesQueued, other.DriveSubtitleStatus(path).State, "closing one repository must not cancel another")
	other.CancelDriveSubtitleExtraction(path)
	other.OnCleanup()
	require.Equal(t, DriveSubtitlesFailed, other.DriveSubtitleStatus(path).State)
	t.Run("rejected", func(t *testing.T) {
		_, err := r.StartDriveSubtitleExtraction(path, "unused", &videofile.MediaInfo{}, 1)
		require.Error(t, err)
	})
}
