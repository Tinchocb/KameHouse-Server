package ffmpegutil

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
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
	// SHA256 es el hash esperado del archivo descargado (hex). Si está vacío no se
	// verifica; si existe y no coincide, la descarga se rechaza y no se instala nada.
	SHA256 string
}

// Topes de tamaño: sin ellos, un servidor comprometido (o un archivo corrupto) podía
// llenar el disco durante la descarga o al descomprimir. Son variables para poder
// probarlos. Los paquetes reales pesan ~55 MB (Windows) y ~130 MB descomprimidos.
var (
	maxDownloadBytes        int64 = 300 << 20
	maxExtractedBinaryBytes int64 = 400 << 20
)

const ffbinariesBase = "https://github.com/vot/ffbinaries-prebuilt/releases/download/v6.1"

// ffbinariesSHA256 son los hashes SHA-256 de los paquetes de la versión v6.1 de
// ffbinaries-prebuilt que se descargan. Se calcularon el 30/09/2026 bajando cada archivo
// (los metadatos de la versión no publican hashes) y se comprobó que cada .zip está íntegro
// y contiene el binario esperado. Si el mantenedor vuelve a subir un archivo, la descarga
// se rechaza con un mensaje que incluye el hash nuevo: hay que revisarlo antes de actualizar
// esta tabla. Un paquete sin entrada aquí se descarga sin verificar.
var ffbinariesSHA256 = map[string]string{
	"ffmpeg-6.1-linux-32.zip":        "b5f9a9cc0c759b890a5f7dd87d902509e426508ff80fbbaa1d13f740b6e822b0",
	"ffmpeg-6.1-linux-64.zip":        "8bb4a27f5fd02f3dd9a5e75c9eddf6ace1d50a08929ee0d20bbf17eb467fb711",
	"ffmpeg-6.1-linux-arm-64.zip":    "0e3a60df317df0bbfbe25e8b777864b5407d166e5b5ac692fb1e477568a4c886",
	"ffmpeg-6.1-linux-armhf-32.zip":  "8766d3d118e589750dd35fdece8cb0e9b66deb22ff8dc35d4377915f73124dd5",
	"ffmpeg-6.1-macos-64.zip":        "ffcd56ce5ef50c4d36d675b0ee80674f5a0869f94746460ff5d058a33cbd3128",
	"ffmpeg-6.1-win-64.zip":          "b0fb4bcef9d4b5f7a77d2e4854f80d4ce3e43809bc29fd1f97caa1b467f96993",
	"ffprobe-6.1-linux-32.zip":       "93147de02c25a184b29882e03fdebe2d2f70736421c095fb96f09f00dc064a49",
	"ffprobe-6.1-linux-64.zip":       "cb690c360042b51d9e901db2b0185c585330c1067b5c5edf0b6a5e26e0375e2a",
	"ffprobe-6.1-linux-arm-64.zip":   "c99358a90d93ada454e2f4dd26cd25718d36b4032b0ad5539425eac6e66349d8",
	"ffprobe-6.1-linux-armhf-32.zip": "5445d7b9a5b4c9032f48a764c06838fa3568a7019bd5746c84d5c980c277bffd",
	"ffprobe-6.1-macos-64.zip":       "878ab8787ca6c48a11cb668c01d544be4c1bf655637d719cdf3b3179841545f2",
	"ffprobe-6.1-win-64.zip":         "3c0ea2856cf65edff23a2d4e76b1ceabba65fe8b1bed684ee2eeba24aa9427c3",
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
	return downloadSpecsFor(runtime.GOOS, runtime.GOARCH)
}

// downloadSpecsFor devuelve los paquetes de ffprobe y ffmpeg para una plataforma, o nil
// si no hay uno publicado. Los nombres son los de los archivos de la versión v6.1 de
// ffbinaries-prebuilt: todos son .zip y el de macOS se llama "macos-64". Antes se
// pedían .tar.gz en Linux y "osx-64" en macOS, que dan 404: la instalación automática
// solo funcionaba en Windows.
func downloadSpecsFor(goos, goarch string) []binaryDownloadSpec {
	var suffix string
	switch goos {
	case "windows":
		suffix = "win-64"
	case "linux":
		switch goarch {
		case "amd64":
			suffix = "linux-64"
		case "386":
			suffix = "linux-32"
		case "arm64":
			suffix = "linux-arm-64"
		case "arm":
			suffix = "linux-armhf-32"
		}
	case "darwin":
		suffix = "macos-64" // en Apple Silicon corre con Rosetta
	}
	if suffix == "" {
		return nil
	}
	spec := func(name, tool string) binaryDownloadSpec {
		asset := fmt.Sprintf("%s-6.1-%s.zip", tool, suffix)
		return binaryDownloadSpec{
			Name:   name,
			URLs:   []string{ffbinariesBase + "/" + asset},
			IsZip:  true,
			SHA256: ffbinariesSHA256[asset],
		}
	}
	return []binaryDownloadSpec{spec("FFprobe", "ffprobe"), spec("FFmpeg", "ffmpeg")}
}

func downloadAndExtractSpec(ctx context.Context, spec binaryDownloadSpec, binDir string, onProgress ProgressCallback, logger *zerolog.Logger) error {
	var lastErr error
	for _, url := range spec.URLs {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		logger.Info().Str("url", url).Str("name", spec.Name).Msg("ffmpegutil: Descargando paquete")
		err := downloadAndExtractURL(ctx, url, spec.IsZip, spec.SHA256, binDir, onProgress)
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

func downloadAndExtractURL(ctx context.Context, url string, isZip bool, wantSHA256 string, binDir string, onProgress ProgressCallback) error {
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

		if resp.ContentLength > maxDownloadBytes {
			resp.Body.Close()
			return fmt.Errorf("el archivo a descargar pesa %d bytes y el máximo admitido es %d", resp.ContentLength, maxDownloadBytes)
		}

		tmpFile, err := os.CreateTemp("", "ffmpeg-dl-*")
		if err != nil {
			resp.Body.Close()
			return fmt.Errorf("error creando archivo temporal: %w", err)
		}
		tmpPath := tmpFile.Name()
		cleanupTemp := func() {
			_ = tmpFile.Close()
			_ = os.Remove(tmpPath)
		}

		pr := &progressReader{
			Reader: resp.Body,
			total:  resp.ContentLength,
			onProgress: func(pct int) {
				if onProgress != nil {
					onProgress(pct, "Descargando paquete...")
				}
			},
		}

		hasher := sha256.New()
		written, err := io.Copy(io.MultiWriter(tmpFile, hasher), io.LimitReader(pr, maxDownloadBytes+1))
		if err == nil && written > maxDownloadBytes {
			resp.Body.Close()
			cleanupTemp()
			return fmt.Errorf("la descarga supera el máximo admitido de %d bytes", maxDownloadBytes)
		}
		if err != nil {
			resp.Body.Close()
			cleanupTemp()
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

		if wantSHA256 != "" {
			if got := hex.EncodeToString(hasher.Sum(nil)); !strings.EqualFold(got, wantSHA256) {
				cleanupTemp()
				return fmt.Errorf("el hash SHA-256 del archivo descargado no coincide (esperado %s, obtenido %s): no se instaló nada", wantSHA256, got)
			}
		}

		if onProgress != nil {
			onProgress(85, "Descomprimiendo binarios...")
		}

		if _, err := tmpFile.Seek(0, 0); err != nil {
			cleanupTemp()
			return err
		}

		var extractErr error
		if isZip {
			extractErr = extractBinariesFromZip(tmpFile, binDir)
		} else {
			extractErr = extractBinariesFromTarGz(tmpFile, binDir)
		}

		if extractErr != nil {
			cleanupTemp()
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

		cleanupTemp()

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

		if f.UncompressedSize64 > uint64(maxExtractedBinaryBytes) {
			return fmt.Errorf("%s descomprimido supera el máximo admitido de %d bytes", baseName, maxExtractedBinaryBytes)
		}

		rc, err := f.Open()
		if err != nil {
			return err
		}
		err = writeBinaryAtomic(binDir, baseName, rc)
		rc.Close()
		if err != nil {
			return err
		}
	}

	return nil
}

// writeBinaryAtomic escribe el binario en un archivo temporal de la misma carpeta y
// recién al terminar bien lo renombra: un corte o un archivo corrupto a mitad de camino
// ya no deja un ffmpeg truncado en lugar del que funcionaba. Además limita el tamaño.
func writeBinaryAtomic(binDir, baseName string, r io.Reader) error {
	tmp, err := os.CreateTemp(binDir, baseName+".*.tmp")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	cleanup := func() { _ = os.Remove(tmpPath) }

	n, copyErr := io.Copy(tmp, io.LimitReader(r, maxExtractedBinaryBytes+1))
	closeErr := tmp.Close()
	if copyErr != nil {
		cleanup()
		return copyErr
	}
	if n > maxExtractedBinaryBytes {
		cleanup()
		return fmt.Errorf("%s descomprimido supera el máximo admitido de %d bytes", baseName, maxExtractedBinaryBytes)
	}
	if closeErr != nil {
		cleanup()
		return closeErr
	}
	if err := os.Chmod(tmpPath, 0o755); err != nil {
		cleanup()
		return err
	}
	if err := os.Rename(tmpPath, filepath.Join(binDir, baseName)); err != nil {
		cleanup()
		return err
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

		if err := writeBinaryAtomic(binDir, baseName, tr); err != nil {
			return err
		}
	}

	return nil
}
