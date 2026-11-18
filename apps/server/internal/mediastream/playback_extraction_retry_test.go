package mediastream

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"kamehouse/internal/database/models"
	"kamehouse/internal/mediastream/videofile"

	"github.com/samber/mo"
	"github.com/stretchr/testify/require"
)

func TestCachedPlaybackRetriesFailedAttachmentExtraction(t *testing.T) {
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg not available")
	}
	r := newDriveSubsRepo(t, "missing-ffmpeg")
	input := filepath.Join(t.TempDir(), "input.srt")
	require.NoError(t, os.WriteFile(input, []byte("1\n00:00:00,100 --> 00:00:01,500\nretry succeeded\n\n"), 0600))
	hash, err := videofile.GetHashFromPath(input)
	require.NoError(t, err)
	ext := "srt"
	container := &MediaContainer{Filepath: input, Hash: hash, StreamType: StreamTypeDirect, MediaInfo: &videofile.MediaInfo{Subtitles: []videofile.Subtitle{{Index: 0, Extension: &ext}}}}
	p := r.playbackManager
	p.mediaContainers.Set(hash+"|legacy", container)
	_, err = p.newMediaContainer(input, StreamTypeDirect, nil, true)
	require.NoError(t, err)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	require.NoError(t, p.WaitForExtraction(ctx, hash))
	require.False(t, videofile.AttachmentsComplete(r.CacheDir(), hash))
	r.settingsMu.Lock()
	r.settings = mo.Some(&models.MediastreamSettings{FfmpegPath: ffmpeg})
	r.settingsMu.Unlock()
	_, err = p.newMediaContainer(input, StreamTypeDirect, nil, true)
	require.NoError(t, err)
	require.NoError(t, p.WaitForExtraction(ctx, hash))
	require.True(t, videofile.AttachmentsComplete(r.CacheDir(), hash))
	raw, err := os.ReadFile(filepath.Join(videofile.GetFileSubsCacheDir(r.CacheDir(), hash), "0.srt"))
	require.NoError(t, err)
	require.True(t, strings.Contains(string(raw), "retry succeeded"))
}

func TestDriveSubtitleRevisionDoesNotReuseOldCompletion(t *testing.T) {
	r := newDriveSubsRepo(t, "unused")
	path := "gdrive://sameID/episode.mkv"
	r.SetDriveRevision("sameID", "old")
	oldHash := r.driveSubtitleHash(path)
	r.SetDriveRevision("sameID", "new")
	require.NotEqual(t, oldHash, r.driveSubtitleHash(path))
	r.SetDriveRevision("sameID", "old")
	require.Equal(t, oldHash, r.driveSubtitleHash(path))
}
