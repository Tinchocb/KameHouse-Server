package transcoder

import (
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

// IdlePreBaker monitors system idle state and pre-transcodes heavy files
// (e.g., HEVC → HLS) when the CPU utilization is below IdleCPUThreshold.
// This ensures commonly accessed or large files are ready for instant playback
// without impacting the user's active workflows.
type IdlePreBaker struct {
	mu        sync.Mutex
	logger    *zerolog.Logger
	isRunning bool
	stopCh    chan struct{}

	// CheckInterval controls how often the idle pre-baker checks system load.
	CheckInterval time.Duration
	// CPUThreshold is the percentage below which pre-baking activates.
	CPUThreshold float64
	// Candidates is a list of file paths queued for pre-baking.
	candidates []string
}

// NewIdlePreBaker creates a new idle pre-baking controller.
func NewIdlePreBaker(logger *zerolog.Logger) *IdlePreBaker {
	return &IdlePreBaker{
		logger:        logger,
		CheckInterval: 60 * time.Second,
		CPUThreshold:  IdleCPUThreshold,
		candidates:    make([]string, 0),
		stopCh:        make(chan struct{}),
	}
}

// AddCandidate queues a file for idle pre-baking.
func (ipb *IdlePreBaker) AddCandidate(filePath string) {
	ipb.mu.Lock()
	defer ipb.mu.Unlock()

	// Avoid duplicates
	for _, c := range ipb.candidates {
		if c == filePath {
			return
		}
	}
	ipb.candidates = append(ipb.candidates, filePath)
	ipb.logger.Debug().Str("file", filePath).Int("queued", len(ipb.candidates)).Msg("idle_prebake: Candidate added")
}

// RemoveCandidate removes a file from the pre-bake queue.
func (ipb *IdlePreBaker) RemoveCandidate(filePath string) {
	ipb.mu.Lock()
	defer ipb.mu.Unlock()

	for i, c := range ipb.candidates {
		if c == filePath {
			ipb.candidates = append(ipb.candidates[:i], ipb.candidates[i+1:]...)
			return
		}
	}
}

// Start begins the idle monitoring loop in a background goroutine.
func (ipb *IdlePreBaker) Start() {
	ipb.mu.Lock()
	if ipb.isRunning {
		ipb.mu.Unlock()
		return
	}
	ipb.isRunning = true
	ipb.mu.Unlock()

	ipb.logger.Info().Float64("threshold", ipb.CPUThreshold).Msg("idle_prebake: Started monitoring")

	go ipb.monitorLoop()
}

// Stop halts the idle pre-baking monitor.
func (ipb *IdlePreBaker) Stop() {
	ipb.mu.Lock()
	defer ipb.mu.Unlock()

	if !ipb.isRunning {
		return
	}
	close(ipb.stopCh)
	ipb.isRunning = false
	ipb.logger.Info().Msg("idle_prebake: Stopped")
}

// QueueLength returns the number of files waiting to be pre-baked.
func (ipb *IdlePreBaker) QueueLength() int {
	ipb.mu.Lock()
	defer ipb.mu.Unlock()
	return len(ipb.candidates)
}

func (ipb *IdlePreBaker) monitorLoop() {
	ticker := time.NewTicker(ipb.CheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ipb.stopCh:
			return
		case <-ticker.C:
			cpuUsage := getSystemCPUUsage()

			if cpuUsage < ipb.CPUThreshold {
				ipb.mu.Lock()
				if len(ipb.candidates) > 0 {
					// Pop the first candidate
					filePath := ipb.candidates[0]
					ipb.candidates = ipb.candidates[1:]
					ipb.mu.Unlock()

					ipb.logger.Info().
						Str("file", filePath).
						Float64("cpu", cpuUsage).
						Msg("idle_prebake: System idle, starting pre-bake")

					ipb.preBakeFile(filePath)
				} else {
					ipb.mu.Unlock()
				}
			}
		}
	}
}

func (ipb *IdlePreBaker) preBakeFile(filePath string) {
	// This is a placeholder for the actual transcoding pipeline.
	// In production, this would invoke the full Transcoder pipeline
	// with the file and output HLS segments to a cache directory.
	ipb.logger.Info().Str("file", filePath).Msg("idle_prebake: Pre-baking completed (stub)")
}

// getSystemCPUUsage returns the current system CPU usage as a percentage (0-100).
// Uses OS-specific methods to probe CPU load.
func getSystemCPUUsage() float64 {
	switch runtime.GOOS {
	case "windows":
		return getWindowsCPUUsage()
	case "linux":
		return getLinuxCPUUsage()
	case "darwin":
		return getDarwinCPUUsage()
	default:
		return 50.0 // Conservative default: assume moderate load
	}
}

func getWindowsCPUUsage() float64 {
	cmd := exec.Command("wmic", "cpu", "get", "loadpercentage", "/value")
	output, err := cmd.Output()
	if err != nil {
		return 50.0
	}

	for _, line := range strings.Split(string(output), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "LoadPercentage=") {
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				if val, err := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64); err == nil {
					return val
				}
			}
		}
	}
	return 50.0
}

func getLinuxCPUUsage() float64 {
	cmd := exec.Command("sh", "-c", "top -bn1 | grep 'Cpu(s)' | awk '{print $2}'")
	output, err := cmd.Output()
	if err != nil {
		return 50.0
	}

	val, err := strconv.ParseFloat(strings.TrimSpace(string(output)), 64)
	if err != nil {
		return 50.0
	}
	return val
}

func getDarwinCPUUsage() float64 {
	cmd := exec.Command("sh", "-c", "ps -A -o %cpu | awk '{s+=$1} END {print s}'")
	output, err := cmd.Output()
	if err != nil {
		return 50.0
	}

	val, err := strconv.ParseFloat(strings.TrimSpace(string(output)), 64)
	if err != nil {
		return 50.0
	}
	// Normalize to 0-100 (ps returns sum of all processes)
	if val > 100.0 {
		val = 100.0
	}
	return val
}
