package mkvsubs

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"kamehouse/internal/mkvsubs/mkvtest"

	"github.com/stretchr/testify/require"
)

// Los archivos sintéticos imitan la estructura de los MKV reales (mkvmerge, ffmpeg,
// directos): el parser tiene que sacar de todos exactamente los eventos que se metieron.

func synthEvents(secs int) []mkvtest.Event {
	var evs []mkvtest.Event
	for i := 0; ; i++ {
		start := int64(i)*1700 + 300
		if start >= int64(secs-2)*1000 {
			break
		}
		evs = append(evs, mkvtest.Event{StartMs: start, EndMs: start + 1400, Text: fmt.Sprintf("Linea %d, con coma", i)})
	}
	return evs
}

func openSynth(t testing.TB, s *mkvtest.Synth) *File {
	t.Helper()
	f, err := Open(context.Background(), BytesSource(s.Bytes), Options{ChunkSize: 64 << 10})
	require.NoError(t, err)
	return f
}

func eventText(t *Track, e Event) string {
	d := string(e.Data)
	if t.Format() == FormatASS {
		parts := strings.SplitN(strings.TrimRight(d, "\r\n"), ",", 9)
		if len(parts) == 9 {
			return parts[8]
		}
	}
	return strings.TrimSpace(d)
}

// requireAllEvents recorre todos los clusters y compara con lo que se escribió.
func requireAllEvents(t *testing.T, s *mkvtest.Synth, f *File) {
	t.Helper()
	got := walkAll(t, f)
	for _, tr := range s.Tracks {
		if tr.Kind != mkvtest.KindASS && tr.Kind != mkvtest.KindSRT {
			continue
		}
		var want []mkvtest.Event
		want = append(want, tr.Events...)
		evs := got[tr.Number]
		require.Len(t, evs, len(want), "pista %d (%s)", tr.Number, tr.Kind)
		var track *Track
		for _, st := range f.SubtitleTracks() {
			if st.Number == tr.Number {
				track = st
			}
		}
		require.NotNil(t, track)
		for i, w := range want {
			require.Equal(t, w.StartMs, evs[i].StartMs, "inicio del evento %d de la pista %d", i, tr.Number)
			if !tr.NoDuration {
				require.Equal(t, w.EndMs, evs[i].EndMs, "fin del evento %d de la pista %d", i, tr.Number)
			}
			require.Equal(t, w.Text, eventText(track, evs[i]), "texto del evento %d", i)
		}
	}
}

func TestSynthStructuralVariants(t *testing.T) {
	const secs = 120
	evs := synthEvents(secs)
	base := func() mkvtest.SynthOptions {
		return mkvtest.SynthOptions{Secs: secs, VideoBytesPerSec: 20 << 10, Tracks: []mkvtest.SynthTrack{
			{Kind: mkvtest.KindVideo}, {Kind: mkvtest.KindAudio, Lang: "jpn"},
			{Kind: mkvtest.KindASS, Lang: "spa", Events: evs},
			{Kind: mkvtest.KindSRT, Lang: "eng", Events: evs[:len(evs)/2]},
		}}
	}
	cases := []struct {
		name string
		mod  func(o *mkvtest.SynthOptions)
		cues bool
	}{
		{"mkvmerge: Cues al final con SeekHead, Void", func(o *mkvtest.SynthOptions) { o.VoidBytes = 4000 }, true},
		{"Cues al principio", func(o *mkvtest.SynthOptions) { o.CuesFirst = true }, true},
		{"Cues escasas (una cada 30 s)", func(o *mkvtest.SynthOptions) { o.CuesEveryMs = 30000 }, true},
		{"sin Cues", func(o *mkvtest.SynthOptions) { o.CuesEveryMs = -1 }, false},
		{"sin SeekHead (Cues al final, inalcanzables)", func(o *mkvtest.SynthOptions) { o.NoSeekHead = true }, false},
		{"Segment de tamaño desconocido", func(o *mkvtest.SynthOptions) { o.UnknownSegmentSize = true }, true},
		{"clusters de tamaño desconocido (directo)", func(o *mkvtest.SynthOptions) { o.UnknownClusterSize = true }, true},
		{"clusters grandes (15 s, video pesado)", func(o *mkvtest.SynthOptions) { o.ClusterMs = 15000; o.VideoBytesPerSec = 600 << 10 }, true},
		{"CRC-32 en cada cluster", func(o *mkvtest.SynthOptions) { o.CRC32 = true }, true},
		{"TimestampScale 100 µs", func(o *mkvtest.SynthOptions) { o.ScaleNs = 100_000; o.ClusterMs = 3000 }, true},
		{"todo junto: Segment desconocido + clusters desconocidos + Void + CRC", func(o *mkvtest.SynthOptions) {
			o.UnknownSegmentSize, o.UnknownClusterSize, o.VoidBytes, o.CRC32 = true, true, 300, true
		}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			o := base()
			tc.mod(&o)
			s := mkvtest.BuildSynth(o)
			f := openSynth(t, s)
			require.Equal(t, tc.cues, f.HasCues(), "HasCues")
			require.Len(t, f.SubtitleTracks(), 2)
			requireAllEvents(t, s, f)
		})
	}
}

func TestSynthTrackVariants(t *testing.T) {
	const secs = 60
	evs := synthEvents(secs)
	t.Run("pistas con números salteados y PGS en el medio", func(t *testing.T) {
		s := mkvtest.BuildSynth(mkvtest.SynthOptions{Secs: secs, Tracks: []mkvtest.SynthTrack{
			{Kind: mkvtest.KindVideo, Number: 1},
			{Kind: mkvtest.KindAudio, Number: 5, Lang: "jpn"},
			{Kind: mkvtest.KindASS, Number: 9, Lang: "spa", Events: evs},
			{Kind: mkvtest.KindPGS, Number: 10, Lang: "eng"},
			{Kind: mkvtest.KindSRT, Number: 200, Lang: "eng", Events: evs[:5]},
		}})
		f := openSynth(t, s)
		subs := f.SubtitleTracks()
		require.Len(t, subs, 3)
		require.Equal(t, []uint64{9, 10, 200}, []uint64{subs[0].Number, subs[1].Number, subs[2].Number})
		require.Equal(t, FormatASS, subs[0].Format())
		require.Equal(t, FormatUnknown, subs[1].Format(), "PGS no es texto")
		require.Equal(t, FormatSRT, subs[2].Format())
		requireAllEvents(t, s, f)
	})
	t.Run("sin BlockDuration: usa la duración por defecto de la pista", func(t *testing.T) {
		s := mkvtest.BuildSynth(mkvtest.SynthOptions{Secs: secs, Tracks: []mkvtest.SynthTrack{
			{Kind: mkvtest.KindVideo},
			{Kind: mkvtest.KindSRT, Lang: "eng", Events: evs, NoDuration: true, DefaultDurMs: 1900},
		}})
		f := openSynth(t, s)
		got := walkAll(t, f)
		tr := f.SubtitleTracks()[0]
		require.Len(t, got[tr.Number], len(evs))
		for _, e := range got[tr.Number] {
			require.Equal(t, int64(1900), e.EndMs-e.StartMs)
		}
	})
	t.Run("compresión zlib y recorte de cabecera", func(t *testing.T) {
		for _, mode := range []string{"zlib", "strip"} {
			kind := mkvtest.KindASS
			if mode == "strip" {
				kind = mkvtest.KindSRT // el recorte quita "Linea " del comienzo del texto
			}
			s := mkvtest.BuildSynth(mkvtest.SynthOptions{Secs: secs, Tracks: []mkvtest.SynthTrack{
				{Kind: mkvtest.KindVideo},
				{Kind: kind, Lang: "spa", Events: evs, Compress: mode},
			}})
			f := openSynth(t, s)
			requireAllEvents(t, s, f)
		}
	})
	t.Run("códec con el alias viejo S_ASS", func(t *testing.T) {
		s := mkvtest.BuildSynth(mkvtest.SynthOptions{Secs: secs, Tracks: []mkvtest.SynthTrack{
			{Kind: mkvtest.KindVideo},
			{Kind: mkvtest.KindASS, CodecID: "S_ASS", Lang: "spa", Events: evs},
			{Kind: mkvtest.KindASS, CodecID: "S_SSA", Lang: "eng", Events: evs},
		}})
		f := openSynth(t, s)
		for _, tr := range f.SubtitleTracks() {
			require.Equal(t, FormatASS, tr.Format(), "ffprobe llama 'ass' a %s y la lectura por franjas tiene que aceptarlo", tr.CodecID)
		}
	})
}

// Un bloque con lacing lleva varias líneas: no se deben perder en silencio.
func TestSynthLacedBlocksAreNotDropped(t *testing.T) {
	const secs = 30
	evs := []mkvtest.Event{
		{StartMs: 1000, EndMs: 3000, Text: "uno"},
		{StartMs: 1000, EndMs: 4000, Text: "dos, con coma"},
		{StartMs: 6000, EndMs: 8000, Text: "tres"},
		{StartMs: 6000, EndMs: 7000, Text: "cuatro"},
		{StartMs: 6000, EndMs: 9000, Text: "cinco"},
		{StartMs: 12000, EndMs: 13000, Text: "seis"},
	}
	for _, kind := range []string{mkvtest.KindSRT, mkvtest.KindASS} {
		s := mkvtest.BuildSynth(mkvtest.SynthOptions{Secs: secs, Tracks: []mkvtest.SynthTrack{
			{Kind: mkvtest.KindVideo},
			{Kind: kind, Lang: "spa", Events: evs, Lace: true},
		}})
		f := openSynth(t, s)
		got := walkAll(t, f)
		tr := f.SubtitleTracks()[0]
		var texts []string
		for _, e := range got[tr.Number] {
			texts = append(texts, eventText(tr, e))
		}
		require.Equal(t, []string{"uno", "dos, con coma", "tres", "cuatro", "cinco", "seis"}, texts, "pista %s con lacing", kind)
	}
}

func TestSynthCuesPointToClusters(t *testing.T) {
	s := mkvtest.BuildSynth(mkvtest.SynthOptions{Secs: 120, CuesEveryMs: 20000, VideoBytesPerSec: 20 << 10})
	f := openSynth(t, s)
	for _, ms := range []int64{0, 19_999, 20_000, 59_000, 119_000} {
		off := f.ClusterBefore(ms)
		cl, err := f.ReadCluster(context.Background(), off, nil)
		require.NoError(t, err)
		require.LessOrEqual(t, cl.StartMs, ms)
		require.Greater(t, cl.StartMs, ms-20_001, "la Cue está a menos de 20 s")
	}
}

// El generador tiene que producir archivos que ffmpeg también entienda: es lo que da
// confianza en que las pruebas imitan a un MKV real. Compara el orden de pistas que
// ve ffprobe con el de este paquete y la cantidad de eventos que extrae ffmpeg.
func TestSynthIsReadableByFFmpeg(t *testing.T) {
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg no está disponible")
	}
	const secs = 60
	evs := synthEvents(secs)
	s := mkvtest.BuildSynth(mkvtest.SynthOptions{
		Secs: secs, VoidBytes: 2000, Attachments: map[string]string{"F.ttf": "datos"},
		Tracks: []mkvtest.SynthTrack{
			// Sin video: ffprobe no tiene que decodificar relleno.
			{Kind: mkvtest.KindAudio, CodecID: "A_PCM/INT/LIT", Lang: "jpn"},
			{Kind: mkvtest.KindASS, Lang: "spa", Events: evs},
			{Kind: mkvtest.KindSRT, Lang: "eng", Events: evs[:10]},
			{Kind: mkvtest.KindASS, CodecID: "S_ASS", Lang: "fra", Events: evs[:20]},
		},
	})
	path := filepath.Join(t.TempDir(), "synth.mkv")
	require.NoError(t, os.WriteFile(path, s.Bytes, 0o644))

	ffprobe := filepath.Join(filepath.Dir(ffmpeg), "ffprobe")
	if runtime.GOOS == "windows" {
		ffprobe += ".exe"
	}
	out, err := exec.Command(ffprobe, "-v", "error", "-select_streams", "s", "-show_entries", "stream=codec_name:stream_tags=language", "-of", "csv=p=0", path).CombinedOutput()
	require.NoError(t, err, string(out))
	lines := strings.Fields(strings.ReplaceAll(string(out), "\r", ""))
	require.Equal(t, []string{"ass,spa", "subrip,eng", "ass,fra"}, lines, "orden y códecs de las pistas según ffprobe")

	f := openSynth(t, s)
	require.Len(t, f.SubtitleTracks(), 3)
	for _, tr := range f.SubtitleTracks() {
		require.Equal(t, tr.Format() != FormatUnknown, true)
	}
	for i, want := range []int{len(evs), 10, 20} {
		dst := filepath.Join(t.TempDir(), fmt.Sprintf("o%d.mkv", i))
		o, err := exec.Command(ffmpeg, "-y", "-v", "error", "-i", path, "-map", fmt.Sprintf("0:s:%d", i), "-c", "copy", dst).CombinedOutput()
		require.NoError(t, err, string(o))
		d, err := os.ReadFile(dst)
		require.NoError(t, err)
		// El archivo de salida es otro MKV: se vuelve a leer con este paquete.
		g, err := Open(context.Background(), BytesSource(d), Options{})
		require.NoError(t, err)
		got := walkAll(t, g)
		require.Len(t, got[g.SubtitleTracks()[0].Number], want, "eventos que ffmpeg ve en la pista %d", i)
	}
}

// failingSource falla (como Drive con un 403/429) al leer rangos que tocan [from, to).
type failingSource struct {
	BytesSource
	from, to int64
	err      error
}

func (f failingSource) ReadAt(ctx context.Context, p []byte, off int64) (int, error) {
	if off < f.to && off+int64(len(p)) > f.from {
		return 0, f.err
	}
	return f.BytesSource.ReadAt(ctx, p, off)
}

// Una falla de lectura al abrir no es "no es Matroska" ni "sin Cues": son errores pasajeros
// de Drive, y hay que poder distinguirlos de un archivo que de verdad no sirve.
func TestOpenReportsReadFailuresAsSuch(t *testing.T) {
	s := mkvtest.BuildSynth(mkvtest.SynthOptions{Secs: 60, VideoBytesPerSec: 8 << 10})
	boom := errors.New("drive: 403 userRateLimitExceeded")

	t.Run("cabecera", func(t *testing.T) {
		_, err := Open(context.Background(), failingSource{BytesSource(s.Bytes), 0, 4096, boom}, Options{ChunkSize: 64 << 10})
		require.ErrorIs(t, err, boom)
		require.NotErrorIs(t, err, ErrNotMatroska)
	})
	t.Run("Cues al final", func(t *testing.T) {
		size := int64(len(s.Bytes))
		// El SeekHead sí se lee; las Cues (al final del archivo) fallan.
		_, err := Open(context.Background(), failingSource{BytesSource(s.Bytes), size - 2000, size, boom}, Options{ChunkSize: 64 << 10})
		require.ErrorIs(t, err, boom)
		require.NotErrorIs(t, err, ErrNotMatroska)
	})
	t.Run("sano", func(t *testing.T) {
		f, err := Open(context.Background(), BytesSource(s.Bytes), Options{})
		require.NoError(t, err)
		require.True(t, f.HasCues())
	})
	t.Run("de verdad no es Matroska", func(t *testing.T) {
		_, err := Open(context.Background(), BytesSource(bytes.Repeat([]byte("MP4!"), 64)), Options{})
		require.ErrorIs(t, err, ErrNotMatroska)
		_, err = Open(context.Background(), BytesSource([]byte("corto")), Options{})
		require.ErrorIs(t, err, ErrNotMatroska)
	})
}

// Si el archivo cambió y el offset de las Cues ya no es un cluster, el error lo dice.
func TestReadClusterOnWrongOffsetIsAStructuralError(t *testing.T) {
	s := mkvtest.BuildSynth(mkvtest.SynthOptions{Secs: 60, VideoBytesPerSec: 8 << 10})
	f := openSynth(t, s)
	_, err := f.ReadCluster(context.Background(), s.ClusterOffsets[3]+7, nil)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrNotCluster) || errors.Is(err, ErrMalformed), "error estructural, no de lectura: %v", err)
}
