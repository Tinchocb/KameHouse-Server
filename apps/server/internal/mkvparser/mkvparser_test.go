package mkvparser

import (
	"context"
	"kamehouse/internal/util"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var (
	testFile = ""
)

func TestMetadataParser_File(t *testing.T) {
	if _, err := os.Stat(testFile); os.IsNotExist(err) {
		t.Skip("Test file not found, skipping test")
		return
	}

	file, err := os.Open(testFile)
	require.NoError(t, err)
	defer file.Close()

	logger := util.NewLogger()
	parser := NewMetadataParser(file, logger)

	ctx := context.Background()
	metadata := parser.GetMetadata(ctx)

	require.NoError(t, metadata.Error)
	assert.NotNil(t, metadata)
	assert.Greater(t, len(metadata.Tracks), 0, "Should have at least one track")
	assert.Greater(t, metadata.Duration, 0.0, "Duration should be greater than 0")
}

func TestReadIsMkvOrWebm(t *testing.T) {
	if _, err := os.Stat(testFile); os.IsNotExist(err) {
		t.Skip("Test file not found, skipping test")
		return
	}

	file, err := os.Open(testFile)
	require.NoError(t, err)
	defer file.Close()

	mimeType, isMkv := ReadIsMkvOrWebm(file)
	assert.True(t, isMkv, "Should detect as MKV/WebM")
	assert.NotEmpty(t, mimeType, "Should return mime type")
	t.Logf("Detected mime type: %s", mimeType)
}
