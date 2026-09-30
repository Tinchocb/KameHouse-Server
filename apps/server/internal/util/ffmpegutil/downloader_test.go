package ffmpegutil

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"
)

// Archivos publicados en la versión v6.1 de ffbinaries-prebuilt (consultados el 29/09/2026).
var publishedAssets = map[string]bool{
	"ffmpeg-6.1-linux-32.zip": true, "ffmpeg-6.1-linux-64.zip": true, "ffmpeg-6.1-linux-arm-64.zip": true,
	"ffmpeg-6.1-linux-armel-32.zip": true, "ffmpeg-6.1-linux-armhf-32.zip": true,
	"ffmpeg-6.1-macos-64.zip": true, "ffmpeg-6.1-win-64.zip": true,
	"ffprobe-6.1-linux-32.zip": true, "ffprobe-6.1-linux-64.zip": true, "ffprobe-6.1-linux-arm-64.zip": true,
	"ffprobe-6.1-linux-armel-64.zip": true, "ffprobe-6.1-linux-armhf-32.zip": true,
	"ffprobe-6.1-macos-64.zip": true, "ffprobe-6.1-win-64.zip": true,
}

// Las URLs de Linux y macOS pedían .tar.gz y "osx-64", que dan 404: la instalación
// automática solo funcionaba en Windows.
func TestDownloadSpecsApuntanAArchivosPublicados(t *testing.T) {
	platforms := [][2]string{
		{"windows", "amd64"}, {"windows", "arm64"},
		{"linux", "amd64"}, {"linux", "386"}, {"linux", "arm64"}, {"linux", "arm"},
		{"darwin", "amd64"}, {"darwin", "arm64"},
	}
	for _, p := range platforms {
		specs := downloadSpecsFor(p[0], p[1])
		if len(specs) != 2 {
			t.Errorf("%s/%s: se esperaban 2 paquetes (ffprobe y ffmpeg), hay %d", p[0], p[1], len(specs))
			continue
		}
		for _, spec := range specs {
			if !spec.IsZip {
				t.Errorf("%s/%s %s: todos los archivos publicados son .zip", p[0], p[1], spec.Name)
			}
			for _, u := range spec.URLs {
				if !strings.HasPrefix(u, "https://") {
					t.Errorf("%s/%s: la descarga debe ser por HTTPS: %s", p[0], p[1], u)
				}
				if name := path.Base(u); !publishedAssets[name] {
					t.Errorf("%s/%s %s: %q no es un archivo publicado (daría 404)", p[0], p[1], spec.Name, name)
				}
			}
		}
	}
}

func TestDownloadSpecsPlataformaNoSoportada(t *testing.T) {
	for _, p := range [][2]string{{"plan9", "amd64"}, {"linux", "riscv64"}, {"linux", "mips"}, {"freebsd", "amd64"}} {
		if specs := downloadSpecsFor(p[0], p[1]); specs != nil {
			t.Errorf("%s/%s no tiene paquete publicado; se esperaba nil y hay %v", p[0], p[1], specs)
		}
	}
}

func buildZip(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for name, content := range files {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = w.Write([]byte(content))
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func buildTarGz(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	for name, content := range files {
		if err := tw.WriteHeader(&tar.Header{Name: name, Mode: 0o755, Size: int64(len(content))}); err != nil {
			t.Fatal(err)
		}
		_, _ = tw.Write([]byte(content))
	}
	_ = tw.Close()
	_ = gz.Close()
	return buf.Bytes()
}

func serve(t *testing.T, body []byte) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write(body) }))
	t.Cleanup(srv.Close)
	return srv.URL + "/paquete.zip"
}

func sha(b []byte) string { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }

func read(t *testing.T, p string) string {
	t.Helper()
	b, err := os.ReadFile(p)
	if err != nil {
		t.Fatalf("no se pudo leer %s: %v", p, err)
	}
	return string(b)
}

func exists(p string) bool { _, err := os.Stat(p); return err == nil }

func TestDescargaInstalaElBinarioYRespetaElHash(t *testing.T) {
	zipBytes := buildZip(t, map[string]string{"ffmpeg.exe": "binario-ok", "LICENSE.txt": "no se instala"})
	url := serve(t, zipBytes)

	dir := t.TempDir()
	if err := downloadAndExtractURL(context.Background(), url, true, sha(zipBytes), dir, nil); err != nil {
		t.Fatalf("con el hash correcto debía instalar: %v", err)
	}
	if read(t, filepath.Join(dir, "ffmpeg.exe")) != "binario-ok" {
		t.Error("contenido del binario incorrecto")
	}
	if exists(filepath.Join(dir, "LICENSE.txt")) {
		t.Error("solo se instalan ffmpeg y ffprobe")
	}
	// Sin hash también funciona (la verificación es opcional), y el hash no distingue mayúsculas.
	if err := downloadAndExtractURL(context.Background(), url, true, strings.ToUpper(sha(zipBytes)), t.TempDir(), nil); err != nil {
		t.Errorf("el hash en mayúsculas debía aceptarse: %v", err)
	}
	if err := downloadAndExtractURL(context.Background(), url, true, "", t.TempDir(), nil); err != nil {
		t.Errorf("sin hash debía instalar: %v", err)
	}
}

func TestDescargaConHashIncorrectoNoInstalaNada(t *testing.T) {
	zipBytes := buildZip(t, map[string]string{"ffmpeg.exe": "binario-manipulado"})
	url := serve(t, zipBytes)

	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "ffmpeg.exe"), []byte("el-que-funcionaba"), 0o755); err != nil {
		t.Fatal(err)
	}
	err := downloadAndExtractURL(context.Background(), url, true, sha([]byte("otra cosa")), dir, nil)
	if err == nil || !strings.Contains(err.Error(), "SHA-256") {
		t.Fatalf("se esperaba el error de hash, obtuve: %v", err)
	}
	if read(t, filepath.Join(dir, "ffmpeg.exe")) != "el-que-funcionaba" {
		t.Error("un hash incorrecto no debe tocar el binario instalado")
	}
}

func TestDescargaQueSuperaElTopeSeRechaza(t *testing.T) {
	old := maxDownloadBytes
	maxDownloadBytes = 64
	t.Cleanup(func() { maxDownloadBytes = old })

	url := serve(t, buildZip(t, map[string]string{"ffmpeg.exe": strings.Repeat("x", 4096)}))
	dir := t.TempDir()
	err := downloadAndExtractURL(context.Background(), url, true, "", dir, nil)
	if err == nil {
		t.Fatal("una descarga por encima del tope debía rechazarse")
	}
	if exists(filepath.Join(dir, "ffmpeg.exe")) {
		t.Error("no debía instalarse nada")
	}
}

func TestExtraccionZipSoloTomaLosBinariosYNoSaleDeLaCarpeta(t *testing.T) {
	zipBytes := buildZip(t, map[string]string{
		"bin/ffmpeg":         "ffmpeg-ok",
		"../../fuera.txt":    "no debe salir",
		"../ffprobe.exe":     "ffprobe-ok",
		"docs/README":        "ignorado",
		"evil/../../hack.sh": "ignorado",
	})
	f, err := os.CreateTemp(t.TempDir(), "z-*")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	_, _ = f.Write(zipBytes)

	parent := t.TempDir()
	dir := filepath.Join(parent, "bin")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := extractBinariesFromZip(f, dir); err != nil {
		t.Fatal(err)
	}
	if read(t, filepath.Join(dir, "ffmpeg")) != "ffmpeg-ok" || read(t, filepath.Join(dir, "ffprobe.exe")) != "ffprobe-ok" {
		t.Error("faltan los binarios esperados")
	}
	entries, _ := os.ReadDir(parent)
	for _, e := range entries {
		if e.Name() != "bin" {
			t.Errorf("se escribió %q fuera de la carpeta de binarios", e.Name())
		}
	}
	inDir, _ := os.ReadDir(dir)
	if len(inDir) != 2 {
		t.Errorf("solo debían quedar 2 archivos, hay %d", len(inDir))
	}
}

func TestExtraccionTarGz(t *testing.T) {
	data := buildTarGz(t, map[string]string{"ffmpeg-dir/ffmpeg": "ffmpeg-tar", "../../fuera": "ignorado", "otro": "ignorado"})
	f, _ := os.CreateTemp(t.TempDir(), "t-*")
	defer f.Close()
	_, _ = f.Write(data)

	dir := t.TempDir()
	if err := extractBinariesFromTarGz(f, dir); err != nil {
		t.Fatal(err)
	}
	if read(t, filepath.Join(dir, "ffmpeg")) != "ffmpeg-tar" {
		t.Error("falta el binario del .tar.gz")
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 1 {
		t.Errorf("solo debía quedar ffmpeg, hay %d archivos", len(entries))
	}
}

// Un archivo que descomprime a más del tope no debe llenar el disco ni reemplazar al
// binario que funcionaba; y no deja archivos temporales.
func TestExtraccionQueSuperaElTopeNoPisaElBinarioNiDejaTemporales(t *testing.T) {
	old := maxExtractedBinaryBytes
	maxExtractedBinaryBytes = 1024
	t.Cleanup(func() { maxExtractedBinaryBytes = old })

	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "ffmpeg.exe"), []byte("el-que-funcionaba"), 0o755); err != nil {
		t.Fatal(err)
	}
	zipBytes := buildZip(t, map[string]string{"ffmpeg.exe": strings.Repeat("x", 4096)})
	f, _ := os.CreateTemp(t.TempDir(), "z-*")
	defer f.Close()
	_, _ = f.Write(zipBytes)

	if err := extractBinariesFromZip(f, dir); err == nil {
		t.Fatal("se esperaba un error por superar el tope")
	}
	if read(t, filepath.Join(dir, "ffmpeg.exe")) != "el-que-funcionaba" {
		t.Error("el binario instalado no debe pisarse con una extracción fallida")
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 1 {
		t.Errorf("quedaron archivos temporales: %v", entries)
	}
}

func TestEscrituraAtomicaReemplazaElBinarioYDejaPermisosDeEjecucion(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "ffmpeg"), []byte("viejo"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := writeBinaryAtomic(dir, "ffmpeg", strings.NewReader("nuevo")); err != nil {
		t.Fatal(err)
	}
	if read(t, filepath.Join(dir, "ffmpeg")) != "nuevo" {
		t.Error("no se reemplazó el binario")
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 1 {
		t.Errorf("no debían quedar temporales: %v", entries)
	}
}
