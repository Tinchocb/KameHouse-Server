package storyboard

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestClearWaitsForProducerAndCountsCommittedOutput(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "storyboards")
	require.NoError(t, os.MkdirAll(dir, 0700))
	slot <- struct{}{}
	finished := make(chan struct{})
	go func() {
		defer close(finished)
		bytes, count, err := Clear(context.Background(), root)
		if err != nil || bytes != 3 || count != 1 {
			t.Errorf("clear: %d %d %v", bytes, count, err)
		}
	}()
	select {
	case <-finished:
		t.Fatal("clear passed active producer")
	case <-time.After(20 * time.Millisecond):
	}
	require.NoError(t, os.WriteFile(filepath.Join(dir, "committed.jpg"), []byte("jpg"), 0600))
	<-slot
	select {
	case <-finished:
	case <-time.After(time.Second):
		t.Fatal("clear did not complete")
	}
	entries, err := os.ReadDir(dir)
	require.NoError(t, err)
	require.Empty(t, entries)
}

func TestClearCanCancelWhileProducerActive(t *testing.T) {
	frameSlot <- struct{}{}
	defer func() { <-frameSlot }()
	ctx, cancel := context.WithTimeout(t.Context(), 20*time.Millisecond)
	defer cancel()
	_, _, err := Clear(ctx, t.TempDir())
	require.ErrorIs(t, err, context.DeadlineExceeded)
	require.Empty(t, slot, "first producer slot must be released on cancellation")
}
