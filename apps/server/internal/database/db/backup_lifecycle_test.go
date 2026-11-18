package db

import (
	"context"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type backupWaitContext struct {
	context.Context
	checked chan struct{}
	once    sync.Once
}

func (ctx *backupWaitContext) Err() error {
	err := ctx.Context.Err()
	ctx.once.Do(func() { close(ctx.checked) })
	return err
}

func TestBackupCancelsWhileAnotherBackupHoldsTheLock(t *testing.T) {
	database := openSettingsTestDB(t)
	database.sqlitePath = filepath.Join(t.TempDir(), "source.db")
	dir := t.TempDir()
	database.backupMu.Lock()
	ctx, cancel := context.WithCancel(t.Context())
	waiting := &backupWaitContext{Context: ctx, checked: make(chan struct{})}
	result := make(chan error, 1)
	go func() { _, err := database.BackupContext(waiting, dir, 5); result <- err }()
	<-waiting.checked
	cancel()
	// Hold the lock even after cancellation: the wait itself must be interruptible.
	select {
	case err := <-result:
		database.backupMu.Unlock()
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(300 * time.Millisecond):
		database.backupMu.Unlock()
		<-result
		t.Fatal("cancelled backup remained blocked behind the active backup")
	}
	files, err := os.ReadDir(dir)
	require.NoError(t, err)
	require.Empty(t, files)
}

func TestRepeatedBackupsAreDistinctAndVerified(t *testing.T) {
	database := openSettingsTestDB(t)
	database.sqlitePath = filepath.Join(t.TempDir(), "source.db")
	dir := t.TempDir()
	paths := make(map[string]bool)
	for range 3 {
		backup, err := database.BackupContext(t.Context(), dir, 0)
		require.NoError(t, err)
		require.False(t, paths[backup.Path])
		paths[backup.Path] = true
		require.NoError(t, verifyBackupIntegrityContext(t.Context(), backup.Path))
	}
}

func TestCancelledBackupLeavesNoPublishedOrTemporaryFile(t *testing.T) {
	database := openSettingsTestDB(t)
	database.sqlitePath = filepath.Join(t.TempDir(), "source.db")
	dir := t.TempDir()
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	_, err := database.BackupContext(ctx, dir, 5)
	require.ErrorIs(t, err, context.Canceled)
	files, err := os.ReadDir(dir)
	require.NoError(t, err)
	require.Empty(t, files)
}
