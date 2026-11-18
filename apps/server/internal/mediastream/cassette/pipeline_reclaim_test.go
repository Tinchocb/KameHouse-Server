package cassette

import (
	"fmt"
	"github.com/rs/zerolog"
	"os"
	"path/filepath"
	"testing"
)

func TestReclaimSegmentsFromAllEncodersRequiresSameEncoderSuccessor(t *testing.T) {
	l := zerolog.Nop()
	dir := t.TempDir()
	p := &Pipeline{logger: &l, segments: NewSegmentTable(20), outPathFmt: func(eid int) string {
		return filepath.Join(dir, fmt.Sprintf("segment-a0-%d-%%d.ts", eid))
	}}
	for _, name := range []string{
		"segment-a0-0-0.ts", "segment-a0-0-1.ts",
		"segment-a0-7-5.ts", "segment-a0-7-6.ts",
		"segment-a0-8-10.ts", "segment-a0-9-11.ts",
		"segment-a1-0-12.ts", "segment-a1-0-13.ts",
		"segment-a0-7-7.ts.extra",
	} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("fixture"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	p.reclaimExistingSegments()
	for _, seg := range []int32{0, 5} {
		if !p.segments.IsReady(seg) {
			t.Fatalf("complete segment %d not reclaimed", seg)
		}
	}
	for _, seg := range []int32{1, 6, 10, 11, 12, 13} {
		if p.segments.IsReady(seg) {
			t.Fatalf("unverified segment %d reclaimed", seg)
		}
	}
	if eid := p.segments.EncoderID(5); eid != 7 {
		t.Fatalf("segment uses encoder %d, want 7", eid)
	}
}
