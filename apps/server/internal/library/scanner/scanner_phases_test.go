package scanner

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"kamehouse/internal/database/models/dto"

	"github.com/rs/zerolog"
)

func newPhaseScanner() *Scanner {
	l := zerolog.Nop()
	return &Scanner{Logger: &l}
}

func writeFile(t *testing.T, path, content string) os.FileInfo {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	return info
}

func TestCollectSkippedLocalFiles(t *testing.T) {
	dir := t.TempDir()
	unchangedInfo := writeFile(t, filepath.Join(dir, "lib", "unchanged.mkv"), "a")
	writeFile(t, filepath.Join(dir, "lib", "changed.mkv"), "bb")
	writeFile(t, filepath.Join(dir, "lib", "locked.mkv"), "c")

	unchanged := &dto.LocalFile{Path: filepath.Join(dir, "lib", "unchanged.mkv"), FileSize: unchangedInfo.Size(), FileModTime: unchangedInfo.ModTime().Unix()}
	changed := &dto.LocalFile{Path: filepath.Join(dir, "lib", "changed.mkv"), FileSize: 999, FileModTime: time.Now().Unix()}
	locked := &dto.LocalFile{Path: filepath.Join(dir, "lib", "locked.mkv"), Locked: true}
	drive := &dto.LocalFile{Path: "gdrive://abc/ep1.mkv"}
	// Biblioteca desconectada: el archivo no existe y su carpeta raíz tampoco.
	offline := &dto.LocalFile{Path: filepath.Join(dir, "offline-lib", "ep.mkv")}

	scn := newPhaseScanner()
	scn.ExistingLocalFiles = []*dto.LocalFile{unchanged, changed, locked, drive, offline, nil}
	scn.SkipLockedFiles = true
	scn.WithShelving = true

	skipped := scn.collectSkippedLocalFiles([]string{filepath.Join(dir, "offline-lib"), filepath.Join(dir, "lib")})

	for _, lf := range []*dto.LocalFile{unchanged, locked, drive, offline} {
		if _, ok := skipped[lf.GetNormalizedPath()]; !ok {
			t.Errorf("expected %s to be skipped", lf.Path)
		}
	}
	if _, ok := skipped[changed.GetNormalizedPath()]; ok {
		t.Error("a file whose size/mtime changed must be rescanned")
	}
	if len(scn.shelvedLocalFiles) != 1 || scn.shelvedLocalFiles[0] != offline {
		t.Errorf("file of an offline library must be shelved, got %v", scn.shelvedLocalFiles)
	}

	// Escaneo profundo: los archivos sin cambios también se re-escanean.
	deep := newPhaseScanner()
	deep.ExistingLocalFiles = []*dto.LocalFile{unchanged}
	deep.ScanMode = "deep"
	if len(deep.collectSkippedLocalFiles(nil)) != 0 {
		t.Error("deep scan must not skip unchanged files")
	}
}

func TestMergeSkippedFiles(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "present.mkv"), "x")
	present := &dto.LocalFile{Path: filepath.Join(dir, "present.mkv")}
	goneLocked := &dto.LocalFile{Path: filepath.Join(dir, "gone.mkv"), Locked: true}
	goneUnlocked := &dto.LocalFile{Path: filepath.Join(dir, "gone2.mkv")}

	scn := newPhaseScanner()
	scn.WithShelving = true
	out := scn.mergeSkippedFiles(nil, map[string]*dto.LocalFile{"a": present, "b": goneLocked, "c": goneUnlocked})

	if len(out) != 1 || out[0] != present {
		t.Errorf("only files that still exist are merged, got %v", out)
	}
	if len(scn.shelvedLocalFiles) != 1 || scn.shelvedLocalFiles[0] != goneLocked {
		t.Errorf("missing locked files are shelved, got %v", scn.shelvedLocalFiles)
	}
}

func TestParseNfoEntries(t *testing.T) {
	dir := t.TempDir()
	show := filepath.Join(dir, "Show")
	writeFile(t, filepath.Join(show, "tvshow.nfo"), `<tvshow><title>Serie</title><uniqueid type="tmdb">12971</uniqueid></tvshow>`)
	writeFile(t, filepath.Join(show, "ep1.mkv"), "x")
	writeFile(t, filepath.Join(show, "ep2.mkv"), "x")
	movieDir := filepath.Join(dir, "Movie")
	writeFile(t, filepath.Join(movieDir, "film.mkv"), "x")
	writeFile(t, filepath.Join(movieDir, "film.nfo"), `<movie><title>Film</title></movie>`)

	files := []*dto.LocalFile{
		{Path: filepath.Join(show, "ep1.mkv")},
		{Path: filepath.Join(show, "ep2.mkv")},
		{Path: filepath.Join(movieDir, "film.mkv")},
		{Path: filepath.Join(dir, "already.mkv"), MediaID: 5}, // ya matcheado: se ignora
	}

	entries := newPhaseScanner().parseNfoEntries(context.Background(), files)

	var folder, perFile int
	for _, e := range entries {
		if e.isPerFile {
			perFile++
			if e.media.Format != "MOVIE" || e.tmdbID != 0 {
				t.Errorf("per-file movie NFO parsed wrong: %+v %+v", e, e.media)
			}
		} else {
			folder++
			if e.tmdbID != 12971 || e.media.Format != "TV" {
				t.Errorf("folder NFO parsed wrong: tmdb=%d format=%s", e.tmdbID, e.media.Format)
			}
		}
	}
	// El tvshow.nfo lo reclama un solo worker aunque haya dos episodios.
	if folder != 1 || perFile != 1 {
		t.Errorf("expected 1 folder + 1 per-file entry, got %d + %d", folder, perFile)
	}
}

func TestCollectMatchedMedia(t *testing.T) {
	files := []*dto.LocalFile{
		{Path: "/lib/Series/Show/ep1.mkv", MediaID: 10},
		{Path: "/lib/Series/Show/ep2.mkv", MediaID: 10},
		{Path: "/lib/Movies/Film/film.mkv", MediaID: 1_000_020},
		{Path: "/lib/unmatched.mkv"},
	}
	all, movies := collectMatchedMedia(files, []int{77}, []string{"/lib"})

	for _, id := range []int{10, 1_000_020, 77} {
		if _, ok := all[id]; !ok {
			t.Errorf("expected media %d in matched set", id)
		}
	}
	if len(all) != 3 {
		t.Errorf("unexpected matched set %v", all)
	}
	if !movies[1_000_020] {
		t.Error("IDs >= 1,000,000 are movies")
	}
	if movies[10] {
		t.Error("a series must not be marked as movie")
	}
}
