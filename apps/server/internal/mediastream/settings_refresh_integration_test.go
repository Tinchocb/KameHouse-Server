package mediastream

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"kamehouse/internal/database/models"
	"kamehouse/internal/mediastream/videofile"
)

// Real FFmpeg/ffprobe, synthetic media and disposable output only.
func TestSettingsRefreshKeepsActiveHLS(t *testing.T) {
	if testing.Short() {
		t.Skip("FFmpeg integration")
	}
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg not installed")
	}
	ffprobe, err := exec.LookPath("ffprobe")
	if err != nil {
		t.Skip("ffprobe not installed")
	}
	base := t.TempDir()
	source := filepath.Join(base, "synthetic.mp4")
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, ffmpeg, "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=320x240:r=24", "-t", "12", "-c:v", "libx264", "-preset", "ultrafast", "-g", "48", "-pix_fmt", "yuv420p", source)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("synthetic fixture: %v: %s", err, out)
	}
	l := zerolog.Nop()
	r := NewRepository(&NewRepositoryOptions{Logger: &l})
	t.Cleanup(r.OnCleanup)
	s := models.MediastreamSettings{TranscodeEnabled: true, TranscodeHwAccel: "disabled", TranscodeThreads: 1, FfmpegPath: ffmpeg, FfprobePath: ffprobe}
	dir := filepath.Join(base, "transcode")
	r.InitializeModules(&s, base, dir)
	engine, _ := r.getTranscoder()
	info := &videofile.MediaInfo{Duration: 12, Video: &videofile.Video{Codec: "h264", Width: 320, Height: 240, PixFmt: "yuv420p"}}
	container := &MediaContainer{Filepath: source, Hash: "synthetic-refresh", StreamType: StreamTypeTranscode, MediaInfo: info}
	for _, client := range []string{"client-a", "client-b"} {
		r.playbackManager.clientMediaContainers.Set(client, container)
	}
	serve := func(client, path string) string {
		t.Helper()
		path = filepath.ToSlash(filepath.Clean(path))
		e := echo.New()
		req := httptest.NewRequest(http.MethodGet, "/transcode/"+path, nil).WithContext(ctx)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)
		c.SetParamNames("*")
		c.SetParamValues(path)
		if err := r.ServeEchoTranscodeStream(c, client); err != nil {
			t.Fatalf("serve %s/%s: %v", client, path, err)
		}
		if rec.Code != 200 || rec.Body.Len() == 0 {
			t.Fatalf("serve %s/%s: HTTP %d", client, path, rec.Code)
		}
		return rec.Body.String()
	}
	master := serve("client-a", "master.m3u8")
	var variant string
	for _, line := range strings.Split(master, "\n") {
		if !strings.HasPrefix(line, "#") && strings.Contains(line, "index.m3u8") {
			variant = strings.Split(line, "?")[0]
			break
		}
	}
	if variant == "" {
		t.Fatalf("master lacks variant: %s", master)
	}
	index := serve("client-a", variant)
	var segment string
	for _, line := range strings.Split(index, "\n") {
		if !strings.HasPrefix(line, "#") && strings.Contains(line, ".ts") {
			segment = filepath.ToSlash(filepath.Join(filepath.Dir(variant), strings.Split(line, "?")[0]))
			break
		}
	}
	if segment == "" {
		t.Fatalf("index lacks segment: %s", index)
	}
	first := serve("client-a", segment)
	s.PerformanceProfile = "low"
	if r.InitializeModules(&s, base, dir) {
		t.Fatal("UI save restarted active HLS")
	}
	if current, _ := r.getTranscoder(); current != engine {
		t.Fatal("active HLS engine replaced")
	}
	serve("client-b", "master.m3u8")
	if second := serve("client-b", segment); second != first {
		t.Fatal("second client received different segment after save")
	}
}
