package handlers

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestManualThumbnailClearForgetsLocalAndDriveFailures(t *testing.T) {
	thumbnailFailed.SetT("local-failed", true, thumbnailFailedTTL)
	driveThumbMissing.SetT("drive-missing", true, driveThumbMissingTTL)
	clearThumbnailFailures()
	require.False(t, thumbnailFailedRecently("local-failed"))
	_, found := driveThumbMissing.Get("drive-missing")
	require.False(t, found, "a manual cache purge must allow retrying a Drive preview too")
}
