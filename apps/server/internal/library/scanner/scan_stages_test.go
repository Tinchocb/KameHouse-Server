package scanner

import (
	"context"
	"path/filepath"
	"testing"

	"kamehouse/internal/database/models/dto"
)

// Scan de punta a punta en los caminos que no necesitan proveedores de
// metadata (red): terminan en finishEmptyScan.

func TestScan_MetadataModeWithoutFiles(t *testing.T) {
	scn := newPhaseScanner()
	scn.ScanMode = "metadata"
	scn.DirPath = t.TempDir()

	lfs, err := scn.Scan(context.Background())
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if len(lfs) != 0 {
		t.Fatalf("expected no local files, got %d", len(lfs))
	}
}

func TestScan_LibraryWithoutVideos(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "Serie", "info.nfo"), "<tvshow/>")
	writeFile(t, filepath.Join(dir, "Serie", "poster.jpg"), "jpg")

	scn := newPhaseScanner()
	scn.DirPath = dir

	lfs, err := scn.Scan(context.Background())
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if len(lfs) != 0 {
		t.Fatalf("non-video files must not become local files, got %d", len(lfs))
	}
}

// Un archivo ya conocido y sin cambios (mismo tamaño y fecha) se omite en el
// escaneo rápido, pero debe volver en el resultado con sus datos intactos.
func TestScan_UnchangedKnownFileIsKeptWithoutRescan(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "Dragon Ball", "Dragon Ball - 01.mkv")
	info := writeFile(t, path, "video")

	known := dto.NewLocalFileS(path, []string{dir})
	known.FileSize = info.Size()
	known.FileModTime = info.ModTime().Unix()
	known.MediaID = 12609 // dato de un escaneo anterior que no debe perderse

	scn := newPhaseScanner()
	scn.DirPath = dir
	scn.ExistingLocalFiles = []*dto.LocalFile{known}

	lfs, err := scn.Scan(context.Background())
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if len(lfs) != 1 {
		t.Fatalf("expected the known file back, got %d files", len(lfs))
	}
	if lfs[0].MediaID != 12609 {
		t.Errorf("known file lost its match: MediaID = %d", lfs[0].MediaID)
	}
}
