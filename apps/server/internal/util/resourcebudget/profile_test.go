package resourcebudget

import "testing"

func TestProfilesBoundResources(t *testing.T) {
	for _, tc := range []struct {
		cpu                int
		ram                uint64
		software, hardware int
		cache              int64
	}{
		{0, 0, 1, 1, 32}, {2, 2 << 30, 1, 1, 32},
		{4, 4 << 30, 1, 2, 64}, {8, 8 << 30, 2, 4, 128},
		{64, 64 << 30, 2, 4, 256},
	} {
		p := Plan(tc.cpu, tc.ram)
		if p.SoftwareProcesses != tc.software || p.HardwareProcesses != tc.hardware || p.ThumbnailMB != tc.cache {
			t.Fatalf("%+v: %+v", tc, p)
		}
		if p.Threads < 1 || p.Threads > 4 || p.BackgroundThreads < 1 || p.BackgroundThreads > 2 {
			t.Fatalf("unbounded threads: %+v", p)
		}
	}
}
