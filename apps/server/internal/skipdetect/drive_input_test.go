package skipdetect

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"path/filepath"
	"testing"
)

// Un episodio de Drive no existe en disco: su clave de caché sale de la ruta gdrive://, y lo
// que ffmpeg abre es la entrada resuelta (la URL interna), nunca la ruta virtual.
func TestFingerprintRangeCachedKeysDriveByPathAndReadsInput(t *testing.T) {
	cacheDir := t.TempDir()
	const drivePath = "gdrive://FILE123/Serie/ep01.mkv"

	key, err := ComputeFingerprintCacheKey(drivePath, 0, 90, 0)
	if err != nil {
		t.Fatalf("la clave de un archivo de Drive no debe fallar: %v", err)
	}
	if err := PutCachedFingerprint(cacheDir, key, &CachedFingerprint{Duration: 90, Fingerprint: []int{1, 2, 3}}); err != nil {
		t.Fatal(err)
	}

	// Entrada inexistente: un acierto de caché no ejecuta fpcalc ni ffmpeg.
	fp, dur, err := FingerprintRangeCached(context.Background(), cacheDir, "no-fpcalc", "no-ffmpeg", drivePath, "http://127.0.0.1:1/x", 0, 90, 0)
	if err != nil {
		t.Fatalf("debía salir de la caché por la ruta de Drive: %v", err)
	}
	if dur != 90 || len(fp) != 3 {
		t.Fatalf("caché de Drive: dur=%v fp=%v", dur, fp)
	}
}

func TestDetectorInputResolverFallsBackToPath(t *testing.T) {
	d := &Detector{}
	if got := d.ffmpegInput("/local/ep.mkv"); got != "/local/ep.mkv" {
		t.Fatalf("sin resolver debe devolver la ruta: %q", got)
	}

	d.SetInputResolver(func(p string) string {
		if p == "gdrive://x" {
			return "http://loop/x"
		}
		return ""
	})
	if got := d.ffmpegInput("gdrive://x"); got != "http://loop/x" {
		t.Fatalf("el resolver debe mapear gdrive: %q", got)
	}
	if got := d.ffmpegInput("/local/ep.mkv"); got != "/local/ep.mkv" {
		t.Fatalf("un resolver vacío debe caer a la ruta: %q", got)
	}

	ep := episodeFile{Path: "gdrive://x"}
	if got := ep.inputPath(); got != "gdrive://x" {
		t.Fatalf("episodio sin Input debe usar Path: %q", got)
	}
	ep.Input = "http://loop/x"
	if got := ep.inputPath(); got != "http://loop/x" {
		t.Fatalf("episodio con Input debe usarlo: %q", got)
	}
}

// ffmpeg tiene que poder huellar leyendo la entrada por HTTP con rangos (así es como se
// lee Drive por el loopback) y dar el mismo fingerprint que leyendo el archivo local.
func TestFingerprintRangeOverHTTPMatchesLocalFile(t *testing.T) {
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg no está en el PATH")
	}
	fpcalc := testFpcalc(t)
	ctx := context.Background()

	src := filepath.Join(t.TempDir(), "noise.wav")
	gen := exec.CommandContext(ctx, ffmpeg, "-v", "error",
		"-f", "lavfi", "-i", "anoisesrc=d=60:c=pink:r=44100", "-ac", "1", src)
	if out, err := gen.CombinedOutput(); err != nil {
		t.Fatalf("no se pudo generar el audio de prueba: %v (%s)", err, out)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, src)
	}))
	defer srv.Close()

	local, _, err := FingerprintRange(ctx, fpcalc, ffmpeg, src, 0, 30, -1)
	if err != nil {
		t.Fatalf("FingerprintRange local: %v", err)
	}
	remote, _, err := FingerprintRange(ctx, fpcalc, ffmpeg, srv.URL+"/noise.wav", 0, 30, -1)
	if err != nil {
		t.Fatalf("FingerprintRange por HTTP: %v", err)
	}
	if len(local) == 0 || len(local) != len(remote) {
		t.Fatalf("fingerprints distintos en tamaño: local=%d http=%d", len(local), len(remote))
	}
	for i := range local {
		if local[i] != remote[i] {
			t.Fatalf("fingerprint difiere en %d: local=%d http=%d", i, local[i], remote[i])
		}
	}
}
