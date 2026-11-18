package db

import (
	"context"
	"testing"
	"time"

	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"

	"github.com/stretchr/testify/require"
)

func TestProbeUpdateDoesNotReviveDeletedOrReplacedFiles(t *testing.T) {
	d := openSettingsTestDB(t)
	require.NoError(t, d.Gorm().AutoMigrate(&models.LocalFile{}))
	file := &dto.LocalFile{Path: "episode.mkv", FileSize: 100, FileModTime: 10, TechnicalInfo: &dto.FileTechnicalInfo{Duration: time.Minute}}
	updated, err := UpdateLocalFileProbe(t.Context(), d, file)
	require.NoError(t, err)
	require.False(t, updated)
	stored := &models.LocalFile{Path: file.Path, FileSize: 200, FileModTime: 11, TechnicalInfo: []byte(`{"duration":120}`)}
	require.NoError(t, d.Gorm().Create(stored).Error)
	updated, err = UpdateLocalFileProbe(t.Context(), d, file)
	require.NoError(t, err)
	require.False(t, updated)
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	_, err = UpdateLocalFileProbe(ctx, d, file)
	require.ErrorIs(t, err, context.Canceled)
	var got models.LocalFile
	require.NoError(t, d.Gorm().First(&got, stored.ID).Error)
	require.JSONEq(t, `{"duration":120}`, string(got.TechnicalInfo))
}
