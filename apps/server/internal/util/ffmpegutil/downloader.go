package ffmpegutil

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

type binaryDownloadSpec struct {
	Name  string   // "ffmpeg" or "ffprobe" or "bundle"
	URLs  []string // Primary and fallback URLs
	IsZip bool
}

// Manager coordinates status checking and downloading of FFmpeg/FFprobe binaries.
type Manager struct {
	cacheDir      string
	logger        *zerolog.Logger
	mu            sync.Mutex
	isDownloading bool
	progress      int
	status        string
	lastError     string
}

func NewManager(cacheDir string, logger *zerolog.Logger) *Manager {
	return &Manager{
		cacheDir: cacheDir,
		logger:   logger,
	}
}

// GetStatus returns the current installation and download status.
func (m *Manager) GetStatus(customFfmpeg, customFfprobe string) FFmpegStatus {
	m.mu.Lock()
	defer m.mu.Unlock()

	status := GetStatus(m.cacheDir, customFfmpeg, customFfprobe)
	status.IsDownloading = m.isDownloading
	status.DownloadProgress = m.progress
	status.DownloadStatus = m.status
	status.LastError = m.lastError
	return status
}

// EnsureBinaries checks if FFmpeg and FFprobe are available. If not, it downloads them in the background or synchronously.
func (m *Manager) EnsureBinaries(ctx context.Context, onProgress ProgressCallback) error {
	m.mu.Lock()
	if m.isDownloading {
		m.mu.Unlock()
		return fmt.Errorf("ffmpeg download is already in progress")
	}
	m.isDownloading = true
	m.progress = 0
	m.status = "Iniciando descarga de FFmpeg..."
	m.lastError = ""
	m.mu.Unlock()

	defer func() {
		m.mu.Lock()
		m.isDownloading = false
		m.mu.Unlock()
	}()

	updateProgress := func(pct int, msg string) {
		m.mu.Lock()
		m.progress = pct
		m.status = msg
		m.mu.Unlock()
		if onProgress != nil {
			onProgress(pct, msg)
		}
	}

	binDir := filepath.Join(m.cacheDir, "bin")
	if err := os.MkdirAll(binDir, 0755); err != nil {
		errStr := fmt.Sprintf("Error creando directorio de binarios: %v", err)
		m.mu.Lock()
		m.lastError = errStr
		m.mu.Unlock()
		return err
	}

	specs := getDownloadSpecsForHost()
	if len(specs) == 0 {
		errStr := fmt.Sprintf("Plataforma no soportada para descarga automática: %s/%s", runtime.GOOS, runtime.GOARCH)
		m.mu.Lock()
		m.lastError = errStr
		m.mu.Unlock()
		return fmt.Errorf("%s", errStr)
	}

	totalSteps := len(specs)
	for i, spec := range specs {
		stepStartPct := (i * 100) / totalSteps
		stepEndPct := ((i + 1) * 100) / totalSteps

		updateProgress(stepStartPct, fmt.Sprintf("Descargando %s...", spec.Name))

		err := downloadAndExtractSpec(ctx, spec, binDir, func(itemPct int, itemMsg string) {
			actualPct := stepStartPct + (itemPct * (stepEndPct - stepStartPct) / 100)
			updateProgress(actualPct, itemMsg)
		}, m.logger)

		if err != nil {
			errStr := fmt.Sprintf("Error descargando %s: %v", spec.Name, err)
			m.mu.Lock()
			m.lastError = errStr
			m.mu.Unlock()
			return err
		}
	}

	updateProgress(100, "Instalación de FFmpeg y FFprobe completada exitosamente.")
	return nil
}

func getDownloadSpecsForHost() []binaryDownloadSpec {
	osName := runtime.GOOS
	arch := runtime.GOARCH

	switch osName {
	case "windows":
		return []binaryDownloadSpec{
			{
				Name: "FFprobe",
				URLs: []string{
					"https://github.com/vot/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-win-64.zip",
				},
				IsZip: true,
			},
			{
				Name: "FFmpeg",
				URLs: []string{
					"https://github.com/vot/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-64.zip",
				},
				IsZip: true,
			},
		}

	case "linux":
		archStr := "64"
		if arch == "arm64" {
			archStr = "arm-64"
		} else if arch == "arm" {
			archStr = "arm-32"
		}
		return []binaryDownloadSpec{
			{
				Name: "FFprobe",
				URLs: []string{
					fmt.Sprintf("https://github.com/vot/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-linux-%s.tar.gz", archStr),
				},
				IsZip: false,
			},
			{
				Name: "FFmpeg",
				URLs: []string{
					fmt.Sprintf("https://github.com/vot/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-linux-%s.tar.gz", archStr),
				},
				IsZip: false,
			},
		}

	case "darwin":
		return []binaryDownloadSpec{
			{
				Name: "FFprobe",
				URLs: []string{
					"https://github.com/vot/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-osx-64.zip",
				},
				IsZip: true,
			},
			{
				Name: "FFmpeg",
				URLs: []string{
					"https://github.com/vot/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-osx-64.zip",
				},
				IsZip: true,
			},
		}
	}

	return nil
}

func downloadAndExtractSpec(ctx context.Context, spec binaryDownloadSpec, binDir string, onProgress ProgressCallback, logger *zerolog.Logger) error {
	var lastErr error
	for _, url := range spec.URLs {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		logger.Info().Str("url", url).Str("name", spec.Name).Msg("ffmpegutil: Descargando paquete")
		err := downloadAndExtractURL(ctx, url, spec.IsZip, binDir, onProgress)
		if err == nil {
			return nil
		}
		lastErr = err
		logger.Warn().Err(err).Str("url", url).Msg("ffmpegutil: Falló descarga de URL, reintentando...")
	}
	return lastErr
}

type progressReader struct {
	io.Reader
	total      int64
	current    int64
	onProgress func(percent int)
}

func (pr *progressReader) Read(p []byte) (int, error) {
	n, err := pr.Reader.Read(p)
	if n > 0 {
		pr.current += int64(n)
		if pr.total > 0 && pr.onProgress != nil {
			pct := int((pr.current * 80) / pr.total) // Download accounts for 0-80%
			pr.onProgress(pct)
		}
	}
	return n, err
}

func downloadAndExtractURL(ctx context.Context, url string, isZip bool, binDir string, onProgress ProgressCallback) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}

	// 3 min total timeout with per-attempt retry logic
	const maxAttempts = 3
	const baseTimeout = 3 * time.Minute
	var lastErr error

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		// Create a client with per-attempt timeout
		client := &http.Client{Timeout: baseTimeout}

		var logger *zerolog.Logger
		if attempt > 1 {
			l := zerolog.DefaultContextLogger.With().Int("attempt", attempt).Logger()
			logger = &l
			logger.Info().Str("url", url).Msg("ffmpegutil: Reintentando descarga...")
		}

		resp, err := client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("error al conectar con servidor de descarga (%s): %w", url, err)
			if attempt < maxAttempts {
				waitTime := time.Duration(attempt*attempt) * 5 * time.Second // 5s, 20s, 45s
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(waitTime):
					// Retry with fresh request (context may have updated headers)
					req = req.WithContext(ctx)
					continue
				}
			}
			return lastErr
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			lastErr = fmt.Errorf("código HTTP inesperado: %d desde %s", resp.StatusCode, url)
			if attempt < maxAttempts {
				waitTime := time.Duration(attempt*attempt) * 5 * time.Second
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(waitTime):
					req = req.WithContext(ctx)
					continue
				}
			}
			return lastErr
		}

		tmpFile, err := os.CreateTemp("", "ffmpeg-dl-*")
		if err != nil {
			resp.Body.Close()
			return fmt.Errorf("error creando archivo temporal: %w", err)
		}
		defer os.Remove(tmpFile.Name())
		defer tmpFile.Close()

		pr := &progressReader{
			Reader: resp.Body,
			total:  resp.ContentLength,
			onProgress: func(pct int) {
				if onProgress != nil {
					onProgress(pct, "Descargando paquete...")
				}
			},
		}

		if _, err := io.Copy(tmpFile, pr); err != nil {
			resp.Body.Close()
			lastErr = fmt.Errorf("error guardando archivo descargado: %w", err)
			if attempt < maxAttempts {
				waitTime := time.Duration(attempt*attempt) * 5 * time.Second
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(waitTime):
					req = req.WithContext(ctx)
					continue
				}
			}
			return lastErr
		}
		resp.Body.Close()

		if onProgress != nil {
			onProgress(85, "Descomprimiendo binarios...")
		}

		if _, err := tmpFile.Seek(0, 0); err != nil {
			return err
		}

		var extractErr error
		if isZip {
			extractErr = extractBinariesFromZip(tmpFile, binDir)
		} else {
			extractErr = extractBinariesFromTarGz(tmpFile, binDir)
		}

		if extractErr != nil {
			lastErr = fmt.Errorf("error descomprimiendo: %w", extractErr)
			if attempt < maxAttempts {
				waitTime := time.Duration(attempt*attempt) * 5 * time.Second
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(waitTime):
					req = req.WithContext(ctx)
					continue
				}
			}
			return lastErr
		}

		if onProgress != nil {
			onProgress(100, "Binarios listos")
		}

		return nil
	}

	return lastErr
}

func isTargetBinary(name string) bool {
	clean := strings.ToLower(filepath.Base(name))
	return clean == "ffmpeg.exe" || clean == "ffprobe.exe" || clean == "ffmpeg" || clean == "ffprobe"
}

func extractBinariesFromZip(tmpFile *os.File, binDir string) error {
	archiveSize, err := tmpFile.Seek(0, io.SeekEnd)
	if err != nil {
		return err
	}
	if _, err := tmpFile.Seek(0, 0); err != nil {
		return err
	}

	zr, err := zip.NewReader(tmpFile, archiveSize)
	if err != nil {
		return err
	}

	for _, f := range zr.File {
		baseName := filepath.Base(f.Name)
		if !isTargetBinary(baseName) {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			return err
		}

		targetPath := filepath.Join(binDir, baseName)
		out, err := os.OpenFile(targetPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
		if err != nil {
			rc.Close()
			return err
		}

		_, copyErr := io.Copy(out, rc)
		out.Close()
		rc.Close()

		if copyErr != nil {
			return copyErr
		}
	}

	return nil
}

func extractBinariesFromTarGz(tmpFile *os.File, binDir string) error {
	if _, err := tmpFile.Seek(0, 0); err != nil {
		return err
	}

	gr, err := gzip.NewReader(tmpFile)
	if err != nil {
		return err
	}
	defer gr.Close()

	tr := tar.NewReader(gr)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		baseName := filepath.Base(header.Name)
		if !isTargetBinary(baseName) {
			continue
		}

		targetPath := filepath.Join(binDir, baseName)
		out, err := os.OpenFile(targetPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
		if err != nil {
			return err
		}

		_, copyErr := io.Copy(out, tr)
		out.Close()

		if copyErr != nil {
			return copyErr
		}
	}

	return nil
}
