package cassette

import (
	"context"
	"path/filepath"
	"sync"
	"testing"

	"github.com/rs/zerolog"
	"kamehouse/internal/mediastream/videofile"
)

func TestDestroyedCassetteRejectsLateSession(t *testing.T) {
	l := zerolog.Nop()
	c, err := New(&NewCassetteOptions{Logger: &l, HwAccelKind: "disabled", TempOutDir: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(c.Destroy)
	c.Destroy()
	// A completed in-memory index keeps this regression independent of tools,
	// real media, network and keyframe extraction.
	kfCacheMu.Lock()
	kfCache.Add("late-session", &KeyframeIndex{Keyframes: []float64{0, 2}, IsDone: true})
	kfCacheMu.Unlock()
	t.Cleanup(ClearKeyframeCache)
	s, err := c.getSession(context.Background(), "synthetic.mp4", "late-session", &videofile.MediaInfo{Duration: 4, Video: &videofile.Video{Codec: "h264", Width: 320, Height: 240}})
	if err == nil || s != nil {
		t.Error("destroyed engine accepted a late session")
	}
	count := 0
	c.sessions.Range(func(_, _ any) bool { count++; return true })
	if count != 0 {
		t.Fatalf("destroyed engine retains %d sessions", count)
	}
}

func TestDestroyedSessionRejectsLatePipelines(t *testing.T) {
	s := lifecycleSession(t)
	s.Destroy()
	if _, err := s.GetVideoIndex(Source, ""); err == nil {
		t.Error("destroyed session accepted a video pipeline")
	}
	if _, err := s.GetAudioIndex(0, ""); err == nil {
		t.Error("destroyed session accepted an audio pipeline")
	}
	if _, err := s.GetVideoSegment(context.Background(), Source, 0); err == nil {
		t.Error("destroyed session accepted a video segment")
	}
	if _, err := s.GetAudioSegment(context.Background(), 0, 0); err == nil {
		t.Error("destroyed session accepted an audio segment")
	}
	if len(s.videos) != 0 || len(s.audios) != 0 {
		t.Fatal("destroyed session recreated pipelines")
	}
}

func lifecycleSession(t *testing.T) *Session {
	t.Helper()
	l := zerolog.Nop()
	s := &Session{
		Path: "synthetic.mp4", Out: filepath.Join(t.TempDir(), "session"),
		Info:      &videofile.MediaInfo{Duration: 4, Video: &videofile.Video{Codec: "h264", Width: 320, Height: 240}, Audios: []videofile.Audio{{Index: 0, Codec: "aac", Channels: 2}}},
		Keyframes: &KeyframeIndex{Keyframes: []float64{0, 2}, IsDone: true},
		videos:    make(map[Quality]*Pipeline), audios: make(map[int32]*Pipeline), settings: &Settings{}, governor: NewGovernor(1, false, &l), logger: &l,
	}
	t.Cleanup(s.Destroy)
	return s
}

func TestSessionKillAllowsFreshPipelines(t *testing.T) {
	s := lifecycleSession(t)
	if _, err := s.GetVideoIndex(Source, ""); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetAudioIndex(0, ""); err != nil {
		t.Fatal(err)
	}
	video, audio := s.videos[Source], s.audios[0]
	s.Kill() // tracker cooldown: temporary, unlike terminal Destroy
	if _, err := s.GetVideoIndex(Source, ""); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetAudioIndex(0, ""); err != nil {
		t.Fatal(err)
	}
	if s.videos[Source] == video || s.audios[0] == audio {
		t.Fatal("Kill reused a permanently cancelled pipeline")
	}
}

func TestSessionConcurrentDestroyAndPipelineRequests(t *testing.T) {
	s := lifecycleSession(t)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for range 16 {
		wg.Go(func() { <-start; _, _ = s.GetVideoIndex(Source, ""); _, _ = s.GetAudioIndex(0, "") })
	}
	for range 4 {
		wg.Go(func() { <-start; s.Destroy() })
	}
	close(start)
	wg.Wait()
	if len(s.videos) != 0 || len(s.audios) != 0 {
		t.Fatal("teardown left a pipeline behind")
	}
}

func TestCassetteConcurrentDestroyIsIdempotent(t *testing.T) {
	l := zerolog.Nop()
	c, err := New(&NewCassetteOptions{Logger: &l, HwAccelKind: "disabled", TempOutDir: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(c.Destroy)
	var wg sync.WaitGroup
	for range 16 {
		wg.Go(c.Destroy)
	}
	wg.Wait()
}
