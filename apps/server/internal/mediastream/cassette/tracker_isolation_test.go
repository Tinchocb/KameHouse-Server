package cassette

import (
	"github.com/rs/zerolog"
	"testing"
)

func TestOrphanReapingIgnoresClientsOfOtherFiles(t *testing.T) {
	l := zerolog.Nop()
	p := &Pipeline{killCh: make(chan struct{}), heads: []head{{segment: 100, end: 200}}}
	s := &Session{audios: map[int32]*Pipeline{0: p}}
	c := &Cassette{logger: &l}
	c.sessions.Store("file-a", s)
	tracker := &ClientTracker{cassette: c, logger: &l, clients: map[string]ClientInfo{
		"watching-a": {Path: "file-a", Head: 0},
		"watching-b": {Path: "file-b", Head: 100},
	}}
	tracker.killOrphanedHeads("file-a", nil, 0)
	if p.heads[0].segment != -1 {
		t.Fatal("another file kept an orphaned encoder alive")
	}
}
