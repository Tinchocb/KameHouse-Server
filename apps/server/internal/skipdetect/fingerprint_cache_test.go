package skipdetect

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestFingerprintCachePutGet(t *testing.T) {
	tmpDir := t.TempDir()

	key := "test_key_123"
	cached := &CachedFingerprint{
		Duration:    120.5,
		Fingerprint: []int{101, 102, 103, 104},
	}

	// Al inicio no existe
	if _, ok := GetCachedFingerprint(tmpDir, key); ok {
		t.Fatalf("se esperaba que no existiera el key antes de guardar")
	}

	// Guardamos
	if err := PutCachedFingerprint(tmpDir, key, cached); err != nil {
		t.Fatalf("PutCachedFingerprint falló: %v", err)
	}

	// Recuperamos
	got, ok := GetCachedFingerprint(tmpDir, key)
	if !ok || got == nil {
		t.Fatalf("se esperaba recuperar el fingerprint de caché")
	}
	if got.Duration != cached.Duration {
		t.Errorf("duración esperada %v, obtenida %v", cached.Duration, got.Duration)
	}
	if len(got.Fingerprint) != len(cached.Fingerprint) || got.Fingerprint[0] != 101 {
		t.Errorf("fingerprint recuperado no coincide: %v", got.Fingerprint)
	}
}

func TestComputeFingerprintCacheKey(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "sample.mp4")
	if err := os.WriteFile(testFile, []byte("fake video content"), 0644); err != nil {
		t.Fatalf("falló crear archivo de prueba: %v", err)
	}

	k1, err := ComputeFingerprintCacheKey(testFile, 0, 150, 0)
	if err != nil {
		t.Fatalf("ComputeFingerprintCacheKey falló: %v", err)
	}
	if k1 == "" {
		t.Fatalf("clave vacía")
	}

	// Misma entrada -> misma clave
	k2, _ := ComputeFingerprintCacheKey(testFile, 0, 150, 0)
	if k1 != k2 {
		t.Fatalf("se esperaba clave determinista, got %s != %s", k1, k2)
	}

	// Distinto audioIdx -> distinta clave
	k3, _ := ComputeFingerprintCacheKey(testFile, 0, 150, 1)
	if k1 == k3 {
		t.Fatalf("se esperaba distinta clave para distinto audioIdx")
	}

	// Distinto startSec -> distinta clave
	k4, _ := ComputeFingerprintCacheKey(testFile, 10, 150, 0)
	if k1 == k4 {
		t.Fatalf("se esperaba distinta clave para distinto startSec")
	}

	// Modificación del archivo -> distinta clave
	time.Sleep(10 * time.Millisecond)
	if err := os.WriteFile(testFile, []byte("fake video content modified"), 0644); err != nil {
		t.Fatalf("falló modificar archivo: %v", err)
	}
	k5, _ := ComputeFingerprintCacheKey(testFile, 0, 150, 0)
	if k1 == k5 {
		t.Fatalf("se esperaba distinta clave tras modificar el archivo")
	}
}
