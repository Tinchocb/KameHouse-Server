package mediastream

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"kamehouse/internal/drive"
	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/mkvsubs"
	"kamehouse/internal/mkvsubs/mkvtest"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
)

const windowTestSecs = 300

type windowFixture struct {
	repo  *Repository
	tm    *mkvtest.MKV
	drive *mkvtest.FakeDrive
	path  string
}

// newWindowFixture arma un repositorio cuya fuente de Drive es un Drive falso con un MKV
// de prueba, detrás de la caché de bloques (como en HandleDrivePlay).
func newWindowFixture(t *testing.T) *windowFixture {
	t.Helper()
	tm := mkvtest.Get(t, windowTestSecs)
	size := int64(len(tm.Bytes))
	cache, err := drive.NewBlockCache(t.TempDir(), max(size/64, 64<<10), 0)
	require.NoError(t, err)
	fd := &mkvtest.FakeDrive{Data: tm.Bytes}
	fetch := cache.Fetcher("fileWin123", fd.Fetch)

	ffmpeg := "ffmpeg"
	r := newDriveSubsRepo(t, ffmpeg)
	r.SetDriveSourceFactory(func(_ context.Context, _ string) (mkvsubs.Source, error) {
		return drive.NewRangeSource(fetch, size), nil
	})
	return &windowFixture{repo: r, tm: tm, drive: fd, path: "gdrive://fileWin123/Show/ep.mkv"}
}

func strp(s string) *string { return &s }

func embeddedSubs() []videofile.Subtitle {
	return []videofile.Subtitle{
		{Index: 0, Codec: "ass", Extension: strp("ass")},
		{Index: 1, Codec: "subrip", Extension: strp("srt")},
	}
}

func (f *windowFixture) get(t *testing.T, track string) (int, string) {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/mediastream/subtitles?"+url.Values{"path": {f.path}, "trackIndex": {track}}.Encode(), nil)
	rec := httptest.NewRecorder()
	err := f.repo.ServeEchoExtractedSubtitles(e.NewContext(req, rec))
	var he *echo.HTTPError
	if errors.As(err, &he) {
		return he.Code, ""
	}
	require.NoError(t, err)
	return rec.Code, rec.Body.String()
}

func (f *windowFixture) waitWindow(t *testing.T, pos float64, until float64) DriveWindowStatus {
	t.Helper()
	var st DriveWindowStatus
	require.Eventually(t, func() bool {
		var err error
		st, err = f.repo.DriveSubtitleWindow(context.Background(), f.path, pos, false)
		require.NoError(t, err)
		require.NotEqual(t, DriveWindowFailed, st.State, st.Error)
		return st.CoveredUntil >= until && st.State != DriveWindowLoading
	}, 30*time.Second, 20*time.Millisecond, "ventana en %.0f s", pos)
	return st
}

// driveWindowTracks dice qué pistas se leen por ventanas, o nil si el archivo no sirve o la
// lectura falló. Es el contrato del método DriveWindowSupport que se borró de producción:
// el código real decide con los campos de DriveWindowSupportInfo.
func driveWindowTracks(ctx context.Context, r *Repository, drivePath string, embedded []videofile.Subtitle) map[uint32]bool {
	info := r.DriveWindowSupportInfo(ctx, drivePath, embedded)
	if info.FileReason != "" || info.ReadFailed {
		return nil
	}
	return info.Tracks
}

func TestDriveWindowSupportAndAttachments(t *testing.T) {
	f := newWindowFixture(t)
	embedded := append(embeddedSubs(), videofile.Subtitle{Index: 2, Codec: "hdmv_pgs_subtitle", Extension: strp("sup"), IsImageBased: true})

	supported := driveWindowTracks(context.Background(), f.repo, f.path, embedded)
	require.Equal(t, map[uint32]bool{0: true, 1: true}, supported, "ASS y SRT sí; el PGS (que además no existe en el archivo) no")

	// Abrir deja las fuentes embebidas donde las sirve /att.
	font := filepath.Join(videofile.GetFileAttCacheDir(f.repo.CacheDir(), DriveSubtitleHash(f.path)), mkvtest.FontName)
	got, err := os.ReadFile(font)
	require.NoError(t, err)
	require.Equal(t, mkvtest.FontData, string(got))

	// Una pista cuyo códec no coincide con lo que dijo ffprobe no se ofrece.
	mismatch := []videofile.Subtitle{{Index: 0, Codec: "subrip", Extension: strp("srt")}}
	require.Empty(t, driveWindowTracks(context.Background(), f.repo, f.path, mismatch))
}

func TestDriveWindowUnavailable(t *testing.T) {
	r := newDriveSubsRepo(t, "ffmpeg")
	// Sin fábrica de fuente: nada se ofrece por ventanas.
	require.Empty(t, driveWindowTracks(context.Background(), r, "gdrive://x/a.mkv", embeddedSubs()))
	_, err := r.DriveSubtitleWindow(context.Background(), "gdrive://x/a.mkv", 0, false)
	require.ErrorIs(t, err, ErrDriveWindowUnavailable)

	// Un archivo que no es Matroska tampoco.
	r.SetDriveSourceFactory(func(context.Context, string) (mkvsubs.Source, error) {
		return mkvsubs.BytesSource("esto no es un mkv, pero tiene tamaño suficiente para parecerlo"), nil
	})
	_, err = r.DriveSubtitleWindow(context.Background(), "gdrive://x/b.mp4", 0, false)
	require.ErrorIs(t, err, ErrDriveWindowUnavailable)
}

func TestDriveWindowReadsOnlyTheRequestedPart(t *testing.T) {
	f := newWindowFixture(t)
	ctx := context.Background()
	require.NotEmpty(t, driveWindowTracks(ctx, f.repo, f.path, embeddedSubs()))
	size := int64(len(f.tm.Bytes))

	// Inicio: cubre 0–90 s y el archivo no se lee entero.
	st := f.waitWindow(t, 0, 89)
	require.Greater(t, st.Version, int64(0))
	require.NotEqual(t, DriveWindowComplete, st.State)

	code, ass := f.get(t, "0")
	require.Equal(t, http.StatusOK, code)
	require.Contains(t, ass, "[Script Info]")
	require.Contains(t, ass, "Linea 0, con coma y acento: ñandú")
	require.Contains(t, ass, "Cartel largo")
	require.False(t, strings.Contains(ass, "Linea 130,"), "lo del minuto 3 todavía no se leyó")
	code, srt := f.get(t, "1")
	require.Equal(t, http.StatusOK, code)
	require.Contains(t, srt, "Hello 0\nsecond line")

	atStart := f.drive.Bytes()
	require.Less(t, atStart, size*55/100, "leer los primeros 90 s no debe bajar casi todo el archivo (bajó %d de %d)", atStart, size)

	// Salto al minuto 3:20: se leen 140–290 s (60 s antes, 90 después).
	st = f.waitWindow(t, 200, 289)
	_, ass = f.get(t, "0")
	require.Contains(t, ass, "Linea 130,")
	require.Contains(t, ass, "Linea 0, con coma", "lo ya leído se conserva")
	require.False(t, strings.Contains(ass, "Linea 80,"), "el tramo 100–140 s nunca se pidió")
	require.Less(t, f.drive.Bytes(), size*90/100, "dos ventanas no deben bajar el archivo entero")
	t.Logf("bytes de Drive tras dos ventanas: %.1f de %.1f MiB (%.0f%%)", float64(f.drive.Bytes())/(1<<20), float64(size)/(1<<20), float64(f.drive.Bytes())*100/float64(size))
	require.False(t, f.repo.DriveSubtitlesExtracted(f.path), "con la lectura parcial no hay nada 'extraído' en disco")
}

func TestDriveWindowCompleteFileIsPersisted(t *testing.T) {
	f := newWindowFixture(t)
	ctx := context.Background()
	require.NotEmpty(t, driveWindowTracks(ctx, f.repo, f.path, embeddedSubs()))

	require.Eventually(t, func() bool {
		st, err := f.repo.DriveSubtitleWindow(ctx, f.path, 0, true)
		require.NoError(t, err)
		require.NotEqual(t, DriveWindowFailed, st.State, st.Error)
		return st.State == DriveWindowComplete && f.repo.DriveSubtitlesExtracted(f.path)
	}, 60*time.Second, 50*time.Millisecond)

	// Quedó en disco con el formato de la extracción con ffmpeg y marcada como hecha.
	require.True(t, f.repo.DriveSubtitlesExtracted(f.path))
	require.Equal(t, DriveSubtitlesDone, f.repo.DriveSubtitleStatus(f.path).State)
	subsDir := videofile.GetFileSubsCacheDir(f.repo.CacheDir(), DriveSubtitleHash(f.path))
	ass, err := os.ReadFile(filepath.Join(subsDir, "0.ass"))
	require.NoError(t, err)
	require.Equal(t, len(f.tm.ASSEvs), strings.Count(string(ass), "Dialogue: "))
	srt, err := os.ReadFile(filepath.Join(subsDir, "1.srt"))
	require.NoError(t, err)
	require.Equal(t, len(f.tm.SRTEvs), strings.Count(string(srt), " --> "))

	// Con la sesión descartada (reinicio), el endpoint sirve desde disco.
	f.repo.driveWin.mu.Lock()
	f.repo.driveWin.sessions = nil
	f.repo.driveWin.mu.Unlock()
	code, body := f.get(t, "0")
	require.Equal(t, http.StatusOK, code)
	require.Equal(t, string(ass), body)
}

func TestDriveWindowSeekBackfillCatchesLongSign(t *testing.T) {
	f := newWindowFixture(t)
	ctx := context.Background()
	require.NotEmpty(t, driveWindowTracks(ctx, f.repo, f.path, embeddedSubs()))
	// A los 30 s un cartel que arrancó a los 4.7 s (dura 40 s) sigue en pantalla: la
	// ventana arranca 60 s antes, o sea desde el principio, y lo trae.
	f.waitWindow(t, 30, 100)
	_, ass := f.get(t, "0")
	require.Contains(t, ass, "Cartel largo")
}

// Una lectura de Drive que falla se informa y se reintenta sola en la próxima llamada.
func TestDriveWindowFailureRecovers(t *testing.T) {
	f := newWindowFixture(t)
	ctx := context.Background()
	size := int64(len(f.tm.Bytes))
	cache, err := drive.NewBlockCache(t.TempDir(), max(size/64, 64<<10), 0)
	require.NoError(t, err)

	var broken atomic.Bool
	flaky := func(c context.Context, rh string) (*http.Response, error) {
		if broken.Load() {
			return nil, errors.New("drive: download quota exceeded for this file")
		}
		return f.drive.Fetch(c, rh)
	}
	fetch := cache.Fetcher("fileFlaky1", flaky)
	f.repo.SetDriveSourceFactory(func(context.Context, string) (mkvsubs.Source, error) {
		return drive.NewRangeSource(fetch, size), nil
	})
	require.NotEmpty(t, driveWindowTracks(ctx, f.repo, f.path, embeddedSubs()))
	f.waitWindow(t, 0, 89)

	broken.Store(true)
	var st DriveWindowStatus
	require.Eventually(t, func() bool {
		st, _ = f.repo.DriveSubtitleWindow(ctx, f.path, 200, false)
		return st.State == DriveWindowFailed
	}, 60*time.Second, 50*time.Millisecond)
	require.Contains(t, st.Error, "quota")

	broken.Store(false)
	require.Eventually(t, func() bool {
		st, _ = f.repo.DriveSubtitleWindow(ctx, f.path, 200, false)
		return st.CoveredUntil >= 289
	}, 60*time.Second, 100*time.Millisecond, "tras volver Drive, la ventana se completa sola")
}
