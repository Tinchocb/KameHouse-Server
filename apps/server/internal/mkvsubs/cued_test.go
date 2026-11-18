package mkvsubs_test

import (
	"context"
	"sync/atomic"
	"testing"

	"kamehouse/internal/mkvsubs"
	"kamehouse/internal/mkvsubs/mkvtest"

	"github.com/stretchr/testify/require"
)

// countingSource cuenta lo que se le pide (lo que costaría en Drive).
type countingSource struct {
	mkvsubs.BytesSource
	bytes, reqs atomic.Int64
}

func (c *countingSource) ReadAt(ctx context.Context, p []byte, off int64) (int, error) {
	n, err := c.BytesSource.ReadAt(ctx, p, off)
	c.bytes.Add(int64(n))
	c.reqs.Add(1)
	return n, err
}

func cuedSynth(o mkvtest.SynthOptions) *mkvtest.Synth {
	o.Secs = 120
	o.VideoBytesPerSec = 256 << 10
	o.SubtitleCues = true
	o.Tracks = []mkvtest.SynthTrack{
		{Kind: mkvtest.KindVideo},
		{Kind: mkvtest.KindAudio},
		{Kind: mkvtest.KindSRT, Events: []mkvtest.Event{
			{StartMs: 4_000, EndMs: 6_000, Text: "primera"},
			{StartMs: 71_670, EndMs: 77_880, Text: "¡EL TÍTULO DEL EPISODIO!"},
		}},
		{Kind: mkvtest.KindASS, Events: []mkvtest.Event{
			{StartMs: 11_340, EndMs: 16_830, Style: "Narrador", Text: "La batalla llegó a su fin"},
			{StartMs: 71_460, EndMs: 76_960, Style: "Titulos", Text: "¡El título!"},
			{StartMs: 71_460, EndMs: 76_960, Style: "Titulos-furigana", Text: "mismo instante"},
			{StartMs: 110_000, EndMs: 112_000, Style: "Default", Text: "última"},
		}},
	}
	return mkvtest.BuildSynth(o)
}

func TestReadCuedReadsOnlyTheSubtitleBlock(t *testing.T) {
	for name, o := range map[string]mkvtest.SynthOptions{
		"cues al final":         {},
		"cues al frente":        {CuesFirst: true},
		"con CRC en el cluster": {CRC32: true},
		"timestamp en 100 µs":   {ScaleNs: 100_000},
		"cluster de 2 s":        {ClusterMs: 2000},
		"con relleno (Void)":    {VoidBytes: 4096},
		"cluster tamaño ignoto": {UnknownClusterSize: true},
	} {
		t.Run(name, func(t *testing.T) {
			s := cuedSynth(o)
			f, err := mkvsubs.Open(context.Background(), mkvsubs.BytesSource(s.Bytes), mkvsubs.Options{})
			require.NoError(t, err)
			srt, ass := s.SubTrackNumbers[0], s.SubTrackNumbers[1]

			all := f.TrackCues(ass, 0, 1<<40)
			require.Len(t, all, 4)
			require.Empty(t, f.TrackCues(ass, 20_000, 60_000))
			window := f.TrackCues(ass, 60_000, 100_000)
			require.Len(t, window, 2)
			require.Equal(t, int64(71_460), window[0].TimeMs)
			require.Equal(t, int64(5_500), window[0].DurMs)

			direct := &countingSource{BytesSource: s.Bytes}
			blocks, err := f.ReadCued(context.Background(), direct, window[0])
			require.NoError(t, err)
			require.Len(t, blocks, 1)
			require.Equal(t, ass, blocks[0].Track)
			require.Equal(t, int64(71_460), blocks[0].StartMs)
			require.Equal(t, int64(5_500), blocks[0].DurationMs)
			require.Contains(t, string(blocks[0].Data), ",Titulos,")
			require.Contains(t, string(blocks[0].Data), "¡El título!")

			// Lo demás del índice se lee sin volver a pedir el encabezado del cluster.
			reqs := direct.reqs.Load()
			for _, c := range append(all, f.TrackCues(srt, 0, 1<<40)...) {
				bs, err := f.ReadCued(context.Background(), direct, c)
				require.NoError(t, err)
				require.Len(t, bs, 1)
				require.Equal(t, c.TimeMs, bs[0].StartMs)
			}
			require.LessOrEqual(t, direct.reqs.Load()-reqs, int64(6+1))
			// Siete bloques de subtítulo: ni cerca de un cluster de video.
			require.Less(t, direct.bytes.Load(), int64(64<<10))

			srtCues := f.TrackCues(srt, 70_000, 80_000)
			require.Len(t, srtCues, 1)
			bs, err := f.ReadCued(context.Background(), direct, srtCues[0])
			require.NoError(t, err)
			require.Equal(t, "¡EL TÍTULO DEL EPISODIO!", string(bs[0].Data))
		})
	}
}

func TestTrackCuesEmptyWithoutSubtitleCues(t *testing.T) {
	s := mkvtest.BuildSynth(mkvtest.SynthOptions{Secs: 20, Tracks: mkvtest.DefaultSynthTracks(20)})
	f, err := mkvsubs.Open(context.Background(), mkvsubs.BytesSource(s.Bytes), mkvsubs.Options{})
	require.NoError(t, err)
	for _, n := range s.SubTrackNumbers {
		require.Empty(t, f.TrackCues(n, 0, 1<<40))
	}
	require.True(t, f.HasCues())
}
