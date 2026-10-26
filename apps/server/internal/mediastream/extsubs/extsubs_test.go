package extsubs

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMatchVideo(t *testing.T) {
	names := []string{
		"Show - 01.mkv",
		"Show - 01.srt",
		"Show - 01.es.srt",
		"Show - 01.spa.forced.ass",
		"Show - 01.es-419.srt",
		"Show - 01.English.vtt",
		"Show - 01 - Español.srt",
		"Show - 010.srt",
		"Show - 02.es.srt",
		"Show - 01 - Extras.srt",
		"Show - 01.nfo",
		"show - 01.EN.SRT",
		"Show - 01.Latino.ssa",
		"Show - 01.txt.srt",
	}
	got := MatchVideo("Show - 01.mkv", names)

	byName := map[string]Candidate{}
	for _, c := range got {
		byName[c.Name] = c
	}
	for _, n := range []string{"Show - 010.srt", "Show - 02.es.srt", "Show - 01 - Extras.srt", "Show - 01.nfo", "Show - 01.mkv"} {
		require.NotContains(t, byName, n, n)
	}

	require.Equal(t, "", byName["Show - 01.srt"].Lang)
	require.Equal(t, "Subtítulos externos", byName["Show - 01.srt"].Title)
	require.Equal(t, "spa", byName["Show - 01.es.srt"].Lang)
	require.Equal(t, "Español", byName["Show - 01.es.srt"].Title)
	require.Equal(t, "spa", byName["Show - 01.spa.forced.ass"].Lang)
	require.True(t, byName["Show - 01.spa.forced.ass"].Forced)
	require.Equal(t, "Español (Latino)", byName["Show - 01.es-419.srt"].Title)
	require.Equal(t, "eng", byName["Show - 01.English.vtt"].Lang)
	require.Equal(t, "spa", byName["Show - 01 - Español.srt"].Lang)
	require.Equal(t, "eng", byName["show - 01.EN.SRT"].Lang)
	require.Equal(t, "srt", byName["show - 01.EN.SRT"].Ext)
	require.Equal(t, "Español (Latino)", byName["Show - 01.Latino.ssa"].Title)
	// Etiqueta libre en modo permisivo (punto): se conserva como título.
	require.Equal(t, "txt", byName["Show - 01.txt.srt"].Title)
}

func TestMatchVideoSortedAndStable(t *testing.T) {
	a := MatchVideo("a.mkv", []string{"a.fr.srt", "a.en.srt", "a.es.srt"})
	require.Len(t, a, 3)
	require.Equal(t, "a.en.srt", a[0].Name)
	require.Equal(t, "a.es.srt", a[1].Name)
	require.Equal(t, "a.fr.srt", a[2].Name)
}

func TestParseLanguageToken(t *testing.T) {
	for tok, want := range map[string]string{
		"es": "spa", "spa": "spa", "ES": "spa", "es-MX": "spa", "es_la": "spa", "Español": "spa", "castellano": "spa",
		"en": "eng", "eng": "eng", "ja": "jpn", "pt-BR": "por", "fr": "fra",
	} {
		got, _, ok := ParseLanguageToken(tok)
		require.True(t, ok, tok)
		require.Equal(t, want, got, tok)
	}
	for _, tok := range []string{"", "forced", "01", "xyzzy"} {
		_, _, ok := ParseLanguageToken(tok)
		require.False(t, ok, tok)
	}
}

func TestHearingImpairedFlagIsNotHindi(t *testing.T) {
	got := MatchVideo("a.mkv", []string{"a.es.hi.srt"})
	require.Len(t, got, 1)
	require.Equal(t, "spa", got[0].Lang)
}

func TestNormalizeToUTF8(t *testing.T) {
	require.Equal(t, "ñandú", string(NormalizeToUTF8([]byte("\xEF\xBB\xBFñandú"))))
	require.Equal(t, "ñandú", string(NormalizeToUTF8([]byte("ñandú"))))
	// Windows-1252: ñ = 0xF1, ú = 0xFA
	require.Equal(t, "ñandú", string(NormalizeToUTF8([]byte{0xF1, 'a', 'n', 'd', 0xFA})))
	// UTF-16 LE con BOM
	require.Equal(t, "hi", string(NormalizeToUTF8([]byte{0xFF, 0xFE, 'h', 0, 'i', 0})))
}

func srcOf(name string, data string, reads *int) Source {
	cs := MatchVideo("v.mkv", []string{name})
	return Source{
		Candidate: cs[0],
		Key:       "k1",
		Read: func() ([]byte, error) {
			*reads++
			return []byte(data), nil
		},
	}
}

func TestSyncCachesAndReuses(t *testing.T) {
	cache := t.TempDir()
	reads := 0
	srcs := []Source{srcOf("v.en.srt", "1\n00:00:01,000 --> 00:00:02,000\nhi\n", &reads), srcOf("v.es.ass", "[Script Info]\n", &reads)}

	subs, err := Sync(cache, "gdrive://id/v.mkv", srcs)
	require.NoError(t, err)
	require.Len(t, subs, 2)
	require.Equal(t, uint32(IndexBase), subs[0].Index)
	require.Equal(t, "subrip", subs[0].Codec)
	require.Equal(t, "eng", *subs[0].Language)
	require.Equal(t, "ass", subs[1].Codec)
	require.Equal(t, 2, reads)
	require.NotEmpty(t, FindFile(cache, "gdrive://id/v.mkv", IndexBase))
	require.NotEmpty(t, FindFile(cache, "gdrive://id/v.mkv", IndexBase+1))
	require.Empty(t, FindFile(cache, "gdrive://id/v.mkv", IndexBase+2))
	require.Empty(t, FindFile(cache, "gdrive://other/v.mkv", IndexBase))

	// Segundo pedido con la misma versión: no vuelve a leer.
	_, err = Sync(cache, "gdrive://id/v.mkv", srcs)
	require.NoError(t, err)
	require.Equal(t, 2, reads)

	// Desaparece el primero: el segundo pasa al índice base y el sobrante se borra.
	subs, err = Sync(cache, "gdrive://id/v.mkv", srcs[1:])
	require.NoError(t, err)
	require.Len(t, subs, 1)
	require.Equal(t, uint32(IndexBase), subs[0].Index)
	require.Equal(t, 3, reads) // cambió de índice: se reescribe
	require.Empty(t, FindFile(cache, "gdrive://id/v.mkv", IndexBase+1))

	// Sin fuentes: se limpia todo.
	subs, err = Sync(cache, "gdrive://id/v.mkv", nil)
	require.NoError(t, err)
	require.Empty(t, subs)
	require.Empty(t, FindFile(cache, "gdrive://id/v.mkv", IndexBase))
}

func TestSyncSkipsBadFiles(t *testing.T) {
	cache := t.TempDir()
	cs := MatchVideo("v.mkv", []string{"v.es.srt", "v.en.srt", "v.fr.srt"})
	srcs := []Source{
		{Candidate: cs[0], Read: func() ([]byte, error) { return nil, os.ErrNotExist }},
		{Candidate: cs[1], Read: func() ([]byte, error) { return []byte("   \n"), nil }},
		{Candidate: cs[2], Read: func() ([]byte, error) { return make([]byte, MaxFileSize+1), nil }},
	}
	subs, err := Sync(cache, "p", srcs)
	require.NoError(t, err)
	require.Empty(t, subs)
}

func TestLocalSources(t *testing.T) {
	dir := t.TempDir()
	video := filepath.Join(dir, "Ep 01.mkv")
	write := func(p, c string) {
		require.NoError(t, os.MkdirAll(filepath.Dir(p), 0o755))
		require.NoError(t, os.WriteFile(p, []byte(c), 0o644))
	}
	write(video, "x")
	write(filepath.Join(dir, "Ep 01.es.srt"), "a")
	write(filepath.Join(dir, "Ep 02.es.srt"), "otro episodio")
	write(filepath.Join(dir, "Subs", "Ep 01.en.ass"), "b")
	write(filepath.Join(dir, "Subs", "Ep 01", "Ep 01.pt-BR.srt"), "c")

	got := LocalSources(video)
	var names []string
	for _, s := range got {
		names = append(names, s.Name)
	}
	require.ElementsMatch(t, []string{"Ep 01.es.srt", "Ep 01.en.ass", "Ep 01.pt-BR.srt"}, names)

	subs, err := Sync(t.TempDir(), video, got)
	require.NoError(t, err)
	require.Len(t, subs, 3)
}
