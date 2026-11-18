package handlers

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsGzipSkippedPath(t *testing.T) {
	// Binary media & real-time streaming routes must skip GZIP to save CPU
	assert.True(t, isGzipSkippedPath("/api/v1/mediastream/direct/play"))
	assert.True(t, isGzipSkippedPath("/api/v1/mediastream/transcode/segment_001.ts"))
	assert.True(t, isGzipSkippedPath("/api/v1/mediastream/hls/master.m3u8"))
	assert.True(t, isGzipSkippedPath("/api/v1/mediastream/att/1"))
	assert.True(t, isGzipSkippedPath("/api/v1/drive/play"))
	assert.True(t, isGzipSkippedPath("/api/v1/video-thumbnail"))
	assert.True(t, isGzipSkippedPath("/api/v1/image-proxy"))
	assert.True(t, isGzipSkippedPath("/api/v1/events"))
	assert.True(t, isGzipSkippedPath("/api/v1/ws"))

	// Subtitles and JSON metadata endpoints under mediastream MUST NOT be skipped
	// so that they receive GZIP compression over Wi-Fi
	assert.False(t, isGzipSkippedPath("/api/v1/mediastream/subtitles"))
	assert.False(t, isGzipSkippedPath("/api/v1/mediastream/subs"))
	assert.False(t, isGzipSkippedPath("/api/v1/mediastream/request"))
	assert.False(t, isGzipSkippedPath("/api/v1/mediastream/skip-times"))
	assert.False(t, isGzipSkippedPath("/api/v1/mediastream/settings"))
	assert.False(t, isGzipSkippedPath("/api/v1/mediastream/ffmpeg/status"))

	// General API endpoints must also not be skipped
	assert.False(t, isGzipSkippedPath("/api/v1/library/collection"))
}
