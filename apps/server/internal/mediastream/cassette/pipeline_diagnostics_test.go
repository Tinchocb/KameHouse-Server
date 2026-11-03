package cassette

import (
	"os"
	"os/exec"
	"sync"
	"testing"
)

func TestHeadDiagnosticsSnapshotDuringProgress(t *testing.T) {
	p := &Pipeline{heads: []head{
		deletedHead,
		{segment: 94, end: 100, gen: 7, cmd: &exec.Cmd{Process: &os.Process{Pid: 1234}}},
		{segment: 120, end: 130, gen: 8, dying: true},
	}}
	snapshot := p.headDiagnostics()
	if len(snapshot) != 2 || snapshot[0].Encoder != 1 || snapshot[0].PID != 1234 ||
		snapshot[0].Segment != 94 || snapshot[0].End != 100 || snapshot[0].Gen != 7 ||
		snapshot[1].PID != 0 || !snapshot[1].Dying {
		t.Fatalf("unexpected snapshot: %+v", snapshot)
	}
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			p.headsMu.Lock()
			p.heads[1].segment++
			p.headsMu.Unlock()
		}
	}()
	for i := 0; i < 100; i++ {
		_ = p.headDiagnostics()
	}
	wg.Wait()
	if snapshot[0].Segment != 94 {
		t.Fatal("logging snapshot changed after producer progress")
	}
}
