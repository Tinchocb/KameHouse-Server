package scanner

import (
	"testing"
	"time"

	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

func TestBackgroundProbePreservesManualAssignments(t *testing.T) {
	database := newPersistenceTestDB(t)
	stored := &models.LocalFile{Path: "episode.mp4", MediaID: 900, Locked: true, Ignored: true, FileSize: 500, FileModTime: 100, Tags: models.StringSlice{"keep"}}
	require.NoError(t, database.Gorm().Create(stored).Error)
	logger := zerolog.Nop()
	queue := NewBackgroundQueue(database, nil, &logger, "configured")
	defer queue.Stop()
	stale := &dto.LocalFile{Path: stored.Path, MediaID: 100, FileSize: 500, FileModTime: 100, TechnicalInfo: &dto.FileTechnicalInfo{Duration: time.Minute}}
	// No external process is needed: this probe leaves the supplied technical
	// result unchanged, then exercises the real queue persistence path.
	queue.processFile(&FileProber{Logger: &logger}, stale)
	var got models.LocalFile
	require.NoError(t, database.Gorm().Where("path = ?", stored.Path).First(&got).Error)
	require.Equal(t, 900, got.MediaID)
	require.True(t, got.Locked)
	require.True(t, got.Ignored)
	require.Equal(t, models.StringSlice{"keep"}, got.Tags)
	require.NotEmpty(t, got.TechnicalInfo)
}

func TestBackgroundQueueOwnsEnqueuedMetadata(t *testing.T) {
	logger := zerolog.Nop()
	queue := NewBackgroundQueue(nil, nil, &logger, "")
	defer queue.Stop()
	file := &dto.LocalFile{Path: "episode.mkv", Metadata: &dto.LocalFileMetadata{Episode: 1}}
	queue.Enqueue(file)
	file.Metadata.Episode = 99
	queued := <-queue.jobChan
	require.Equal(t, 1, queued.Metadata.Episode)
}
