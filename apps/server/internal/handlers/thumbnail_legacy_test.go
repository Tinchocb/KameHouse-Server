package handlers

import (
	"context"
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestThumbnailDoesNotPromoteUnversionedLegacyImage(t *testing.T) {
	app, dir := setupTestApp(t)
	app.Config.Cache.Dir = filepath.Join(dir, "cache")
	cacheDir := filepath.Join(app.Config.Cache.Dir, "thumbnails")
	require.NoError(t, os.MkdirAll(cacheDir, 0700))
	path := filepath.Join(dir, "replaced.mkv")
	legacy := filepath.Join(cacheDir, fmt.Sprintf("%x.jpg", sha256.Sum256([]byte(path))))
	require.NoError(t, os.WriteFile(legacy, []byte("old-image"), 0600))
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	_, err := (&Handler{App: app}).ensureThumbnailFile(ctx, path, "new-revision", nil)
	require.ErrorIs(t, err, context.Canceled)
	require.NoFileExists(t, filepath.Join(cacheDir, "new-revision.jpg"))
	require.FileExists(t, legacy)
}
