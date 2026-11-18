package db

import (
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"kamehouse/internal/database/models/dto"
	"sync"
	"testing"
)

func TestLocalFilesIndexGenerationAndOwnership(t *testing.T) {
	logger := zerolog.Nop()
	d := &Database{Logger: &logger}
	files := []*dto.LocalFile{{Name: "a", MediaID: 7, Metadata: &dto.LocalFileMetadata{Episodes: []int{1}}}, nil, {Name: "b", MediaID: 8}, {Name: "c", MediaID: 7}}
	d.localFilesGeneration().snapshot.Store(&files)
	var wg sync.WaitGroup
	for range 16 {
		wg.Go(func() {
			got, err := GetLocalFilesByMediaID(d, 7)
			if err != nil || len(got) != 2 {
				t.Errorf("lookup: %+v %v", got, err)
				return
			}
			got[0].Metadata.Episodes[0] = 99
		})
	}
	wg.Wait()
	got, err := GetLocalFilesByMediaID(d, 7)
	require.NoError(t, err)
	require.Equal(t, []int{1}, got[0].Metadata.Episodes)
	require.Equal(t, "c", got[1].Name)
	absent, err := GetLocalFilesByMediaID(d, 99)
	require.NoError(t, err)
	require.Nil(t, absent)
	InvalidateLocalFilesCache(d)
	next := []*dto.LocalFile{{Name: "new", MediaID: 7}}
	d.localFilesGeneration().snapshot.Store(&next)
	got, err = GetLocalFilesByMediaID(d, 7)
	require.NoError(t, err)
	require.Len(t, got, 1)
	require.Equal(t, "new", got[0].Name)
}
