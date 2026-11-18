package handlers

import (
	"net/url"
	"testing"
	"time"

	"kamehouse/internal/core"
	"kamehouse/internal/drive"
	"kamehouse/internal/mediastream/videofile"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

func TestDriveInputURLVersionsMediaIdentityForSameSizeReplacement(t *testing.T) {
	logger := zerolog.Nop()
	service := drive.NewService(&logger)
	require.NoError(t, service.UpdateConfig(true, "fixture-client", "fixture-secret", "fixture-refresh", "fixture-folder", ""))
	client, err := service.GetClient()
	require.NoError(t, err)
	t.Cleanup(client.Close)
	cfg := &core.Config{}
	cfg.Server.Host, cfg.Server.Port = "127.0.0.1", 43212
	h := &Handler{App: &core.App{CoreServices: core.CoreServices{Config: cfg}}}
	h.App.DriveService = service
	key := driveRevisionKey{client, "fixtureID"}
	t.Cleanup(func() { driveRevisions.Delete(key) })
	f := drive.DriveFile{ID: "fixtureID", Size: 100, MD5Checksum: "old-checksum", ModifiedTime: time.Unix(100, 0)}
	driveRevisions.SetT(key, f, time.Minute)
	first := h.driveInputURL("gdrive://fixtureID/episode.mkv")
	u, err := url.Parse(first)
	require.NoError(t, err)
	require.Equal(t, driveFileRevision(&f), u.Query().Get("revision"))
	firstHash, err := videofile.GetHashFromPath(first)
	require.NoError(t, err)
	f.MD5Checksum = "new-checksum"
	driveRevisions.SetT(key, f, time.Minute)
	second := h.driveInputURL("gdrive://fixtureID/episode.mkv")
	secondHash, err := videofile.GetHashFromPath(second)
	require.NoError(t, err)
	require.NotEqual(t, firstHash, secondHash, "media info and keyframes must not reuse the old revision")
}
