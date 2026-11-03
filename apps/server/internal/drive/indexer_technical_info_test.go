package drive

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
)

func TestDriveRescanPreservesOnlyVerifiedUnchangedTechnicalInfo(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, db.AutoMigrate(&models.LocalFile{}, &models.LibraryMedia{}, &models.LibraryEpisode{}))
	f := DriveFile{
		ID: "movie", Name: "Dragon Ball Z - El Ataque Del Dragón.mkv",
		RelativePath: "(1989-1996) Dragon Ball Z/Películas de Dragon Ball Z/Dragon Ball Z - El Ataque Del Dragón.mkv",
		MD5Checksum:  "original", Size: 1000, Width: 3840, Height: 2080,
		ModifiedTime: time.Unix(1000, 0),
	}
	index := func() dto.FileTechnicalInfo {
		t.Helper()
		_, err := IndexDriveFiles(context.Background(), db, []DriveFile{f}, IndexHooks{})
		require.NoError(t, err)
		var row models.LocalFile
		require.NoError(t, db.Where("path = ?", DrivePath(f)).First(&row).Error)
		var info dto.FileTechnicalInfo
		require.NoError(t, json.Unmarshal(row.TechnicalInfo, &info))
		return info
	}
	initial := index()
	require.NotNil(t, initial.VideoStream)
	require.Empty(t, initial.VideoStream.Codec, "dimensions do not establish H.264")
	verified := dto.FileTechnicalInfo{
		ProbeVerified: true, Size: 1000,
		VideoStream:  &dto.VideoStreamInfo{Codec: "hevc", Width: 3840, Height: 2080},
		AudioStreams: []*dto.AudioStreamInfo{{Codec: "ac3", Language: "es"}},
	}
	setInfo := func(info dto.FileTechnicalInfo) {
		t.Helper()
		raw, err := json.Marshal(info)
		require.NoError(t, err)
		require.NoError(t, db.Model(&models.LocalFile{}).Where("path = ?", DrivePath(f)).Update("technical_info", raw).Error)
	}
	setInfo(verified)
	require.Equal(t, verified, index(), "rescan overwrote an FFprobe result")
	// Old H.264 placeholders must be discarded, even when audio was discovered.
	legacy := verified
	legacy.ProbeVerified = false
	legacy.VideoStream = &dto.VideoStreamInfo{Codec: "h264"}
	setInfo(legacy)
	require.Empty(t, index().VideoStream.Codec)
	// File replacement invalidates the previous probe, independently of size.
	setInfo(verified)
	f.MD5Checksum = "replacement"
	require.False(t, index().ProbeVerified)
	setInfo(verified)
	f.ModifiedTime = f.ModifiedTime.Add(time.Second)
	require.False(t, index().ProbeVerified)
	setInfo(verified)
	f.Size++
	require.False(t, index().ProbeVerified)
	// A malformed legacy value cannot break the upsert's JSON predicate.
	require.NoError(t, db.Model(&models.LocalFile{}).Where("path = ?", DrivePath(f)).Update("technical_info", []byte("broken")).Error)
	require.Empty(t, index().VideoStream.Codec)
}
