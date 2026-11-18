package handlers

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"kamehouse/internal/library/anime"
)

func TestPendingEntryPollDoesNotRebuildWhileMetadataMissing(t *testing.T) {
	var builds, polls atomic.Int32
	complete := &anime.Entry{MediaID: 42, Episodes: []*anime.Episode{{EpisodeNumber: 7}}}
	entry, err := resolvePendingAnimeEntry(t.Context(), func(context.Context) (*anime.Entry, error) {
		if builds.Add(1) == 1 {
			return &anime.Entry{MediaID: 42, MetadataPending: true}, nil
		}
		return complete, nil
	}, func() bool { return polls.Add(1) < 4 }, time.Second, time.Millisecond)
	require.NoError(t, err)
	require.Same(t, complete, entry)
	require.Equal(t, int32(4), polls.Load())
	require.Equal(t, int32(2), builds.Load(), "initial construction and ready result only, not each pending poll")
	require.Equal(t, 7, entry.Episodes[0].EpisodeNumber)
}

func TestPendingEntryBudgetDoesNotRebuildOrDropPendingState(t *testing.T) {
	builds := 0
	original := &anime.Entry{MediaID: 42, MetadataPending: true}
	entry, err := resolvePendingAnimeEntry(t.Context(), func(context.Context) (*anime.Entry, error) { builds++; return original, nil }, func() bool { return true }, 15*time.Millisecond, time.Millisecond)
	require.NoError(t, err)
	require.Same(t, original, entry)
	require.True(t, entry.MetadataPending)
	require.Equal(t, 1, builds)
}

func TestPendingEntryCancellationInterruptsWait(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	built := make(chan struct{})
	done := make(chan error, 1)
	go func() {
		_, err := resolvePendingAnimeEntry(ctx, func(context.Context) (*anime.Entry, error) {
			close(built)
			return &anime.Entry{MetadataPending: true}, nil
		}, func() bool { t.Error("polled after cancellation"); return true }, time.Minute, time.Minute)
		done <- err
	}()
	<-built
	cancel()
	select {
	case err := <-done:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(time.Second):
		t.Fatal("shutdown context did not interrupt polling wait")
	}
}

func TestPendingEntryPropagatesBuildError(t *testing.T) {
	want := errors.New("fixture query failure")
	_, err := resolvePendingAnimeEntry(t.Context(), func(context.Context) (*anime.Entry, error) { return nil, want }, func() bool { t.Error("unexpected metadata lookup"); return false }, time.Second, time.Millisecond)
	require.ErrorIs(t, err, want)
}

func TestRetiredAnimeEntryCannotPublish(t *testing.T) {
	ClearAnimeEntryCache()
	t.Cleanup(ClearAnimeEntryCache)
	_, old := cachedAnimeEntry(42)
	InvalidateAnimeEntryCache(42)
	_, current := cachedAnimeEntry(42)
	fresh := &anime.Entry{MediaID: 42, EntryListData: &anime.EntryListData{Progress: 7}}
	require.True(t, publishAnimeEntry(42, current, fresh))
	require.False(t, publishAnimeEntry(42, old, &anime.Entry{MediaID: 42, EntryListData: &anime.EntryListData{Progress: 1}}))
	got, _ := cachedAnimeEntry(42)
	require.Same(t, fresh, got)
	require.Equal(t, 7, got.EntryListData.Progress)
	ClearAnimeEntryCache()
	require.False(t, publishAnimeEntry(42, current, fresh))
}
