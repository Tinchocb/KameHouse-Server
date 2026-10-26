package pretranscode

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"kamehouse/internal/mediastream/videofile"

	"github.com/rs/zerolog"
)

// The master lists one EXT-X-MEDIA per source track, in source order, with the flagged
// default track as DEFAULT=YES. The player switches tracks from these entries.
func TestMasterPlaylistListsEveryAudioRendition(t *testing.T) {
	src := sourceStreams{
		Width:  1280,
		Height: 720,
		Audio: []sourceAudio{
			{Language: "spa"},
			{Title: "Japones", Language: "jpn", IsDefault: true},
			{Title: `Comentario "director"`, Language: "und"},
		},
	}

	got := masterPlaylist(src, 2_500_000)

	wantLines := []string{
		"#EXTM3U",
		`#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="Audio 1",LANGUAGE="spa",DEFAULT=NO,AUTOSELECT=YES,CHANNELS="2",URI="a0/index.m3u8"`,
		`#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="Japones",LANGUAGE="jpn",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2",URI="a1/index.m3u8"`,
		`#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="Comentario 'director'",DEFAULT=NO,AUTOSELECT=YES,CHANNELS="2",URI="a2/index.m3u8"`,
		`#EXT-X-STREAM-INF:BANDWIDTH=2500000,AVERAGE-BANDWIDTH=2500000,RESOLUTION=1280x720,CODECS="avc1.640028,mp4a.40.2",AUDIO="aud"`,
		"v/index.m3u8",
	}
	for _, want := range wantLines {
		if !strings.Contains(got, want+"\n") {
			t.Errorf("master is missing %q:\n%s", want, got)
		}
	}
}

// A file without audio still gets a playable master: no rendition group, video codec only.
func TestMasterPlaylistWithoutAudio(t *testing.T) {
	got := masterPlaylist(sourceStreams{Width: 320, Height: 180}, 500_000)

	if strings.Contains(got, "EXT-X-MEDIA") || strings.Contains(got, `AUDIO="aud"`) {
		t.Errorf("a file with no audio must not reference audio renditions:\n%s", got)
	}
	if !strings.Contains(got, `CODECS="avc1.640028"`) {
		t.Errorf("video-only master must declare the video codec alone:\n%s", got)
	}
}

func TestVariantStreamMap(t *testing.T) {
	if got := variantStreamMap(0); got != "v:0,name:v" {
		t.Errorf("no audio: got %q", got)
	}
	want := "v:0,agroup:aud,name:v a:0,agroup:aud,name:a0 a:1,agroup:aud,name:a1"
	if got := variantStreamMap(2); got != want {
		t.Errorf("two audio tracks: got %q, want %q", got, want)
	}
}

func TestPlaylistDuration(t *testing.T) {
	path := filepath.Join(t.TempDir(), "index.m3u8")
	playlist := "#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6.000000,\nseg0.ts\n#EXTINF:5.500000,\nseg1.ts\n#EXT-X-ENDLIST\n"
	if err := os.WriteFile(path, []byte(playlist), 0644); err != nil {
		t.Fatal(err)
	}

	got, err := playlistDuration(path)
	if err != nil {
		t.Fatalf("playlistDuration: %v", err)
	}
	if got != 11.5 {
		t.Errorf("duration = %v, want 11.5", got)
	}
}

// makeMultiTrackVideo renders a clip with three audio tracks (spa, jpn, eng), the shape
// of a dubbed episode, so the test checks one rendition per track.
func makeMultiTrackVideo(t *testing.T, dir string) string {
	t.Helper()

	path := filepath.Join(dir, "multi.mkv")
	cmd := exec.Command("ffmpeg",
		"-y", "-hide_banner", "-loglevel", "error",
		"-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24:duration=12",
		"-f", "lavfi", "-i", "sine=frequency=440:duration=12",
		"-f", "lavfi", "-i", "sine=frequency=660:duration=12",
		"-f", "lavfi", "-i", "sine=frequency=880:duration=12",
		"-map", "0:v", "-map", "1:a", "-map", "2:a", "-map", "3:a",
		"-metadata:s:a:0", "language=spa", "-metadata:s:a:0", "title=Latino",
		"-metadata:s:a:1", "language=jpn", "-metadata:s:a:1", "title=Japones",
		"-metadata:s:a:2", "language=eng",
		"-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
		path,
	)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Skipf("could not render a multi-track sample with ffmpeg: %v: %s", err, out)
	}
	return path
}

// TestPreTranscodeKeepsEveryAudioTrack runs a real encode of a three-track file and
// checks the output: one rendition per track, each decodable as audio, and ready for
// a file with those three tracks.
func TestPreTranscodeKeepsEveryAudioTrack(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed")
	}

	work := t.TempDir()
	src := makeMultiTrackVideo(t, work)

	logger := zerolog.Nop()
	m := New(Options{
		Logger:      &logger,
		OutputDir:   filepath.Join(work, "out"),
		FfmpegPath:  "ffmpeg",
		FfprobePath: "ffprobe",
	})
	m.Start()
	defer m.Stop()

	job, err := m.Enqueue(src)
	if err != nil {
		t.Fatalf("Enqueue: %v", err)
	}
	final := waitForTerminal(t, m, job.Hash, 180*time.Second)
	if final.Status != StatusCompleted {
		t.Fatalf("job did not complete: status=%q error=%q", final.Status, final.Error)
	}

	outDir := m.OutputDirFor(job.Hash)
	master, err := os.ReadFile(filepath.Join(outDir, "master.m3u8"))
	if err != nil {
		t.Fatalf("reading master: %v", err)
	}
	if got := strings.Count(string(master), "#EXT-X-MEDIA:TYPE=AUDIO"); got != 3 {
		t.Fatalf("master lists %d audio renditions, want 3:\n%s", got, master)
	}
	for _, want := range []string{`LANGUAGE="spa"`, `LANGUAGE="jpn"`, `LANGUAGE="eng"`, `NAME="Japones"`, `URI="a2/index.m3u8"`} {
		if !strings.Contains(string(master), want) {
			t.Errorf("master is missing %s:\n%s", want, master)
		}
	}

	for i := 0; i < 3; i++ {
		dir := filepath.Join(outDir, fmt.Sprintf("a%d", i))
		segments, err := filepath.Glob(filepath.Join(dir, "seg*.ts"))
		if err != nil || len(segments) == 0 {
			t.Fatalf("rendition a%d has no segments", i)
		}
		probe, err := exec.Command("ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", segments[0]).CombinedOutput()
		if err != nil || !containsAll(string(probe), "audio") {
			t.Errorf("rendition a%d segment is not an audio stream: %v: %s", i, err, probe)
		}
	}

	if !m.Ready(job.Hash, 3) {
		t.Error("a complete three-rendition output must be ready for a three-track file")
	}
	if m.Ready(job.Hash, 4) {
		t.Error("an output with three renditions must not be ready for a four-track file")
	}
}

// Output from before the audio renditions held one track. Enqueue must rebuild it for a
// file with several, instead of reporting it as done.
func TestEnqueueRebuildsOneTrackOutput(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed")
	}

	work := t.TempDir()
	src := makeMultiTrackVideo(t, work)
	hash, err := videofile.GetHashFromPath(src)
	if err != nil {
		t.Fatal(err)
	}

	logger := zerolog.Nop()
	m := New(Options{
		Logger:      &logger,
		OutputDir:   filepath.Join(work, "out"),
		FfmpegPath:  "ffmpeg",
		FfprobePath: "ffprobe",
	})
	writePlaylist(t, m, hash)

	job, err := m.Enqueue(src)
	if err != nil {
		t.Fatalf("Enqueue: %v", err)
	}
	if job.Status != StatusQueued {
		t.Fatalf("a one-track output must be rebuilt for a three-track file, got status=%q", job.Status)
	}
	if m.IsAvailable(hash) {
		t.Error("the stale output must be removed before the rebuild")
	}
	<-m.queue
}
