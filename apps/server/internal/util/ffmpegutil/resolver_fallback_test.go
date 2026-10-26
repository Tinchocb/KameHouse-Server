package ffmpegutil

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// Sin binario en caché ni en PATH, la ruta resuelta es donde la descarga lo dejará: los
// componentes que la guardan al arrancar encuentran el binario después de instalarlo.
func TestResolveSinBinarioDevuelveLaRutaDeDescarga(t *testing.T) {
	t.Setenv("PATH", "")
	dir := t.TempDir()
	ext := ""
	if runtime.GOOS == "windows" {
		ext = ".exe"
	}

	wantFFmpeg := filepath.Join(dir, "bin", "ffmpeg"+ext)
	if got := ResolveFFmpegPath(dir, ""); got != wantFFmpeg {
		t.Fatalf("ffmpeg sin binario: got %s, want %s", got, wantFFmpeg)
	}
	wantFFprobe := filepath.Join(dir, "bin", "ffprobe"+ext)
	if got := ResolveFFprobePath(dir, ""); got != wantFFprobe {
		t.Fatalf("ffprobe sin binario: got %s, want %s", got, wantFFprobe)
	}

	// Tras la descarga, la misma ruta que ya se guardó apunta al binario instalado.
	if err := os.MkdirAll(filepath.Join(dir, "bin"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(wantFFmpeg, []byte("bin"), 0755); err != nil {
		t.Fatal(err)
	}
	if got := ResolveFFmpegPath(dir, ""); got != wantFFmpeg {
		t.Fatalf("ffmpeg instalado: got %s, want %s", got, wantFFmpeg)
	}
}

// Sin cacheDir no hay dónde instalar: se mantiene el nombre del sistema.
func TestResolveSinCacheDevuelveNombreDelSistema(t *testing.T) {
	t.Setenv("PATH", "")
	if got := ResolveFFmpegPath("", ""); got != "ffmpeg" {
		t.Fatalf("got %s, want ffmpeg", got)
	}
	if got := ResolveFFprobePath("", ""); got != "ffprobe" {
		t.Fatalf("got %s, want ffprobe", got)
	}
}

// El enlace completo: lo que deja la descarga (extractBinariesFromZip) es lo que el resolver busca,
// así las rutas que se guardaron al arrancar funcionan después de instalar, sin reiniciar.
func TestZipDeLaDescargaLoEncuentraElResolver(t *testing.T) {
	t.Setenv("PATH", "")
	ext := ""
	if runtime.GOOS == "windows" {
		ext = ".exe"
	}
	zipBytes := buildZip(t, map[string]string{"ffmpeg" + ext: "ff", "ffprobe" + ext: "fp"})
	f, err := os.CreateTemp(t.TempDir(), "z-*")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if _, err := f.Write(zipBytes); err != nil {
		t.Fatal(err)
	}

	cacheDir := t.TempDir()
	binDir := filepath.Join(cacheDir, "bin")
	if err := os.MkdirAll(binDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := extractBinariesFromZip(f, binDir); err != nil {
		t.Fatal(err)
	}
	if got := ResolveFFmpegPath(cacheDir, ""); got != filepath.Join(binDir, "ffmpeg"+ext) {
		t.Fatalf("ffmpeg instalado: got %s", got)
	}
	if got := ResolveFFprobePath(cacheDir, ""); got != filepath.Join(binDir, "ffprobe"+ext) {
		t.Fatalf("ffprobe instalado: got %s", got)
	}
}
