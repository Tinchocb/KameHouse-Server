package skipdetect

import (
	"os"
	"path/filepath"
	"testing"

	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/util"
)

// Un episodio de Drive que la reproducción ya extrajo tiene que encontrar su .ass usando la
// misma clave de caché (MD5 de la ruta gdrive://), sin tocar Drive.
func TestLocateASSFindsDriveSubsExtractedByPlayback(t *testing.T) {
	cacheDir := t.TempDir()
	const drivePath = "gdrive://FILE123/Serie/ep01.mkv"

	dir := videofile.GetFileSubsCacheDir(cacheDir, util.CreateMD5(drivePath))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(dir, "1.jpn.ass")
	if err := os.WriteFile(want, []byte("[Script Info]\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	d := &Detector{cacheDir: cacheDir}
	if got := d.locateASS(drivePath); got != want {
		t.Fatalf("locateASS(drive) = %q, want %q", got, want)
	}
}

// En Drive no se extrae on-demand: ffmpeg tendría que leer el archivo entero. Sin tocar nada,
// debe responder que no.
func TestExtractSubsOnDemandSkipsDrive(t *testing.T) {
	d := &Detector{}
	if d.extractSubsOnDemand(t.Context(), "gdrive://FILE123/Serie/ep01.mkv") {
		t.Fatal("la extracción on-demand no debe correr sobre Drive")
	}
}
