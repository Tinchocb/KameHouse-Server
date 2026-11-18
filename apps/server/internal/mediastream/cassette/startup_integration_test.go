package cassette

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"kamehouse/internal/mediastream/videofile"
)

// Model a bandwidth-limited remote source without Google credentials or user
// media. This exercises real ffprobe, playlists, FFmpeg and a decodable frame;
// it does not measure browser rendering or the real Drive service.
func TestPlaybackStartOverThrottledHTTP(t *testing.T) {
	if testing.Short() {
		t.Skip("real FFmpeg and throttled HTTP integration")
	}
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg unavailable")
	}
	ffprobe, err := exec.LookPath("ffprobe")
	if err != nil {
		t.Skip("ffprobe unavailable")
	}
	ctx, cancel := context.WithTimeout(t.Context(), time.Minute)
	defer cancel()
	dir := t.TempDir()
	source := filepath.Join(dir, "source.mp4")
	cmd := exec.CommandContext(ctx, ffmpeg, "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "90", "-c:v", "libx264", "-preset", "ultrafast", "-g", "48", "-keyint_min", "48", "-sc_threshold", "0", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", source)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("fixture: %v %s", err, out)
	}
	stat, err := os.Stat(source)
	if err != nil {
		t.Fatal(err)
	}
	var requests atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		file, err := os.Open(source)
		if err != nil {
			http.Error(w, "fixture unavailable", 500)
			return
		}
		defer file.Close()
		http.ServeContent(&startupThrottledWriter{ResponseWriter: w, ctx: r.Context()}, r, "source.mp4", stat.ModTime(), file)
	}))
	defer server.Close()
	url := server.URL + "/source.mp4"
	logger := zerolog.Nop()
	c, err := New(&NewCassetteOptions{Logger: &logger, HwAccelKind: "disabled", TempOutDir: dir, FfmpegPath: ffmpeg, FfprobePath: ffprobe, MaxConcurrency: 2})
	if err != nil {
		t.Fatal(err)
	}
	defer c.Destroy()
	start := time.Now()
	info, err := videofile.FfprobeGetInfoContext(ctx, ffprobe, url, "isolated-startup")
	if err != nil {
		t.Fatal(err)
	}
	probeElapsed := time.Since(start)
	session, err := c.getSession(ctx, url, "isolated-startup-"+filepath.Base(dir), info)
	if err != nil {
		t.Fatal(err)
	}
	readyElapsed := time.Since(start)
	_, completeAtReady := session.Keyframes.Length()
	if completeAtReady {
		t.Fatal("playback waited for the entire remote keyframe scan")
	}
	if playlist, err := session.GetVideoIndex(Source, ""); err != nil {
		t.Fatal(err)
	} else if !strings.Contains(playlist, "segment-0.ts") || strings.Contains(playlist, "#EXT-X-ENDLIST") {
		t.Fatalf("invalid progressive playlist: %s", playlist)
	}
	segment, err := session.GetVideoSegment(ctx, Source, 0)
	if err != nil {
		t.Fatal(err)
	}
	segmentElapsed := time.Since(start)
	decode := exec.CommandContext(ctx, ffmpeg, "-v", "error", "-i", segment, "-frames:v", "1", "-f", "null", "-")
	if out, err := decode.CombinedOutput(); err != nil {
		t.Fatalf("first frame: %v %s", err, out)
	}
	frameElapsed := time.Since(start)
	if len(info.Audios) != 1 {
		t.Fatalf("fixture audio: %+v", info.Audios)
	}
	audio := int32(info.Audios[0].Index)
	if _, err := session.GetAudioIndex(audio, ""); err != nil {
		t.Fatal(err)
	}
	audioSegment, err := session.GetAudioSegment(ctx, audio, 0)
	if err != nil {
		t.Fatal(err)
	}
	checkStartupSegment(t, ctx, ffmpeg, audioSegment, "audio")
	avElapsed := time.Since(start)
	// Cross the first early head's boundary while the index continues growing.
	nextVideo, err := session.GetVideoSegment(ctx, Source, 1)
	if err != nil {
		t.Fatal(err)
	}
	checkStartupSegment(t, ctx, ffmpeg, nextVideo, "video")
	nextAudio, err := session.GetAudioSegment(ctx, audio, 1)
	if err != nil {
		t.Fatal(err)
	}
	checkStartupSegment(t, ctx, ffmpeg, nextAudio, "audio")
	warmStart := time.Now()
	warmSession, err := c.getSession(ctx, url, session.hash, info)
	if err != nil {
		t.Fatal(err)
	}
	warmSegment, err := warmSession.GetVideoSegment(ctx, Source, 0)
	if err != nil || warmSegment != segment {
		t.Fatalf("warm segment: %s %v", warmSegment, err)
	}
	warmElapsed := time.Since(warmStart)
	// Let the shared index finish before tearing down its HTTP source and temp
	// directory. Playback readiness must not truncate the durable full index.
	for {
		_, done := session.Keyframes.Length()
		if done {
			break
		}
		select {
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		case <-time.After(10 * time.Millisecond):
		}
	}
	if err := session.Keyframes.GetError(); err != nil {
		t.Fatal(err)
	}
	count, done := session.Keyframes.Length()
	if !done || count != 45 {
		t.Fatalf("truncated keyframe index: %d %t", count, done)
	}
	if playlist, err := session.GetVideoIndex(Source, ""); err != nil || !strings.Contains(playlist, "#EXT-X-ENDLIST") {
		t.Fatalf("unfinished playlist: %v %s", err, playlist)
	}
	// Seek well beyond the early timestamps and decode both actual outputs.
	lateVideo, err := session.GetVideoSegment(ctx, Source, 30)
	if err != nil {
		t.Fatal(err)
	}
	checkStartupSegment(t, ctx, ffmpeg, lateVideo, "video")
	lateAudio, err := session.GetAudioSegment(ctx, audio, 30)
	if err != nil {
		t.Fatal(err)
	}
	checkStartupSegment(t, ctx, ffmpeg, lateAudio, "audio")
	// Joining IsDone alone is insufficient: the background disk write follows it.
	diskPath := filepath.Join(c.settings.KeyframeCacheDir, session.hash+".json")
	for {
		var saved KeyframeIndex
		if err := getSavedInfo(diskPath, &saved); err == nil && saved.IsDone && len(saved.Keyframes) == int(count) {
			break
		}
		select {
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		case <-time.After(10 * time.Millisecond):
		}
	}
	session.Kill()
	ClearKeyframeCache()
	before := requests.Load()
	diskStart := time.Now()
	diskIndex, err := getOrExtractKeyframes(url, session.hash, &c.settings, &logger)
	if err != nil {
		t.Fatal(err)
	}
	diskElapsed := time.Since(diskStart)
	if requests.Load() != before {
		t.Fatal("disk keyframe hit fetched remote source")
	}
	if !reflect.DeepEqual(diskIndex.Keyframes, session.Keyframes.Keyframes) {
		t.Fatal("persisted index differs from completed scan")
	}
	t.Logf("source_bytes=%d probe=%s hls_ready=%s first_segment=%s first_decodable_frame=%s audio_decoded=%s warm_segment=%s disk_index=%s complete_at_ready=%t full_keyframes=%d", stat.Size(), probeElapsed, readyElapsed, segmentElapsed, frameElapsed, avElapsed, warmElapsed, diskElapsed, completeAtReady, count)
}

func checkStartupSegment(t *testing.T, ctx context.Context, ffmpeg, path, kind string) {
	t.Helper()
	args := []string{"-v", "error", "-i", path}
	if kind == "audio" {
		args = append(args, "-map", "0:a:0", "-frames:a", "1")
	} else {
		args = append(args, "-map", "0:v:0", "-frames:v", "1")
	}
	args = append(args, "-f", "null", "-")
	if out, err := exec.CommandContext(ctx, ffmpeg, args...).CombinedOutput(); err != nil {
		t.Fatalf("%s segment decode: %v %s", kind, err, out)
	}
}

type startupThrottledWriter struct {
	http.ResponseWriter
	ctx context.Context
}

func (w *startupThrottledWriter) Write(data []byte) (int, error) {
	total := 0
	for len(data) > 0 {
		select {
		case <-w.ctx.Done():
			return total, w.ctx.Err()
		case <-time.After(15 * time.Millisecond):
		}
		n, err := w.ResponseWriter.Write(data[:min(len(data), 32<<10)])
		total += n
		data = data[n:]
		if f, ok := w.ResponseWriter.(http.Flusher); ok {
			f.Flush()
		}
		if err != nil {
			return total, err
		}
	}
	return total, nil
}
