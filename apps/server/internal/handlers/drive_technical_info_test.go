package handlers

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/mediastream/videofile"
)

func TestDriveProbeReplacesAssumedCodecAndInvalidatesFileCache(t *testing.T) {
	a, _ := setupTestApp(t)
	waitSettingsMigrations(t, a.Database)
	previous := &dto.FileTechnicalInfo{
		Size: 1000, VideoStream: &dto.VideoStreamInfo{Codec: "h264", Width: 3840, Height: 2080},
		AudioStreams:      []*dto.AudioStreamInfo{{Codec: "aac"}},
		ExternalSubtitles: []*dto.ExternalSubtitle{{Filename: "movie.es.srt", Language: "es"}},
	}
	raw, err := json.Marshal(previous)
	require.NoError(t, err)
	f := models.LocalFile{Path: "gdrive://movie/Movie.mkv", MediaID: 123, TechnicalInfo: raw}
	require.NoError(t, a.Database.Gorm().Create(&f).Error)
	db.InvalidateLocalFilesCache(a.Database)
	before, err := db.GetLocalFilesByMediaID(a.Database, 123)
	require.NoError(t, err)
	require.Len(t, before, 1)
	format, language, title := "matroska,webm", "es", "Latino"
	info := &videofile.MediaInfo{
		Size: 1000, Duration: 3111.5, Container: &format,
		Video:  &videofile.Video{Codec: "hevc", Width: 3840, Height: 2080, PixFmt: "yuv420p10le"},
		Audios: []videofile.Audio{{Codec: "ac3", Language: &language, Title: &title}},
	}
	h := &Handler{App: a}
	h.persistDriveTechnicalInfo(f.ID, previous, info)
	require.False(t, previous.ProbeVerified)
	require.Equal(t, "h264", previous.VideoStream.Codec)
	require.Equal(t, "aac", previous.AudioStreams[0].Codec)
	var stored models.LocalFile
	require.NoError(t, a.Database.Gorm().First(&stored, f.ID).Error)
	var actual dto.FileTechnicalInfo
	require.NoError(t, json.Unmarshal(stored.TechnicalInfo, &actual))
	require.True(t, actual.ProbeVerified)
	require.Equal(t, "hevc", actual.VideoStream.Codec)
	require.Equal(t, "ac3", actual.AudioStreams[0].Codec)
	require.Equal(t, "es", actual.AudioStreams[0].Language)
	require.Equal(t, 3111*time.Second+500*time.Millisecond, actual.Duration)
	require.Equal(t, previous.ExternalSubtitles, actual.ExternalSubtitles)
	after, err := db.GetLocalFilesByMediaID(a.Database, 123)
	require.NoError(t, err)
	require.Len(t, after, 1)
	require.Equal(t, "hevc", after[0].TechnicalInfo.VideoStream.Codec)
	require.Equal(t, "h264", before[0].TechnicalInfo.VideoStream.Codec, "published snapshot mutated")
	// The helper used by both direct and HLS must persist later real changes too.
	info.Video.Codec = "av1"
	h.persistDriveMediaInfo(context.Background(), f.Path, info)
	require.NoError(t, a.Database.Gorm().First(&stored, f.ID).Error)
	require.NoError(t, json.Unmarshal(stored.TechnicalInfo, &actual))
	require.Equal(t, "av1", actual.VideoStream.Codec)
	// Partial/failed probes must never promote legacy metadata to verified.
	previousRaw := append([]byte(nil), stored.TechnicalInfo...)
	h.persistDriveMediaInfo(context.Background(), f.Path, &videofile.MediaInfo{})
	require.NoError(t, a.Database.Gorm().First(&stored, f.ID).Error)
	require.Equal(t, previousRaw, []byte(stored.TechnicalInfo))
}
