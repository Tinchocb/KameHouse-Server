package skipdetect

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/goccy/go-json"
)

// CachedFingerprint representa el payload persistido en disco de una huella de audio.
type CachedFingerprint struct {
	Duration    float64 `json:"duration"`
	Fingerprint []int   `json:"fingerprint"`
}

// ComputeFingerprintCacheKey genera una clave SHA-256 única y estable a partir de:
// ruta absoluta, tamaño del archivo, timestamp de modificación (nano),
// ventana de tiempo (startSec, lengthSec con 3 decimales) y audioIdx.
func ComputeFingerprintCacheKey(path string, startSec, lengthSec float64, audioIdx int) (string, error) {
	fi, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	absPath, err := filepath.Abs(path)
	if err != nil {
		absPath = filepath.Clean(path)
	}

	payload := fmt.Sprintf("%s|%d|%d|%.3f|%.3f|%d", absPath, fi.Size(), fi.ModTime().UnixNano(), startSec, lengthSec, audioIdx)
	sum := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(sum[:]), nil
}

// ComputeFileFingerprintCacheKey genera una clave SHA-256 para un archivo completo o con lengthSec.
func ComputeFileFingerprintCacheKey(path string, lengthSec int) (string, error) {
	fi, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	absPath, err := filepath.Abs(path)
	if err != nil {
		absPath = filepath.Clean(path)
	}

	payload := fmt.Sprintf("file|%s|%d|%d|%d", absPath, fi.Size(), fi.ModTime().UnixNano(), lengthSec)
	sum := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(sum[:]), nil
}

// GetCachedFingerprint lee la huella de disco si existe en {cacheDir}/skipdetect/fp/{key}.json.
// Devuelve nil, false si no existe o si el archivo está corrupto.
func GetCachedFingerprint(cacheDir, key string) (*CachedFingerprint, bool) {
	if cacheDir == "" || key == "" {
		return nil, false
	}
	fpPath := filepath.Join(cacheDir, "skipdetect", "fp", key+".json")
	data, err := os.ReadFile(fpPath)
	if err != nil {
		return nil, false
	}
	var res CachedFingerprint
	if err := json.Unmarshal(data, &res); err != nil {
		_ = os.Remove(fpPath)
		return nil, false
	}
	if len(res.Fingerprint) == 0 {
		return nil, false
	}
	return &res, true
}

// PutCachedFingerprint guarda la huella de forma atómica en {cacheDir}/skipdetect/fp/{key}.json.
func PutCachedFingerprint(cacheDir, key string, fp *CachedFingerprint) error {
	if cacheDir == "" || key == "" || fp == nil || len(fp.Fingerprint) == 0 {
		return nil
	}
	dir := filepath.Join(cacheDir, "skipdetect", "fp")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.Marshal(fp)
	if err != nil {
		return err
	}

	dest := filepath.Join(dir, key+".json")
	tmp := filepath.Join(dir, fmt.Sprintf("%s.tmp.%d", key, time.Now().UnixNano()))
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		return err
	}

	// En Windows os.Rename falla si dest existe; Remove previo es seguro
	_ = os.Remove(dest)
	if err := os.Rename(tmp, dest); err != nil {
		_ = os.Remove(tmp)
		// Si falló pero dest ya existe, no es un error crítico
		if _, statErr := os.Stat(dest); statErr == nil {
			return nil
		}
		return err
	}
	return nil
}

// FingerprintRangeCached huella una ventana [startSec, startSec+lengthSec] de path
// consultando primero la caché en disco si cacheDir != "".
func FingerprintRangeCached(ctx context.Context, cacheDir, fpcalcBin, ffmpegPath, path string, startSec, lengthSec float64, audioIdx int) ([]int, float64, error) {
	var key string
	if cacheDir != "" {
		if k, err := ComputeFingerprintCacheKey(path, startSec, lengthSec, audioIdx); err == nil {
			key = k
			if cached, ok := GetCachedFingerprint(cacheDir, key); ok {
				return cached.Fingerprint, cached.Duration, nil
			}
		}
	}

	fp, dur, err := FingerprintRange(ctx, fpcalcBin, ffmpegPath, path, startSec, lengthSec, audioIdx)
	if err != nil {
		return nil, 0, err
	}

	if cacheDir != "" && key != "" && len(fp) > 0 {
		_ = PutCachedFingerprint(cacheDir, key, &CachedFingerprint{
			Duration:    dur,
			Fingerprint: fp,
		})
	}
	return fp, dur, nil
}

// FingerprintFileCached huella un archivo con fpcalc directo, consultando caché si cacheDir != "".
func FingerprintFileCached(ctx context.Context, cacheDir, fpcalcBin, path string, lengthSec int) ([]int, float64, error) {
	var key string
	if cacheDir != "" {
		if k, err := ComputeFileFingerprintCacheKey(path, lengthSec); err == nil {
			key = k
			if cached, ok := GetCachedFingerprint(cacheDir, key); ok {
				return cached.Fingerprint, cached.Duration, nil
			}
		}
	}

	fp, dur, err := FingerprintFile(ctx, fpcalcBin, path, lengthSec)
	if err != nil {
		return nil, 0, err
	}

	if cacheDir != "" && key != "" && len(fp) > 0 {
		_ = PutCachedFingerprint(cacheDir, key, &CachedFingerprint{
			Duration:    dur,
			Fingerprint: fp,
		})
	}
	return fp, dur, nil
}
