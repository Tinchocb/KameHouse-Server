package transcoder

import (
	"context"
	"fmt"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

// HwAccelCapability represents a detected hardware acceleration method.
type HwAccelCapability struct {
	Name     string `json:"name"`     // e.g. "nvidia", "vaapi", "qsv", "videotoolbox"
	Encoder  string `json:"encoder"`  // e.g. "h264_nvenc", "h264_vaapi"
	Decoder  string `json:"decoder"`  // e.g. "h264_cuvid"
	Platform string `json:"platform"` // "windows", "linux", "darwin"
	Priority int    `json:"priority"` // Higher = preferred
}

// HwProbeResult holds the results of hardware probing.
type HwProbeResult struct {
	Available  []HwAccelCapability `json:"available"`
	Best       *HwAccelCapability  `json:"best,omitempty"`
	FfmpegPath string              `json:"ffmpeg_path"`
	ProbeTime  time.Duration       `json:"probe_time"`
}

// hwProbeCache stores the cached probe result to avoid repeated ffmpeg calls.
var (
	hwProbeOnce   sync.Once
	hwProbeResult *HwProbeResult
)

// ProbeHardwareAccel dynamically discovers which hardware accelerators are
// available by querying ffmpeg's encoder list. Results are cached for the
// lifetime of the process.
func ProbeHardwareAccel(ffmpegPath string, logger *zerolog.Logger) *HwProbeResult {
	hwProbeOnce.Do(func() {
		start := time.Now()
		logger.Info().Msg("transcoder: Probing hardware acceleration capabilities...")

		if ffmpegPath == "" {
			ffmpegPath = "ffmpeg"
		}

		result := &HwProbeResult{
			Available:  make([]HwAccelCapability, 0),
			FfmpegPath: ffmpegPath,
		}

		// Query ffmpeg for available encoders
		encoders := queryEncoders(ffmpegPath)

		// Check for each known hardware encoder
		candidates := []struct {
			name     string
			encoder  string
			decoder  string
			priority int
			osFilter string // empty = all platforms
		}{
			{"nvidia", "h264_nvenc", "h264_cuvid", 100, ""},
			{"nvidia", "hevc_nvenc", "hevc_cuvid", 99, ""},
			{"qsv", "h264_qsv", "h264_qsv", 90, ""},
			{"qsv", "hevc_qsv", "hevc_qsv", 89, ""},
			{"videotoolbox", "h264_videotoolbox", "", 85, "darwin"},
			{"videotoolbox", "hevc_videotoolbox", "", 84, "darwin"},
			{"vaapi", "h264_vaapi", "", 80, "linux"},
			{"vaapi", "hevc_vaapi", "", 79, "linux"},
			{"amf", "h264_amf", "", 70, "windows"},
			{"amf", "hevc_amf", "", 69, "windows"},
			{"vulkan", "h264_amf", "", 60, "windows"},
		}

		// Track best per-vendor to prefer newer encoders over older ones
		seen := make(map[string]bool)

		for _, c := range candidates {
			// Skip if platform doesn't match
			if c.osFilter != "" && runtime.GOOS != c.osFilter {
				continue
			}

			if encoders[c.encoder] {
				// Deduplicate by name: keep the highest-priority encoder per vendor
				if seen[c.name] {
					continue
				}
				seen[c.name] = true

				cap := HwAccelCapability{
					Name:     c.name,
					Encoder:  c.encoder,
					Decoder:  c.decoder,
					Platform: runtime.GOOS,
					Priority: c.priority,
				}
				result.Available = append(result.Available, cap)
				logger.Info().Str("name", c.name).Str("encoder", c.encoder).Msg("transcoder: Hardware accelerator detected")
			}
		}

		// Pick the best (highest priority)
		if len(result.Available) > 0 {
			best := result.Available[0]
			for _, cap := range result.Available[1:] {
				if cap.Priority > best.Priority {
					best = cap
				}
			}
			result.Best = &best
			logger.Info().Str("best", best.Name).Msg("transcoder: Best hardware accelerator selected")
		} else {
			logger.Warn().Msg("transcoder: No hardware acceleration detected, falling back to CPU (libx264)")
		}

		result.ProbeTime = time.Since(start)
		hwProbeResult = result
	})

	return hwProbeResult
}

// GetAutoHwAccelKind returns the best hardware accelerator name for use
// with GetHardwareAccelSettings. Returns "cpu" if none found.
func GetAutoHwAccelKind(ffmpegPath string, logger *zerolog.Logger) string {
	result := ProbeHardwareAccel(ffmpegPath, logger)
	if result.Best != nil {
		return result.Best.Name
	}
	return "cpu"
}

// queryEncoders calls `ffmpeg -encoders` and returns a set of available encoder names.
func queryEncoders(ffmpegPath string) map[string]bool {
	result := make(map[string]bool)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, ffmpegPath, "-encoders", "-hide_banner")
	output, err := cmd.Output()
	if err != nil {
		return result
	}

	for _, line := range strings.Split(string(output), "\n") {
		line = strings.TrimSpace(line)
		// Encoder lines look like: " V..... h264_nvenc  NVIDIA NVENC H.264 encoder"
		if len(line) > 8 && line[0] == 'V' {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				result[parts[1]] = true
			}
		}
	}

	return result
}

// ResetProbeCache clears the cached probe result, allowing re-probing.
// Useful for testing or when hardware configuration changes.
func ResetProbeCache() {
	hwProbeOnce = sync.Once{}
	hwProbeResult = nil
}

// FormatProbeReport returns a human-readable summary of probe results.
func FormatProbeReport(result *HwProbeResult) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Hardware Probe Results (took %v):\n", result.ProbeTime))

	if len(result.Available) == 0 {
		sb.WriteString("  No hardware accelerators detected.\n")
		sb.WriteString("  Using CPU (libx264) for transcoding.\n")
		return sb.String()
	}

	for _, cap := range result.Available {
		sb.WriteString(fmt.Sprintf("  ✓ %s (encoder: %s, priority: %d)\n", cap.Name, cap.Encoder, cap.Priority))
	}

	if result.Best != nil {
		sb.WriteString(fmt.Sprintf("  → Selected: %s\n", result.Best.Name))
	}

	return sb.String()
}
