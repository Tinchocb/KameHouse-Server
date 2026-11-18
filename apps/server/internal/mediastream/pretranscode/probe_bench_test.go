package pretranscode

import (
	"os/exec"
	"testing"
)

// Uses a real local ffprobe. The legacy case performs the extra duration probe
// previously run before stream discovery; it deliberately keeps the new, leaner
// stream query so the comparison isolates the cost of the extra process.
func BenchmarkPretranscodeProbe(b *testing.B) {
	if _, err := exec.LookPath("ffprobe"); err != nil {
		b.Skip("ffprobe not installed")
	}
	src := makeSampleVideo(b, b.TempDir())
	for _, extra := range []bool{true, false} {
		name := "combined"
		if extra {
			name = "legacy_two_processes"
		}
		b.Run(name, func(b *testing.B) {
			b.ReportAllocs()
			for range b.N {
				if extra {
					cmd := exec.CommandContext(b.Context(), "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", src)
					if out, err := cmd.Output(); err != nil {
						b.Fatalf("duration: %v %s", err, out)
					}
				}
				streams, err := probeStreams(b.Context(), "ffprobe", src)
				if err != nil || streams.Duration <= 0 {
					b.Fatalf("probe: %+v %v", streams, err)
				}
			}
		})
	}
}
