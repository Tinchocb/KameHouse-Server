package cassette

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"kamehouse/internal/mediastream/videofile"
)

func TestRepeatedSyntheticHLSReleasesResources(t *testing.T) {
	if testing.Short() {
		t.Skip("synthetic FFmpeg integration")
	}
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg unavailable")
	}
	ffprobe, err := exec.LookPath("ffprobe")
	if err != nil {
		t.Skip("ffprobe unavailable")
	}
	base := t.TempDir()
	source := filepath.Join(base, "synthetic.mp4")
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	cmd := exec.CommandContext(ctx, ffmpeg, "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=320x240:r=24", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "12", "-c:v", "libx264", "-preset", "ultrafast", "-g", "48", "-pix_fmt", "yuv420p", "-c:a", "aac", source)
	if b, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("fixture: %v %s", err, b)
	}
	l := zerolog.Nop()
	for cycle := range 6 {
		c, err := New(&NewCassetteOptions{Logger: &l, HwAccelKind: "disabled", TempOutDir: base, FfmpegPath: ffmpeg, FfprobePath: ffprobe, MaxConcurrency: 2})
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(c.Destroy)
		info := &videofile.MediaInfo{Duration: 12, Video: &videofile.Video{Codec: "h264", Width: 320, Height: 240, PixFmt: "yuv420p"}, Audios: []videofile.Audio{{Index: 0, Codec: "aac", Channels: 1}}}
		s, err := c.getSession(ctx, source, "synthetic-resource-cycle", info)
		if err != nil {
			t.Fatal(err)
		}
		for round := range 2 {
			if _, err := s.GetVideoSegment(ctx, Source, 0); err != nil {
				t.Fatal(err)
			}
			if _, err := s.GetAudioSegment(ctx, 0, 0); err != nil {
				t.Fatal(err)
			}
			// Retain actual commands before teardown. Pipeline.Kill waits for
			// reapers, so ProcessState is safe to inspect after it returns.
			var cmds []*exec.Cmd
			for _, p := range []*Pipeline{s.videos[Source], s.audios[0]} {
				p.headsMu.RLock()
				for _, h := range p.heads {
					if h.cmd != nil {
						cmds = append(cmds, h.cmd)
					}
				}
				p.headsMu.RUnlock()
			}
			s.Kill()
			for _, cmd := range cmds {
				if cmd.ProcessState == nil {
					t.Fatalf("cycle %d round %d: process not reaped", cycle, round)
				}
			}
			stats := c.GovernorStats()
			if stats.ActiveProcesses != 0 || stats.ActiveNVENC != 0 || stats.TotalLaunched != stats.TotalCompleted {
				t.Fatalf("cycle %d: retained slots %+v", cycle, stats)
			}
			if len(s.videos)+len(s.audios) != 0 {
				t.Fatal("pipeline maps retained")
			}
		}
		c.Destroy()
		if _, err := os.Stat(s.Out); !os.IsNotExist(err) {
			t.Fatalf("cycle %d: output directory retained: %v", cycle, err)
		}
		count := 0
		c.sessions.Range(func(_, _ any) bool { count++; return true })
		if count != 0 {
			t.Fatal("sessions retained after Destroy")
		}
		t.Logf("cycle %d: video/audio replay, reapers, slots, maps and output released", cycle)
	}
}
