package scanner

import (
	"context"
	"path/filepath"
	"testing"

	"kamehouse/internal/database/models/dto"
)

func TestIndexFilesByEpisode(t *testing.T) {
	mk := func(media, season, ep int) *dto.LocalFile {
		lf := &dto.LocalFile{MediaID: media, Metadata: &dto.LocalFileMetadata{Episode: ep}}
		if season != 1 {
			lf.ParsedData = &dto.LocalFileParsedData{Season: string(rune('0' + season))}
		}
		return lf
	}
	a := mk(10, 1, 1)
	b := mk(10, 2, 1)
	c := mk(10, 1, 1) // duplicado del mismo episodio (otro idioma/release)
	other := mk(99, 1, 1)
	noMeta := &dto.LocalFile{MediaID: 10}

	idx := indexFilesByEpisode([]*dto.LocalFile{a, b, c, other, noMeta, nil}, 10)

	if got := idx[episodeKey{1, 1}]; len(got) != 2 || got[0] != a || got[1] != c {
		t.Fatalf("S1E1 = %v, want [a c]", got)
	}
	if got := idx[episodeKey{2, 1}]; len(got) != 1 || got[0] != b {
		t.Fatalf("S2E1 = %v, want [b]", got)
	}
	if len(idx) != 2 {
		t.Fatalf("index has %d keys, want 2 (otra media y sin metadata fuera)", len(idx))
	}
}

func TestParseNfoEntries_FolderNfoClaimedOnce(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "Show", "tvshow.nfo"),
		`<tvshow><title>Show</title><tmdbid>1234</tmdbid></tvshow>`)
	var lfs []*dto.LocalFile
	for _, n := range []string{"e1.mkv", "e2.mkv", "e3.mkv"} {
		p := filepath.Join(dir, "Show", n)
		writeFile(t, p, "x")
		lfs = append(lfs, &dto.LocalFile{Path: p})
	}

	entries := newPhaseScanner().parseNfoEntries(context.Background(), lfs)
	if len(entries) != 1 {
		t.Fatalf("entries = %d, want 1 (el NFO de carpeta se reclama una sola vez)", len(entries))
	}
	if entries[0].tmdbID != 1234 || entries[0].isPerFile {
		t.Fatalf("entry inesperada: %+v", entries[0])
	}
}
