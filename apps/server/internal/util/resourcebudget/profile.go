// Package resourcebudget provides conservative process-wide media budgets.
package resourcebudget

import (
	"runtime"
	"sync"

	"github.com/shirou/gopsutil/v4/mem"
)

type Profile struct {
	SoftwareProcesses int
	HardwareProcesses int
	Threads           int
	BackgroundThreads int
	ThumbnailMB       int64
}

// Plan reserves CPU capacity for the UI, HTTP and database. Unknown RAM uses
// the smallest profile rather than assuming an unrestricted machine.
func Plan(cpus int, totalBytes uint64) Profile {
	cpus = max(1, cpus)
	p := Profile{SoftwareProcesses: 1, HardwareProcesses: 1, ThumbnailMB: 32}
	if totalBytes >= 4<<30 {
		p.HardwareProcesses = min(2, max(1, cpus/2))
		p.ThumbnailMB = 64
	}
	if totalBytes >= 8<<30 {
		p.SoftwareProcesses = min(2, max(1, cpus/4))
		p.HardwareProcesses = min(4, max(1, cpus/2))
		p.ThumbnailMB = 128
	}
	if totalBytes >= 16<<30 {
		p.ThumbnailMB = 256
	}
	p.Threads = min(4, max(1, (cpus-1)/p.HardwareProcesses))
	p.BackgroundThreads = min(2, max(1, cpus/4))
	return p
}

var detected = sync.OnceValue(func() Profile {
	var total uint64
	if v, err := mem.VirtualMemory(); err == nil {
		total = v.Total
	}
	return Plan(min(runtime.NumCPU(), runtime.GOMAXPROCS(0)), total)
})

func Current() Profile { return detected() }

// BackgroundAllowed is checked before admission, not on every segment. Failure
// to read host metrics leaves the conservative static budget in control.
func BackgroundAllowed() bool {
	v, err := mem.VirtualMemory()
	return err != nil || (v.Available >= 512<<20 && v.Available >= v.Total/10)
}
