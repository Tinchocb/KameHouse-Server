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

func TestMetadataParser_ExtractSubtitles(t *testing.T) {
	if _, err := os.Stat(testFile); os.IsNotExist(err) {
		t.Skip("Test file not found, skipping test")
		return
	}

	file, err := os.Open(testFile)
	require.NoError(t, err)
	defer file.Close()

	logger := util.NewLogger()
	parser := NewMetadataParser(file, logger)

	// First get metadata to know available tracks
	ctx := context.Background()
	metadata := parser.GetMetadata(ctx)
	require.NoError(t, metadata.Error)

	if len(metadata.SubtitleTracks) == 0 {
		t.Skip("No subtitle tracks found, skipping subtitle extraction test")
		return
	}

	t.Logf("Found %d subtitle tracks", len(metadata.SubtitleTracks))

	// Open a new reader for subtitle extraction
	newFile, err := os.Open(testFile)
	require.NoError(t, err)
	defer newFile.Close()

	// Extract subtitles from the beginning
	subtitleCh, errCh, startedCh := parser.ExtractSubtitles(ctx, newFile, 123000000, 1024*1024)

	<-startedCh

	subtitleCount := 0
	maxSubtitles := 10 // Only check first 10 subtitles

	for subtitleCount < maxSubtitles {
		select {
		case subtitle, ok := <-subtitleCh:
			if !ok {
				t.Log("Subtitle channel closed")
				goto done
			}
			if subtitle != nil {
				subtitleCount++
				t.Logf("Subtitle %d: Track=%d, StartTime=%.2f, Duration=%.2f, Text=%q",
					subtitleCount, subtitle.TrackNumber, subtitle.StartTime, subtitle.Duration,
					truncateString(subtitle.Text, 50))
				assert.Greater(t, subtitle.StartTime, -1.0, "Start time should be valid")
			}
		case err, ok := <-errCh:
			if !ok {
				t.Log("Error channel closed")
				goto done
			}
			if err != nil {
				t.Logf("Subtitle extraction completed with: %v", err)
				goto done
			}
		}
	}

done:
	t.Logf("Extracted %d subtitle events", subtitleCount)
	assert.Greater(t, subtitleCount, 0, "Should have extracted at least one subtitle")
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
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

func TestConvertSRTToASS(t *testing.T) {
	srt := `1
00:00:00,000 --> 00:00:03,000
Hello, world!

2
00:00:04,000 --> 00:00:06,000
This is a <--> test.
`
	out, err := ConvertToASS(srt, SubtitleTypeSRT)
	require.NoError(t, err)

	require.Equal(t, `[Script Info]
PlayResX: 640
PlayResY: 360
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Alignment, Angle, BackColour, Bold, BorderStyle, Encoding, Fontname, Fontsize, Italic, MarginL, MarginR, MarginV, Outline, OutlineColour, PrimaryColour, ScaleX, ScaleY, SecondaryColour, Shadow, Spacing, Strikeout, Underline
Style: Default,2,0.000,&He1000000,0,1,0,Roboto Medium,24.000,0,20,20,23,1.300,&H00000000,&H00ffffff,100.000,100.000,&H000000ff,1.000,0.000,0,0

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,00:00:00.00,00:00:03.00,Default,,0,0,0,,Hello, world!
Dialogue: 0,00:00:04.00,00:00:06.00,Default,,0,0,0,,This is a <--> test.
`, out)
}
