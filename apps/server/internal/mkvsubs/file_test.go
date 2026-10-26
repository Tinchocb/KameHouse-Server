package mkvsubs

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"kamehouse/internal/mkvsubs/mkvtest"

	"github.com/stretchr/testify/require"
)

func TestOpenTestMKV(t *testing.T) {
	tm := mkvtest.Get(t, 90)
	t.Logf("MKV de prueba: %.1f MB", float64(len(tm.Bytes))/1e6)
	f, err := Open(context.Background(), BytesSource(tm.Bytes), Options{})
	require.NoError(t, err)

	subs := f.SubtitleTracks()
	require.Len(t, subs, 2)
	require.Equal(t, "S_TEXT/ASS", subs[0].CodecID)
	require.Equal(t, FormatASS, subs[0].Format())
	require.Equal(t, "S_TEXT/UTF8", subs[1].CodecID)
	require.Equal(t, FormatSRT, subs[1].Format())
	require.Equal(t, "spa", subs[0].Language)
	require.True(t, f.HasCues())
	require.InDelta(t, tm.Secs*1000, f.DurationMs(), 500)

	atts := f.Attachments()
	require.Len(t, atts, 1)
	require.Equal(t, mkvtest.FontName, atts[0].Name)
	data, err := f.ReadAttachment(context.Background(), atts[0])
	require.NoError(t, err)
	require.Equal(t, mkvtest.FontData, string(data))
}

func TestOpenRejectsNonMatroska(t *testing.T) {
	_, err := Open(context.Background(), BytesSource([]byte("esto no es un mkv, ni cerca")), Options{})
	require.ErrorIs(t, err, ErrNotMatroska)
}

// walkAll recorre todos los clusters y junta los eventos por pista.
func walkAll(t testing.TB, f *File) map[uint64][]Event {
	t.Helper()
	wanted := map[uint64]bool{}
	tracks := map[uint64]*Track{}
	for _, tr := range f.SubtitleTracks() {
		wanted[tr.Number] = true
		tracks[tr.Number] = tr
	}
	out := map[uint64][]Event{}
	for off := f.FirstCluster(); off >= 0; {
		cl, err := f.ReadCluster(context.Background(), off, wanted)
		require.NoError(t, err)
		for _, b := range cl.Blocks {
			ev, err := tracks[b.Track].NewEvent(b)
			require.NoError(t, err)
			out[b.Track] = append(out[b.Track], ev)
		}
		off = cl.Next
	}
	return out
}

func TestReadAllClustersFindsEveryEvent(t *testing.T) {
	tm := mkvtest.Get(t, 90)
	f, err := Open(context.Background(), BytesSource(tm.Bytes), Options{})
	require.NoError(t, err)
	evs := walkAll(t, f)
	subs := f.SubtitleTracks()

	require.Len(t, evs[subs[0].Number], len(tm.ASSEvs))
	require.Len(t, evs[subs[1].Number], len(tm.SRTEvs))
	for i, want := range tm.ASSEvs {
		got := evs[subs[0].Number][i]
		// ffmpeg redondea a centisegundos en ASS.
		require.InDelta(t, want.StartMs, got.StartMs, 10, "inicio del evento ASS %d", i)
		require.InDelta(t, want.EndMs, got.EndMs, 10, "fin del evento ASS %d", i)
		require.Contains(t, string(got.Data), want.Text)
	}
	for i, want := range tm.SRTEvs {
		got := evs[subs[1].Number][i]
		require.Equal(t, want.StartMs, got.StartMs, "inicio del evento SRT %d", i)
		require.Equal(t, want.EndMs, got.EndMs, "fin del evento SRT %d", i)
		require.Equal(t, want.Text, strings.TrimSpace(string(got.Data)))
	}
}

var dialogueRe = regexp.MustCompile(`(?m)^Dialogue: ([^,]*),([^,]*),([^,]*),(.*?)\r?$`)

// El ASS que arma este paquete debe decir lo mismo que el que extrae ffmpeg.
func TestRenderMatchesFFmpegExtraction(t *testing.T) {
	tm := mkvtest.Get(t, 90)
	ffmpeg, err := exec.LookPath("ffmpeg")
	require.NoError(t, err)
	f, err := Open(context.Background(), BytesSource(tm.Bytes), Options{})
	require.NoError(t, err)
	evs := walkAll(t, f)
	subs := f.SubtitleTracks()

	dir := t.TempDir()
	refASS := filepath.Join(dir, "ref.ass")
	refSRT := filepath.Join(dir, "ref.srt")
	out, err := exec.Command(ffmpeg, "-y", "-v", "error", "-i", tm.Path,
		"-map", "0:s:0", "-c:s", "copy", refASS, "-map", "0:s:1", "-c:s", "copy", refSRT).CombinedOutput()
	require.NoError(t, err, string(out))

	// ASS: mismas líneas de diálogo, en el mismo orden.
	mine := string(Render(subs[0], evs[subs[0].Number]))
	ref, err := os.ReadFile(refASS)
	require.NoError(t, err)
	mineD := dialogueRe.FindAllStringSubmatch(mine, -1)
	refD := dialogueRe.FindAllStringSubmatch(string(ref), -1)
	require.NotEmpty(t, refD)
	require.Len(t, mineD, len(refD))
	for i := range refD {
		require.Equal(t, refD[i][1:], mineD[i][1:], "línea %d", i)
	}
	require.Contains(t, mine, "[Script Info]")
	require.Contains(t, mine, "Style: Default,Arial")
	require.Contains(t, mine, "[Events]")

	// SRT: mismos textos y tiempos.
	mineSRT := string(Render(subs[1], evs[subs[1].Number]))
	refSRTb, err := os.ReadFile(refSRT)
	require.NoError(t, err)
	norm := func(s string) string { return strings.Join(strings.Fields(strings.ReplaceAll(s, "\r", "")), " ") }
	require.Equal(t, norm(string(refSRTb)), norm(mineSRT))
}

func TestClusterBeforeUsesCues(t *testing.T) {
	tm := mkvtest.Get(t, 90)
	f, err := Open(context.Background(), BytesSource(tm.Bytes), Options{})
	require.NoError(t, err)
	require.Equal(t, f.FirstCluster(), f.ClusterBefore(0))

	// Un cluster elegido por Cues para el segundo 60 empieza a los 60 s o antes.
	off := f.ClusterBefore(60_000)
	require.Greater(t, off, f.FirstCluster())
	cl, err := f.ReadCluster(context.Background(), off, nil)
	require.NoError(t, err)
	require.LessOrEqual(t, cl.StartMs, int64(60_000))
	require.Greater(t, cl.StartMs, int64(40_000))
}
