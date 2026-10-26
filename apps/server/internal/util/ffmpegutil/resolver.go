package ffmpegutil

import (
	"context"
	"kamehouse/internal/util"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
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

	return installTarget(cacheDir, "ffmpeg")
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

	return installTarget(cacheDir, "ffprobe")
}

// installTarget es la ruta donde la descarga automática deja el binario: si aún no existe,
// la resolución devuelve esta ruta (no el nombre pelado) para que, cuando la descarga termine,
// los componentes que ya la guardaron al arrancar encuentren el binario sin reiniciar.
// Sin cacheDir no hay dónde instalar: se devuelve el nombre del sistema.
func installTarget(cacheDir, tool string) string {
	if cacheDir == "" {
		return tool
	}
	ext := ""
	if runtime.GOOS == "windows" {
		ext = ".exe"
	}
	return filepath.Join(cacheDir, "bin", tool+ext)
}

// binaryVersionEntry guarda la versión de un binario junto con el tamaño y la fecha con que
// se leyó: si el archivo cambia (reinstalación, actualización), la entrada deja de valer.
type binaryVersionEntry struct {
	size    int64
	modTime time.Time
	version string
}

// versionCache evita relanzar `<bin> -version` en cada consulta de estado: la pantalla de
// inicio pide el estado de FFmpeg al cargar, y cada consulta costaba dos procesos (~200 ms).
var versionCache sync.Map // ruta resuelta -> binaryVersionEntry

// GetBinaryVersion returns the first line of `<bin> -version` or empty string if not executable.
func GetBinaryVersion(binPath string) string {
	if binPath == "" {
		return ""
	}
	// LookPath resuelve rutas y nombres del PATH, igual que exec.Command.
	resolved, err := exec.LookPath(binPath)
	if err != nil {
		return ""
	}
	info, err := os.Stat(resolved)
	if err != nil {
		return ""
	}
	if cached, ok := versionCache.Load(resolved); ok {
		entry := cached.(binaryVersionEntry)
		if entry.size == info.Size() && entry.modTime.Equal(info.ModTime()) {
			return entry.version
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// util.NewCmdCtx oculta la consola: sin esto Windows abre una ventana por cada sondeo.
	out, err := util.NewCmdCtx(ctx, resolved, "-version").Output()
	if err != nil {
		return ""
	}

	version := ""
	lines := strings.Split(string(out), "\n")
	if len(lines) > 0 {
		version = strings.TrimSpace(lines[0])
	}
	versionCache.Store(resolved, binaryVersionEntry{size: info.Size(), modTime: info.ModTime(), version: version})
	return version
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
