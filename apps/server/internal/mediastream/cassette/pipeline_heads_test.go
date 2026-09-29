package cassette

import "testing"

// A killed head keeps its slot until its owner (reapProcess) frees it: the output
// path is outPathFmt(encoderID), so reusing it would let two ffmpeg write the
// same segment files, and the old reaper would then wipe the new head.
func TestKilledHeadSlotIsNotReusedUntilReaped(t *testing.T) {
	p := &Pipeline{killCh: make(chan struct{})}

	old := p.claimHeadSlotLocked(head{segment: 10, end: 110, gen: 1})
	p.killHeadLocked(old)
	if !p.heads[old].dying {
		t.Fatal("killed head should be marked dying")
	}

	fresh := p.claimHeadSlotLocked(head{segment: 50, end: 150, gen: 2})
	if fresh == old {
		t.Fatalf("new head reused slot %d of a head that is still exiting", old)
	}

	// The old reaper only frees its own generation.
	if p.heads[old].gen == 1 {
		p.heads[old] = deletedHead
	}
	if p.heads[fresh].gen != 2 || p.heads[fresh].segment != 50 {
		t.Fatalf("new head was clobbered: %+v", p.heads[fresh])
	}
	if again := p.claimHeadSlotLocked(head{segment: 0, end: 10, gen: 3}); again != old {
		t.Fatalf("reaped slot %d should be reused, got %d", old, again)
	}
}
