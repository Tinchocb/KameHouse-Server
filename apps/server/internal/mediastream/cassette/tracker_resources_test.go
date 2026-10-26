package cassette

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/rs/zerolog"
)

// A synchronous tracker keeps clock advancement deterministic and exercises the
// same handlers as the event loop, without waiting hours or launching encoders.
func resourceTracker(t *testing.T) *ClientTracker {
	t.Helper()
	l := zerolog.Nop()
	c := &Cassette{logger: &l}
	return &ClientTracker{cassette: c, logger: &l, killCh: make(chan struct{}), deletedStream: make(chan string, 256), clients: map[string]ClientInfo{}, visitDate: map[string]time.Time{}, lastUsage: map[string]time.Time{}, qualityActive: map[string]map[Quality]time.Time{}, audioActive: map[string]map[int32]time.Time{}}
}

func TestTrackerInactiveLastClientReleasesPipelines(t *testing.T) {
	tr := resourceTracker(t)
	defer tr.Stop()
	s := lifecycleSession(t)
	tr.cassette.sessions.Store(s.Path, s)
	p := s.getVideoPipeline(Source)
	tr.handleClientUpdate(ClientInfo{Client: "inactive", Path: s.Path, Audio: -1, Head: -1})
	tr.visitDate["inactive"] = time.Now().Add(-2 * time.Hour)
	tr.purgeInactive(time.Hour)
	if p.ctx.Err() == nil || len(s.videos) != 0 {
		t.Fatal("last inactive client removed but pipeline retained")
	}
}

func TestTrackerRepeatedCooldownReleasesPathMetadata(t *testing.T) {
	tr := resourceTracker(t)
	defer tr.Stop()
	for i := range 24 {
		s := lifecycleSession(t)
		s.Path = fmt.Sprintf("synthetic-%d.mp4", i)
		tr.cassette.sessions.Store(s.Path, s)
		q := Source
		tr.handleClientUpdate(ClientInfo{Client: "viewer", Path: s.Path, Quality: &q, Audio: 0, Head: 0})
		if err := os.MkdirAll(s.Out, 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(s.Out, "segment.ts"), []byte("synthetic"), 0600); err != nil {
			t.Fatal(err)
		}
		tr.handleRemoveClient("viewer")
		tr.lastUsage[s.Path] = time.Now().Add(-6 * time.Minute)
		tr.maybeDestroySession(s.Path)
		if _, err := os.Stat(s.Out); !os.IsNotExist(err) {
			t.Fatal("session output retained")
		}
	}
	if len(tr.lastUsage)+len(tr.qualityActive)+len(tr.audioActive) != 0 {
		t.Fatalf("24 retired sessions retain metadata: usage=%d quality=%d audio=%d", len(tr.lastUsage), len(tr.qualityActive), len(tr.audioActive))
	}
}

func TestTrackerPreservesSharedAndRecentlyUsedSession(t *testing.T) {
	tr := resourceTracker(t)
	defer tr.Stop()
	s := lifecycleSession(t)
	tr.cassette.sessions.Store(s.Path, s)
	p := s.getVideoPipeline(Source)
	q := Source
	tr.handleClientUpdate(ClientInfo{Client: "inactive", Path: s.Path, Quality: &q, Audio: -1, Head: -1})
	tr.handleClientUpdate(ClientInfo{Client: "active", Path: s.Path, Quality: &q, Audio: -1, Head: -1})
	tr.visitDate["inactive"] = time.Now().Add(-2 * time.Hour)
	tr.purgeInactive(time.Hour)
	if p.ctx.Err() != nil || tr.cassette.getSessionByPath(s.Path) != s {
		t.Fatal("active reader lost shared pipeline")
	}
	tr.maybeDestroySession(s.Path)
	if s.destroyed.Load() || len(tr.lastUsage) != 1 || len(tr.qualityActive) != 1 {
		t.Fatal("cooldown removed a recently used session")
	}
}
