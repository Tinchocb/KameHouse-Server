package mediastream

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"kamehouse/internal/database/models"
)

func TestSettingsRefreshPreservesUnchangedEngine(t *testing.T) {
	l := zerolog.Nop()
	r := NewRepository(&NewRepositoryOptions{Logger: &l})
	t.Cleanup(r.OnCleanup)
	base := t.TempDir()
	dir := filepath.Join(base, "transcode")
	s := models.MediastreamSettings{TranscodeEnabled: true, TranscodeHwAccel: "disabled"}
	r.InitializeModules(&s, base, dir)
	engine, ok := r.getTranscoder()
	if !ok {
		t.Fatal("engine was not initialized")
	}
	marker := filepath.Join(dir, "active-segment.ts")
	if err := os.WriteFile(marker, []byte("segment"), 0600); err != nil {
		t.Fatal(err)
	}
	next := s
	next.UpdatedAt = time.Now()
	next.PerformanceProfile = "low"
	next.AutoGovernorEnabled = true
	next.TranscodePreset = "fast" // same effective default
	next.PreTranscodeLibraryDir = filepath.Join(base, "optimized")
	if r.InitializeModules(&next, base, dir) {
		t.Fatal("equivalent settings reported a restart")
	}
	if current, _ := r.getTranscoder(); current != engine {
		t.Fatal("equivalent settings replaced the engine")
	}
	if _, err := os.Stat(marker); err != nil {
		t.Fatalf("equivalent settings removed active segment: %v", err)
	}
	if r.GetSettings().MustGet().PerformanceProfile != "low" {
		t.Fatal("UI preferences were not refreshed")
	}
	next.DirectPlayOnly = true
	if !r.InitializeModules(&next, base, dir) {
		t.Fatal("engine change was ignored")
	}
	if _, ok := r.getTranscoder(); ok {
		t.Fatal("DirectPlayOnly kept transcoder active")
	}
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Fatalf("engine change did not clear old segments: %v", err)
	}
}

func TestSettingsRefreshAppliesEngineChangesOnce(t *testing.T) {
	changes := map[string]func(*models.MediastreamSettings){
		"gpu":                    func(s *models.MediastreamSettings) { s.TranscodeHwAccel = "custom" },
		"preset":                 func(s *models.MediastreamSettings) { s.TranscodePreset = "slow" },
		"threads":                func(s *models.MediastreamSettings) { s.TranscodeThreads = 2 },
		"pretranscode directory": func(s *models.MediastreamSettings) { s.PreTranscodeLibraryDir = t.TempDir() },
		"pretranscode enabled":   func(s *models.MediastreamSettings) { s.PreTranscodeEnabled = true },
		"custom settings":        func(s *models.MediastreamSettings) { s.TranscodeHwAccelCustomSettings = `{}` },
		"direct policy":          func(s *models.MediastreamSettings) { s.DisableAutoSwitchToDirectPlay = true },
		"enabled":                func(s *models.MediastreamSettings) { s.TranscodeEnabled = true },
	}
	for name, change := range changes {
		t.Run(name, func(t *testing.T) {
			l := zerolog.Nop()
			r := NewRepository(&NewRepositoryOptions{Logger: &l})
			t.Cleanup(r.OnCleanup)
			base := t.TempDir()
			s := models.MediastreamSettings{DirectPlayOnly: true, TranscodeHwAccel: "disabled"}
			r.InitializeModules(&s, base, filepath.Join(base, "transcode"))
			change(&s)
			if !r.InitializeModules(&s, base, filepath.Join(base, "transcode")) {
				t.Fatal("engine change ignored")
			}
			if r.InitializeModules(&s, base, filepath.Join(base, "transcode")) {
				t.Fatal("same change restarted twice")
			}
		})
	}
}

func TestSettingsRefreshResolvesBinaryPathsBeforeComparing(t *testing.T) {
	l := zerolog.Nop()
	r := NewRepository(&NewRepositoryOptions{Logger: &l})
	t.Cleanup(r.OnCleanup)
	base := t.TempDir()
	dir := filepath.Join(base, "transcode")
	s := models.MediastreamSettings{DirectPlayOnly: true}
	r.InitializeModules(&s, base, dir)
	// Invalid custom paths resolve to the same effective binaries.
	s.FfmpegPath = filepath.Join(base, "missing")
	if r.InitializeModules(&s, base, dir) {
		t.Fatal("invalid custom path restarted the engine")
	}
	bin := filepath.Join(base, "bin")
	if err := os.MkdirAll(bin, 0700); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"custom-ffmpeg", "custom-ffprobe"} {
		path := filepath.Join(bin, name)
		if err := os.WriteFile(path, nil, 0600); err != nil {
			t.Fatal(err)
		}
		if name == "custom-ffmpeg" {
			s.FfmpegPath = path
		} else {
			s.FfprobePath = path
		}
		if !r.InitializeModules(&s, base, dir) {
			t.Fatalf("resolved %s change ignored", name)
		}
		if r.InitializeModules(&s, base, dir) {
			t.Fatalf("resolved %s restarted twice", name)
		}
	}
}

func TestInitializeModulesDoesNotMutateInput(t *testing.T) {
	l := zerolog.Nop()
	r := NewRepository(&NewRepositoryOptions{Logger: &l})
	t.Cleanup(r.OnCleanup)
	s := models.MediastreamSettings{DirectPlayOnly: true}
	before := s
	base := t.TempDir()
	var wg sync.WaitGroup
	wg.Go(func() {
		for range 1000 {
			_ = s.FfmpegPath
			_ = s.FfprobePath
		}
	})
	r.InitializeModules(&s, base, filepath.Join(base, "transcode"))
	wg.Wait()
	if s != before {
		t.Fatal("initialization mutated shared input settings")
	}
	if r.GetSettings().MustGet() == &s {
		t.Fatal("repository published caller-owned settings")
	}
}
