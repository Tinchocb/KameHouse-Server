package skipdetect

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func tmpArchive(t *testing.T, data []byte) *os.File {
	t.Helper()
	f, err := os.CreateTemp(t.TempDir(), "a-*")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = f.Close() })
	_, _ = f.Write(data)
	_, _ = f.Seek(0, 0) // como hace ensureFpcalc antes de extraer
	return f
}

func zipWith(t *testing.T, name, content string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, _ := zw.Create(name)
	_, _ = w.Write([]byte(content))
	_ = zw.Close()
	return buf.Bytes()
}

func tarGzWith(t *testing.T, name, content string) []byte {
	t.Helper()
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	_ = tw.WriteHeader(&tar.Header{Name: name, Mode: 0o755, Size: int64(len(content))})
	_, _ = tw.Write([]byte(content))
	_ = tw.Close()
	_ = gz.Close()
	return buf.Bytes()
}

func fileText(t *testing.T, p string) string {
	t.Helper()
	b, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func TestExtraerFpcalcDeZipYDeTarGz(t *testing.T) {
	dest := filepath.Join(t.TempDir(), "fpcalc")
	if err := extractFpcalcFromZip(tmpArchive(t, zipWith(t, "chromaprint/bin/fpcalc", "desde-zip")), dest); err != nil {
		t.Fatal(err)
	}
	if fileText(t, dest) != "desde-zip" {
		t.Error("contenido incorrecto del zip")
	}

	dest2 := filepath.Join(t.TempDir(), "fpcalc")
	if err := extractFpcalcFromTarGz(tmpArchive(t, tarGzWith(t, "x/fpcalc", "desde-tar")), dest2); err != nil {
		t.Fatal(err)
	}
	if fileText(t, dest2) != "desde-tar" {
		t.Error("contenido incorrecto del tar.gz")
	}
}

func TestExtraerFpcalcSinElBinarioDaError(t *testing.T) {
	dest := filepath.Join(t.TempDir(), "fpcalc")
	if err := extractFpcalcFromZip(tmpArchive(t, zipWith(t, "otro.txt", "x")), dest); err == nil {
		t.Error("un zip sin fpcalc debía dar error")
	}
	if _, err := os.Stat(dest); err == nil {
		t.Error("no debía crearse el destino")
	}
}

// ensureFpcalc da por instalado cualquier archivo que exista en la ruta final: si una
// extracción cortada dejaba un binario truncado ahí, se usaba para siempre.
func TestExtraerFpcalcQueSuperaElTopeNoDejaNadaEnLaRutaFinal(t *testing.T) {
	old := maxFpcalcBytes
	maxFpcalcBytes = 512
	t.Cleanup(func() { maxFpcalcBytes = old })

	dir := t.TempDir()
	dest := filepath.Join(dir, "fpcalc")
	if err := extractFpcalcFromZip(tmpArchive(t, zipWith(t, "fpcalc", strings.Repeat("x", 4096))), dest); err == nil {
		t.Fatal("se esperaba un error por superar el tope")
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 0 {
		t.Errorf("no debía quedar nada (ni truncado ni temporales): %v", entries)
	}
	if err := extractFpcalcFromTarGz(tmpArchive(t, tarGzWith(t, "fpcalc", strings.Repeat("x", 4096))), dest); err == nil {
		t.Fatal("el tar.gz también debía rechazarse")
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 0 {
		t.Errorf("no debía quedar nada: %v", entries)
	}
}

func TestExtraerFpcalcReemplazaUnBinarioAnteriorSinTemporales(t *testing.T) {
	dir := t.TempDir()
	dest := filepath.Join(dir, "fpcalc")
	_ = os.WriteFile(dest, []byte("viejo"), 0o644)
	if err := extractFpcalcFromZip(tmpArchive(t, zipWith(t, "fpcalc", "nuevo")), dest); err != nil {
		t.Fatal(err)
	}
	if fileText(t, dest) != "nuevo" {
		t.Error("no se reemplazó")
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 1 {
		t.Errorf("quedaron temporales: %v", entries)
	}
}
