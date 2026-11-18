package scanner

import (
	"context"
	"encoding/binary"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"kamehouse/internal/database/models/dto"
)

func BenchmarkProbeFilesScheduling(b *testing.B) {
	logger := zerolog.Nop()
	p := NewFileProber("", &logger)
	for name, count := range map[string]int{"one": 1, "batch": 10000} {
		b.Run(name, func(b *testing.B) {
			files := make([]*dto.LocalFile, count)
			for i := range files {
				files[i] = &dto.LocalFile{Path: "fixture.mp4"}
			}
			b.ReportAllocs()
			for b.Loop() {
				p.ProbeFiles(context.Background(), files)
			}
		})
	}
}

func TestProbeReplacesStreamsAndPreservesFractionalDuration(t *testing.T) {
	probe, err := exec.LookPath("ffprobe")
	if err != nil {
		t.Skip("ffprobe unavailable")
	}
	// A 1.25 s PCM WAV, generated without external encoders.
	const samples = 10000
	wav := make([]byte, 44+samples*2)
	copy(wav[0:], "RIFF")
	binary.LittleEndian.PutUint32(wav[4:], uint32(len(wav)-8))
	copy(wav[8:], "WAVEfmt ")
	binary.LittleEndian.PutUint32(wav[16:], 16)
	binary.LittleEndian.PutUint16(wav[20:], 1)
	binary.LittleEndian.PutUint16(wav[22:], 1)
	binary.LittleEndian.PutUint32(wav[24:], 8000)
	binary.LittleEndian.PutUint32(wav[28:], 16000)
	binary.LittleEndian.PutUint16(wav[32:], 2)
	binary.LittleEndian.PutUint16(wav[34:], 16)
	copy(wav[36:], "data")
	binary.LittleEndian.PutUint32(wav[40:], samples*2)
	path := filepath.Join(t.TempDir(), "fractional.wav")
	require.NoError(t, os.WriteFile(path, wav, 0600))
	logger := zerolog.Nop()
	p := NewFileProber(probe, &logger)
	// Another scanner must not replace this instance's selected executable.
	_ = NewFileProber(filepath.Join(t.TempDir(), "missing-ffprobe"), &logger)
	old := &dto.FileTechnicalInfo{AudioStreams: []*dto.AudioStreamInfo{{Codec: "stale"}}, VideoStream: &dto.VideoStreamInfo{Codec: "stale-video"}, ExternalSubtitles: []*dto.ExternalSubtitle{{Path: "external.srt"}}}
	file := &dto.LocalFile{Path: path, TechnicalInfo: old}
	p.probeWithFFprobe(t.Context(), file)
	require.Len(t, file.TechnicalInfo.AudioStreams, 1)
	require.Nil(t, file.TechnicalInfo.VideoStream)
	require.Equal(t, 1250*time.Millisecond, file.TechnicalInfo.Duration)
	require.Equal(t, "stale", old.AudioStreams[0].Codec, "publishing a probe must not mutate the previous snapshot")
	require.NotSame(t, old, file.TechnicalInfo)
	require.Len(t, old.AudioStreams, 1)
	require.Zero(t, old.Duration)
	require.Equal(t, "external.srt", file.TechnicalInfo.ExternalSubtitles[0].Path)
	p.probeWithFFprobe(t.Context(), file)
	require.Len(t, file.TechnicalInfo.AudioStreams, 1, "reprobing must not accumulate streams")
	previous := file.TechnicalInfo
	file.Path = filepath.Join(filepath.Dir(path), "missing.wav")
	p.probeWithFFprobe(t.Context(), file)
	require.Same(t, previous, file.TechnicalInfo, "a failed probe must preserve the previous result")
}
