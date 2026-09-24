package ffmpegutil

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// ResolveFFmpegPath resolves the absolute or system path for ffmpeg.
// isPathSafeBinary verifies that a custom binary path is either:
// 1. Located inside the application's trusted cacheDir/bin directory, OR
// 2. A system-installed binary discoverable via exec.LookPath.
func isPathSafeBinary(cacheDir, customPath, binaryName string) bool {
	if customPath == "" || customPath == binaryName {
		return false
	}

	cleanCustom := filepath.Clean(customPath)

	// Check 1: Must be inside trusted {cacheDir}/bin
	if cacheDir != "" {
		binDir := filepath.Clean(filepath.Join(cacheDir, "bin"))
		rel, err := filepath.Rel(binDir, cleanCustom)
		if err == nil && rel != "." && rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
			if fi, err := os.Stat(cleanCustom); err == nil && !fi.IsDir() {
				return true
			}
		}
	}

	// Check 2: The base name is an official tool name ("ffmpeg" / "ffprobe") AND
	// LookPath on that base name finds this exact binary in system PATH.
	baseName := filepath.Base(cleanCustom)
	baseWithoutExt := strings.TrimSuffix(baseName, filepath.Ext(baseName))
	if strings.EqualFold(baseWithoutExt, binaryName) {
		if lp, err := exec.LookPath(baseName); err == nil {
			if absLp, err := filepath.Abs(lp); err == nil {
				if absCustom, err := filepath.Abs(cleanCustom); err == nil {
					if strings.EqualFold(absLp, absCustom) {
						if fi, err := os.Stat(absCustom); err == nil && !fi.IsDir() {
							return true
						}
					}
				}
			}
		}
	}

	return false
}

// ResolveFFmpegPath resolves the absolute or system path for ffmpeg.
// Priority:
// 1. Valid custom path ONLY if inside {cacheDir}/bin or found via exec.LookPath.
// 2. Application cache directory: {cacheDir}/bin/ffmpeg[.exe].
// 3. System PATH (exec.LookPath).
// 4. Default fallback: "ffmpeg".
func ResolveFFmpegPath(cacheDir, customPath string) string {
	if isPathSafeBinary(cacheDir, customPath, "ffmpeg") {
		return customPath
	}

	if cacheDir != "" {
		ext := ""
		if runtime.GOOS == "windows" {
			ext = ".exe"
		}
		cached := filepath.Join(cacheDir, "bin", "ffmpeg"+ext)
		if fi, err := os.Stat(cached); err == nil && !fi.IsDir() {
			return cached
		}
	}

	if p, err := exec.LookPath("ffmpeg"); err == nil {
		return p
	}

	return "ffmpeg"
}

// ResolveFFprobePath resolves the absolute or system path for ffprobe.
// Priority:
// 1. Valid custom path ONLY if inside {cacheDir}/bin or found via exec.LookPath.
// 2. Application cache directory: {cacheDir}/bin/ffprobe[.exe].
// 3. System PATH (exec.LookPath).
// 4. Default fallback: "ffprobe".
func ResolveFFprobePath(cacheDir, customPath string) string {
	if isPathSafeBinary(cacheDir, customPath, "ffprobe") {
		return customPath
	}

	if cacheDir != "" {
		ext := ""
		if runtime.GOOS == "windows" {
			ext = ".exe"
		}
		cached := filepath.Join(cacheDir, "bin", "ffprobe"+ext)
		if fi, err := os.Stat(cached); err == nil && !fi.IsDir() {
			return cached
		}
	}

	if p, err := exec.LookPath("ffprobe"); err == nil {
		return p
	}

	return "ffprobe"
}

// IsBinaryExecutable checks if the binary exists and can execute `-version`.
func IsBinaryExecutable(binPath string) bool {
	if binPath == "" {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, binPath, "-version")
	err := cmd.Run()
	return err == nil
}

// GetBinaryVersion returns the first line of `<bin> -version` or empty string if not executable.
func GetBinaryVersion(binPath string) string {
	if binPath == "" {
		return ""
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	out, err := exec.CommandContext(ctx, binPath, "-version").Output()
	if err != nil {
		return ""
	}

	lines := strings.Split(string(out), "\n")
	if len(lines) > 0 {
		return strings.TrimSpace(lines[0])
	}
	return ""
}

// GetStatus returns the current status and resolved paths for FFmpeg and FFprobe.
func GetStatus(cacheDir, customFfmpeg, customFfprobe string) FFmpegStatus {
	resolvedFfmpeg := ResolveFFmpegPath(cacheDir, customFfmpeg)
	resolvedFfprobe := ResolveFFprobePath(cacheDir, customFfprobe)

	ffmpegVer := GetBinaryVersion(resolvedFfmpeg)
	ffprobeVer := GetBinaryVersion(resolvedFfprobe)

	return FFmpegStatus{
		FFmpegAvailable:  ffmpegVer != "",
		FFprobeAvailable: ffprobeVer != "",
		FFmpegPath:       resolvedFfmpeg,
		FFprobePath:      resolvedFfprobe,
		FFmpegVersion:    ffmpegVer,
		FFprobeVersion:   ffprobeVer,
	}
}
