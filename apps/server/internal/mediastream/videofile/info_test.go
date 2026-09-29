package videofile

import (
	"context"
	"kamehouse/internal/util"
	"os"
	"path/filepath"
	"testing"
)

// testVideoPath devuelve el video de prueba de KAMEHOUSE_TEST_VIDEO (un .mkv
// con adjuntos, p. ej. fuentes) o saltea el test: no hay video en el repo y
// hace falta ffprobe en el PATH.
func testVideoPath(t *testing.T) string {
	t.Helper()
	p := os.Getenv("KAMEHOUSE_TEST_VIDEO")
	if p == "" {
		t.Skip("KAMEHOUSE_TEST_VIDEO no definido: test de integración con ffprobe")
	}
	if _, err := os.Stat(p); err != nil {
		t.Skipf("KAMEHOUSE_TEST_VIDEO=%q no accesible: %v", p, err)
	}
	return p
}

func TestFfprobeGetInfo_1(t *testing.T) {
	testFilePath := testVideoPath(t)

	mi, err := FfprobeGetInfo("", testFilePath, "1")
	if err != nil {
		t.Fatalf("Error getting media info: %v", err)
	}

	util.Spew(mi)
}

func TestExtractAttachment(t *testing.T) {
	testFilePath := testVideoPath(t)

	testDir := t.TempDir()

	mi, err := FfprobeGetInfo("", testFilePath, "1")
	if err != nil {
		t.Fatalf("Error getting media info: %v", err)
	}

	util.Spew(mi)

	err = ExtractAttachment(context.Background(), "", testFilePath, "1", mi, testDir, util.NewLogger())
	if err != nil {
		t.Fatalf("Error extracting attachment: %v", err)
	}

	entries, err := os.ReadDir(filepath.Join(testDir, "videofiles", "1", "att"))
	if err != nil {
		t.Fatalf("Error reading directory: %v", err)
	}

	for _, entry := range entries {
		info, _ := entry.Info()
		t.Logf("Entry: %s, Size: %d\n", entry.Name(), info.Size())
	}
}
