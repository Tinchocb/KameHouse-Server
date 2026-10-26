package handlers

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"kamehouse/internal/core"
	"kamehouse/internal/database/models"
	"kamehouse/internal/mediastream"
	"kamehouse/internal/mediastream/extsubs"
	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/mkvsubs"
	"kamehouse/internal/mkvsubs/mkvtest"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

func TestWithLocalExternalSubtitles(t *testing.T) {
	dir := t.TempDir()
	video := filepath.Join(dir, "Ep 01.mkv")
	require.NoError(t, os.WriteFile(video, []byte("x"), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "Ep 01.es.srt"), []byte("1\n00:00:01,000 --> 00:00:02,000\nhola\n"), 0o644))

	embedded := []videofile.Subtitle{{Index: 0, Codec: "ass"}}
	shared := &mediastream.MediaContainer{
		Filepath:  video,
		MediaInfo: &videofile.MediaInfo{Subtitles: embedded},
	}
	cache := t.TempDir()

	out, err := withLocalExternalSubtitles(cache, shared, video)
	require.NoError(t, err)
	require.Len(t, out.MediaInfo.Subtitles, 2)
	require.Equal(t, uint32(0), out.MediaInfo.Subtitles[0].Index)
	require.Equal(t, uint32(extsubs.IndexBase), out.MediaInfo.Subtitles[1].Index)
	require.Equal(t, "subrip", out.MediaInfo.Subtitles[1].Codec)
	require.Equal(t, "spa", *out.MediaInfo.Subtitles[1].Language)
	// El container compartido de la caché de playback no se toca.
	require.Len(t, shared.MediaInfo.Subtitles, 1)
	require.NotEmpty(t, extsubs.FindFile(cache, video, extsubs.IndexBase))

	// Sin subtítulos sueltos: se devuelve el mismo container.
	other := filepath.Join(dir, "Ep 02.mkv")
	require.NoError(t, os.WriteFile(other, []byte("x"), 0o644))
	same, err := withLocalExternalSubtitles(cache, shared, other)
	require.NoError(t, err)
	require.Same(t, shared, same)
}

func TestAppendExternalSubtitlesDoesNotAlias(t *testing.T) {
	embedded := make([]videofile.Subtitle, 1, 8)
	out := appendExternalSubtitles(embedded, []videofile.Subtitle{{Index: 1000}})
	require.Len(t, out, 2)
	require.Len(t, embedded, 1)
	_ = append(embedded, videofile.Subtitle{Index: 5})
	require.Equal(t, uint32(1000), out[1].Index)
}

func TestAddDriveEmbeddedSubtitlesMarksPending(t *testing.T) {
	logger := zerolog.Nop()
	repo := mediastream.NewRepository(&mediastream.NewRepositoryOptions{Logger: &logger})
	h := &Handler{App: &core.App{StreamingServices: core.StreamingServices{MediastreamRepository: repo}}}

	ass, sup, xsub := "ass", "sup", ""
	src := &videofile.MediaInfo{
		Fonts: []string{"a.ttf"},
		Subtitles: []videofile.Subtitle{
			{Index: 0, Codec: "ass", Extension: &ass, Link: strPtr("/0.ass")},
			{Index: 1, Codec: "hdmv_pgs_subtitle", Extension: &sup, IsImageBased: true, Link: strPtr("/1.sup")},
			{Index: 2, Codec: "dvb_subtitle", Extension: &xsub, IsImageBased: true},
		},
	}
	out := &mediastream.MediaContainer{MediaInfo: &videofile.MediaInfo{}}
	h.addDriveEmbeddedSubtitles(context.Background(), out, src, "gdrive://id/ep.mkv")

	require.Len(t, out.MediaInfo.Subtitles, 2, "el DVB sin extensión no se ofrece")
	for _, s := range out.MediaInfo.Subtitles {
		require.True(t, s.NeedsExtraction)
		require.Nil(t, s.Link)
	}
	require.Empty(t, out.MediaInfo.Fonts, "las fuentes recién salen tras extraer")
	// El origen no se muta.
	require.NotNil(t, src.Subtitles[0].Link)
	require.False(t, src.Subtitles[0].NeedsExtraction)
}

func strPtr(s string) *string { return &s }

// En un MKV de Drive con Cues, las pistas de texto se leen por ventanas (progresivas, sin
// botón) y el resto (PGS) sigue pendiente de la extracción completa.
func TestAddDriveEmbeddedSubtitlesMarksProgressive(t *testing.T) {
	tm := mkvtest.Get(t, 90)
	logger := zerolog.Nop()
	repo := mediastream.NewRepository(&mediastream.NewRepositoryOptions{Logger: &logger})
	repo.InitializeModules(&models.MediastreamSettings{FfmpegPath: "ffmpeg", FfprobePath: "ffprobe"}, t.TempDir(), t.TempDir())
	repo.SetDriveSourceFactory(func(context.Context, string) (mkvsubs.Source, error) {
		return mkvsubs.BytesSource(tm.Bytes), nil
	})
	h := &Handler{App: &core.App{StreamingServices: core.StreamingServices{MediastreamRepository: repo}}}

	ass, srt, sup := "ass", "srt", "sup"
	src := &videofile.MediaInfo{
		Fonts: []string{mkvtest.FontName},
		Subtitles: []videofile.Subtitle{
			{Index: 0, Codec: "ass", Extension: &ass, Link: strPtr("/0.ass")},
			{Index: 1, Codec: "subrip", Extension: &srt, Link: strPtr("/1.srt")},
			{Index: 2, Codec: "hdmv_pgs_subtitle", Extension: &sup, IsImageBased: true},
		},
	}
	out := &mediastream.MediaContainer{MediaInfo: &videofile.MediaInfo{}}
	h.addDriveEmbeddedSubtitles(context.Background(), out, src, "gdrive://id/ep.mkv")

	require.Len(t, out.MediaInfo.Subtitles, 3)
	for _, s := range out.MediaInfo.Subtitles[:2] {
		require.True(t, s.Progressive, "pista %d", s.Index)
		require.False(t, s.NeedsExtraction)
		require.Nil(t, s.Link)
	}
	pgs := out.MediaInfo.Subtitles[2]
	require.True(t, pgs.NeedsExtraction)
	require.False(t, pgs.Progressive)
	require.Equal(t, []string{mkvtest.FontName}, out.MediaInfo.Fonts, "las fuentes ya están disponibles")
	require.False(t, src.Subtitles[0].Progressive, "el origen no se muta")
}
