package cassette

import (
	"context"
	"runtime"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog"
)

// Governor throttles concurrent ffmpeg processes
type Governor struct {
	sem      chan struct{}
	nvencSem chan struct{}
	active   atomic.Int32
	maxSlot  int
	nvencCap int
	logger   *zerolog.Logger

	mu    sync.Mutex
	stats GovernorStats
}

// GovernorStats contains runtime metrics
type GovernorStats struct {
	ActiveProcesses int32         `json:"activeProcesses"`
	MaxConcurrency  int           `json:"maxConcurrency"`
	ActiveNVENC     int32         `json:"activeNvenc"`
	NVENCCap        int           `json:"nvencCap"`
	TotalLaunched   int64         `json:"totalLaunched"`
	TotalCompleted  int64         `json:"totalCompleted"`
	TotalWaitTime   time.Duration `json:"totalWaitTime"`
}

// defaultNVENCSessions es el tope de sesiones NVENC simultáneas si no hay KAMEHOUSE_NVENC_SESSIONS.
// Con 2, en Broly (MKV 33 Mbps desde Drive) casi todas las cabezas caían a CPU y el reproductor
// bajaba a 240p; 3 deja una cabeza más en GPU.
const defaultNVENCSessions = 3

// nvencCapFromEnv returns the configured NVENC limit
func nvencCapFromEnv() int {
	val := getEnvOr("KAMEHOUSE_NVENC_SESSIONS", strconv.Itoa(defaultNVENCSessions))
	parsed, err := strconv.Atoi(val)
	if err != nil || parsed < 1 {
		return defaultNVENCSessions
	}
	return parsed
}

// NewGovernor creates a governor with max concurrency
func NewGovernor(maxConcurrency int, hwAccelEnabled bool, logger *zerolog.Logger) *Governor {
	if maxConcurrency <= 0 {
		numCPU := runtime.NumCPU()
		if hwAccelEnabled {
			// En hardware acelerado, permitir hasta 2x cores pero con un piso sensato y techo razonable
			maxConcurrency = min(max(numCPU, 2), 6)
		} else {
			// En codificación por software puro, no saturar todos los núcleos para que Echo y SQLite respondan
			maxConcurrency = max(numCPU-1, 1)
		}
	}

	nvencCap := nvencCapFromEnv()

	gov := &Governor{
		sem:      make(chan struct{}, maxConcurrency),
		nvencSem: make(chan struct{}, nvencCap),
		maxSlot:  maxConcurrency,
		nvencCap: nvencCap,
		logger:   logger,
	}
	gov.stats.MaxConcurrency = maxConcurrency
	gov.stats.NVENCCap = nvencCap
	return gov
}

// TryAcquireNVENC attempts to grab an NVENC slot.
// Returns a release function and true if acquired.
// reserve=0: takes any available slot.
// reserve=1: leaves at least 1 slot free for interactive heads.
// Note: reading ActiveNVENC outside the select channel operation creates a brief
// benign race condition where a speculative head might grab a slot that was just
// about to be needed. This is acceptable as a best-effort reservation.
func (g *Governor) TryAcquireNVENC(reserve int) (func(), bool) {
	g.mu.Lock()
	active := g.stats.ActiveNVENC
	g.mu.Unlock()

	// If we need to reserve a slot for interactive usage, and we'd consume the last one:
	if reserve > 0 && int(active)+reserve >= g.nvencCap {
		return nil, false
	}

	select {
	case g.nvencSem <- struct{}{}:
		g.mu.Lock()
		g.stats.ActiveNVENC++
		g.mu.Unlock()
		var once sync.Once
		return func() {
			once.Do(func() {
				g.mu.Lock()
				g.stats.ActiveNVENC--
				g.mu.Unlock()
				<-g.nvencSem
			})
		}, true
	default:
		return nil, false
	}
}

// Acquire blocks until a slot is available
func (g *Governor) Acquire(ctx context.Context) (release func(), err error) {
	start := time.Now()

	select {
	case g.sem <- struct{}{}:
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	return g.granted(time.Since(start)), nil
}

// TryAcquire takes a slot only if one is free right now. Speculative work uses it so it never
// queues in front of the heads a player is actually waiting for.
func (g *Governor) TryAcquire() (release func(), ok bool) {
	select {
	case g.sem <- struct{}{}:
		return g.granted(0), true
	default:
		return nil, false
	}
}

// granted records a slot that was just taken and returns its (idempotent) release function.
func (g *Governor) granted(waited time.Duration) func() {
	n := g.active.Add(1)

	g.mu.Lock()
	g.stats.TotalLaunched++
	g.stats.TotalWaitTime += waited
	g.stats.ActiveProcesses = n
	g.stats.MaxConcurrency = g.maxSlot
	g.stats.NVENCCap = g.nvencCap
	g.mu.Unlock()

	if waited > 50*time.Millisecond {
		g.logger.Debug().
			Dur("waited", waited).
			Int32("active", n).
			Msg("cassette/governor: slot acquired after wait")
	}

	var once sync.Once
	return func() {
		once.Do(func() {
			remaining := g.active.Add(-1)
			g.mu.Lock()
			g.stats.TotalCompleted++
			g.stats.ActiveProcesses = remaining
			g.mu.Unlock()
			<-g.sem
		})
	}
}

// Stats returns the governor metrics
func (g *Governor) Stats() GovernorStats {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.stats
}
