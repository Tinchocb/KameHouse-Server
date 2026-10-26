package mediastream

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync/atomic"
	"testing"
	"time"

	"kamehouse/internal/drive"
	"kamehouse/internal/mkvsubs"
	"kamehouse/internal/mkvsubs/mkvtest"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
)

// Subtítulos de Drive "a veces sí y a veces no": reproducciones deterministas con un MKV
// sintético y un Drive falso que cuenta bytes y puede fallar o colgarse a pedido.

const (
	synthSecs      = 600
	longSignText   = "CARTEL LARGO"
	creditsRollTxt = "CREDITOS"
)

// synthEpisodeTracks: diálogo cada 3 s en ASS (Latino) y SRT (English), con un cartel de
// 160 s que arranca a los 100 s y un rodillo de créditos de 78 s.
func synthEpisodeTracks() []mkvtest.SynthTrack {
	var ass, srt []mkvtest.Event
	for i := 0; ; i++ {
		start := int64(i)*3000 + 400
		if start >= (synthSecs-3)*1000 {
			break
		}
		ass = append(ass, mkvtest.Event{StartMs: start, EndMs: start + 2200, Text: fmt.Sprintf("Linea %d", i)})
		if i%2 == 0 {
			srt = append(srt, mkvtest.Event{StartMs: start + 300, EndMs: start + 2000, Text: fmt.Sprintf("Hello %d", i)})
		}
	}
	ass = append(ass,
		mkvtest.Event{StartMs: 100_000, EndMs: 260_000, Text: longSignText},
		mkvtest.Event{StartMs: 520_000, EndMs: 598_000, Text: creditsRollTxt},
	)
	return []mkvtest.SynthTrack{
		{Kind: mkvtest.KindVideo},
		{Kind: mkvtest.KindAudio, Lang: "jpn"},
		{Kind: mkvtest.KindASS, Lang: "spa", Name: "Latino", Events: ass},
		{Kind: mkvtest.KindSRT, Lang: "eng", Name: "English", Events: srt},
	}
}

type synthFx struct {
	repo  *Repository
	synth *mkvtest.Synth
	fd    *mkvtest.FakeDrive
	cache *drive.BlockCache
	path  string
}

func defaultSynthOpts() mkvtest.SynthOptions {
	return mkvtest.SynthOptions{
		Secs:             synthSecs,
		VideoBytesPerSec: 24 << 10,
		Tracks:           synthEpisodeTracks(),
		Attachments:      map[string]string{"Fuente.ttf": "datos de fuente"},
	}
}

// newSynthFx arma un repositorio cuya fuente de Drive es el MKV sintético detrás de la
// caché de bloques (como en HandleDrivePlay), con bloques de ~1,5 % del archivo (la
// proporción de 16 MiB sobre ~1 GB).
func newSynthFx(t *testing.T, o mkvtest.SynthOptions, fileID string) *synthFx {
	t.Helper()
	s := mkvtest.BuildSynth(o)
	size := s.Size()
	cache, err := drive.NewBlockCache(t.TempDir(), max(size/64, 64<<10), 0)
	require.NoError(t, err)
	fd := &mkvtest.FakeDrive{Data: s.Bytes}
	fetch := cache.Fetcher(fileID, fd.Fetch)

	r := newDriveSubsRepo(t, "ffmpeg")
	r.SetDriveSourceFactory(func(_ context.Context, _ string) (mkvsubs.Source, error) {
		return drive.NewRangeSource(fetch, size), nil
	})
	fx := &synthFx{repo: r, synth: s, fd: fd, cache: cache, path: "gdrive://" + fileID + "/Show/ep.mkv"}
	t.Cleanup(func() { r.closeDriveWindows(); cache.WaitIdle(5 * time.Second) })
	return fx
}

func (r *Repository) closeDriveWindows() {
	g := &r.driveWin
	g.mu.Lock()
	list := make([]*driveWindowSession, 0, len(g.sessions))
	for _, s := range g.sessions {
		list = append(list, s)
	}
	g.sessions = nil
	g.mu.Unlock()
	for _, s := range list {
		if s.cancel != nil {
			s.cancel()
		}
	}
	for _, s := range list {
		for i := 0; i < 200; i++ {
			s.mu.Lock()
			running := s.running
			s.mu.Unlock()
			if !running {
				break
			}
			time.Sleep(10 * time.Millisecond)
		}
	}
}

func (fx *synthFx) get(t *testing.T, track string, extra ...string) (int, string, http.Header) {
	t.Helper()
	q := url.Values{"path": {fx.path}, "trackIndex": {track}}
	for i := 0; i+1 < len(extra); i += 2 {
		q.Set(extra[i], extra[i+1])
	}
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/mediastream/subtitles?"+q.Encode(), nil)
	rec := httptest.NewRecorder()
	err := fx.repo.ServeEchoExtractedSubtitles(e.NewContext(req, rec))
	var he *echo.HTTPError
	if errors.As(err, &he) {
		return he.Code, fmt.Sprint(he.Message), rec.Header()
	}
	require.NoError(t, err)
	return rec.Code, rec.Body.String(), rec.Header()
}

func (fx *synthFx) window(t *testing.T, pos float64) DriveWindowStatus {
	t.Helper()
	st, err := fx.repo.DriveSubtitleWindow(context.Background(), fx.path, pos, false)
	require.NoError(t, err)
	return st
}

// waitCovered pide la ventana en pos hasta que lo leído llegue `ahead` segundos más allá.
func (fx *synthFx) waitCovered(t *testing.T, pos, ahead float64) DriveWindowStatus {
	t.Helper()
	var st DriveWindowStatus
	require.Eventually(t, func() bool {
		st = fx.window(t, pos)
		return st.CoveredFrom <= pos && st.CoveredUntil >= pos+ahead && st.State != DriveWindowLoading
	}, 20*time.Second, 10*time.Millisecond, "ventana en %.0f s: %+v", pos, st)
	return st
}

func (fx *synthFx) open(t *testing.T) {
	t.Helper()
	require.NotEmpty(t, driveWindowTracks(context.Background(), fx.repo, fx.path, embeddedSubs()), "el archivo sintético se puede leer por franjas")
}

// ─── (a) relleno hacia atrás ──────────────────────────────────────────────────────────────

// Un cartel que arrancó a los 100 s y dura 160 s sigue en pantalla a los 200 s. Con un
// relleno fijo de 60 s, un salto a ese momento no lo trae si el servidor ya había visto
// carteles largos antes (tras ver los primeros 40 s, la franja leída llega a 130 s y el
// cartel ya se conoce). El relleno tiene que crecer hasta cubrirlo.
func TestIntermittentLongSignAfterJumpOnceLearned(t *testing.T) {
	fx := newSynthFx(t, defaultSynthOpts(), "synthA1")
	fx.open(t)
	fx.waitCovered(t, 40, 60) // se ve desde el principio: la franja llega hasta ~130 s y aparece el cartel
	_, ass, _ := fx.get(t, "0")
	require.Contains(t, ass, longSignText, "visto durante la reproducción normal")

	// El reproductor salta a 200 s: el servidor ya sabe que hay carteles de 160 s.
	st := fx.waitCovered(t, 200, 60)
	require.GreaterOrEqual(t, st.Diag.BackfillSec, 160.0, "el relleno crece hasta el cartel más largo conocido: %+v", st.Diag)
	require.Greater(t, st.Diag.LongestEventSec, 159.0)

	// Una sesión nueva (otro arranque) que salta directo a 200 s no conoce el cartel: es el
	// límite del relleno acotado, que cuesta bytes; lo que sí tiene que traer es el diálogo.
	cold := newSynthFx(t, defaultSynthOpts(), "synthA1b")
	cold.open(t)
	cold.waitCovered(t, 200, 60)
	_, ass, _ = cold.get(t, "0", "t", "200")
	require.Contains(t, ass, ",,Linea 66\n", "el diálogo de la franja")
}

// El tope de bytes acota el relleno: un cartel conocido enorme no obliga a leer media película.
func TestIntermittentBackfillIsCappedByBytes(t *testing.T) {
	fx := newSynthFx(t, defaultSynthOpts(), "synthA1c")
	fx.open(t)
	fx.waitCovered(t, 40, 60)
	fx.repo.driveWin.mu.Lock()
	s := fx.repo.driveWin.sessions[DriveSubtitleHash(fx.path)]
	fx.repo.driveWin.mu.Unlock()
	s.mu.Lock()
	s.longestMs = 290_000 // un cartel de casi 5 minutos
	capMs := s.backfillCapMsLocked()
	got := s.backfillLocked()
	s.mu.Unlock()
	require.LessOrEqual(t, got, capMs)
	require.GreaterOrEqual(t, got, driveWindowBackfillFloor.Milliseconds())
	// El archivo de la prueba pesa menos que el tope: el relleno llega al cartel completo.
	require.EqualValues(t, 295_000, got)

	// Con un archivo de 5 GB (cabe 192 MiB en ~10 min de video de 24), el tope manda.
	s.mu.Lock()
	capped := int64(float64(driveWindowBackfillMaxBytes) / float64(5<<30) * float64(24*60*1000))
	s.mu.Unlock()
	require.Less(t, capped, int64(120_000))
}

// ─── (g/h) la posición del reproductor manda, no la de la URL ─────────────────────────────

// El reproductor pide la pista con `&t=<segundo de reanudación>` (fijo, el del arranque).
// Cada recarga de la pista volvía a fijar la ventana del servidor en ese segundo, pisando
// la posición real que el reproductor acababa de informar.
func TestIntermittentTrackFetchDoesNotMoveTheWindow(t *testing.T) {
	fx := newSynthFx(t, defaultSynthOpts(), "synthA2")
	fx.open(t)
	fx.waitCovered(t, 400, 30)

	fx.repo.driveWin.mu.Lock()
	s := fx.repo.driveWin.sessions[DriveSubtitleHash(fx.path)]
	fx.repo.driveWin.mu.Unlock()
	require.NotNil(t, s)
	s.mu.Lock()
	before := s.posMs
	s.mu.Unlock()
	require.EqualValues(t, 400_000, before)

	code, _, _ := fx.get(t, "0", "t", "30") // la URL de arranque: reanudaba en el segundo 30
	require.Equal(t, http.StatusOK, code)
	s.mu.Lock()
	after := s.posMs
	s.mu.Unlock()
	require.EqualValues(t, 400_000, after, "bajar la pista no debe mover la franja que se está leyendo")
}

// El estado de la ventana tiene que decir "cubierta" solo si la posición está dentro del
// tramo; si no, el reproductor recarga la pista una y otra vez antes de tiempo.
func TestIntermittentCoveredMeansContainsThePosition(t *testing.T) {
	fx := newSynthFx(t, defaultSynthOpts(), "synthA3")
	fx.open(t)
	fx.waitCovered(t, 0, 60)

	// Salto lejos de lo leído: hasta que no se lea ahí, no está cubierto.
	gate := make(chan struct{})
	fx.fd.SetHook(func(ctx context.Context, n int64, rh string) error {
		select {
		case <-gate:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	})
	// Los bloques del inicio ya están en la caché; los del minuto 8 no.
	st := fx.window(t, 480)
	require.Equal(t, -1.0, st.CoveredUntil, "el segundo 480 todavía no se leyó: no puede figurar como cubierto (hay lo leído en 0–90 s): %+v", st)
	require.Equal(t, -1.0, st.CoveredFrom)
	close(gate)
	fx.fd.SetHook(nil)
	st = fx.waitCovered(t, 480, 30)
	require.LessOrEqual(t, st.CoveredFrom, 480.0)
}

// ─── orden de lectura tras un salto ───────────────────────────────────────────────────────

// Tras saltar a la mitad, lo primero que hay que leer es donde está el video, no los 60 s
// anteriores: con un Drive lento esos 60 s son la espera visible ("no aparecen").
func TestIntermittentJumpReadsThePositionFirst(t *testing.T) {
	fx := newSynthFx(t, defaultSynthOpts(), "synthA4")
	fx.open(t)

	// Un Drive lento: cada petición cuesta 40 ms.
	fx.fd.SetHook(func(ctx context.Context, n int64, rh string) error {
		select {
		case <-time.After(40 * time.Millisecond):
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	})
	fx.fd.Reset()
	st := fx.window(t, 300)
	var firstCovered int64
	require.Eventually(t, func() bool {
		st = fx.window(t, 300)
		if st.CoveredUntil >= 300 && firstCovered == 0 {
			firstCovered = fx.fd.Bytes()
		}
		return st.CoveredUntil >= 300
	}, 20*time.Second, time.Millisecond)
	fx.fd.SetHook(nil)
	size := fx.synth.Size()
	t.Logf("bytes de Drive hasta cubrir el segundo 300: %.1f %% del archivo", float64(firstCovered)*100/float64(size))
	require.Less(t, firstCovered, size*8/100, "cubrir la posición pedida no debe esperar a leer el relleno de 60 s anterior")
}

// ─── (c) cupos de lectura ─────────────────────────────────────────────────────────────────

// Episodios con Drive colgado no pueden dejar sin lectura a otro: con 2 cupos globales, dos
// colgados (cada lectura espera 1 minuto) bastaban.
func TestIntermittentHungReadsDoNotStarveOtherEpisodes(t *testing.T) {
	hung := []*synthFx{
		newSynthFx(t, defaultSynthOpts(), "synthC1"),
		newSynthFx(t, defaultSynthOpts(), "synthC2"),
		newSynthFx(t, defaultSynthOpts(), "synthC3"),
	}
	healthy := newSynthFx(t, defaultSynthOpts(), "synthC4")
	for _, fx := range append(hung, healthy) {
		fx.open(t)
	}
	hang := func(ctx context.Context, n int64, rh string) error {
		<-ctx.Done() // Drive no contesta
		return ctx.Err()
	}
	for _, fx := range hung {
		fx.fd.SetHook(hang)
		fx.window(t, 300)
	}
	time.Sleep(200 * time.Millisecond)

	require.Eventually(t, func() bool {
		return healthy.window(t, 0).CoveredUntil >= 60
	}, 5*time.Second, 20*time.Millisecond, "tres episodios colgados no pueden dejar sin lectura al cuarto")
	for _, fx := range hung {
		fx.fd.SetHook(nil)
	}
}

// ─── (f) el archivo cambió ────────────────────────────────────────────────────────────────

// Si el archivo se reemplaza en Drive (mismo ID, otro contenido y tamaño), la sesión vieja
// guarda posiciones que ya no son clusters: fallaba para siempre en la misma lectura.
func TestIntermittentSessionHealsWhenTheFileChanged(t *testing.T) {
	const id = "synthF1"
	fx := newSynthFx(t, defaultSynthOpts(), id)
	fx.open(t)
	fx.waitCovered(t, 0, 30)

	// El archivo nuevo tiene otra estructura (clusters de 8 s, con Void) y otro tamaño.
	o := defaultSynthOpts()
	o.ClusterMs = 8000
	o.VoidBytes = 5000
	o.VideoBytesPerSec = 30 << 10
	repl := mkvtest.BuildSynth(o)
	var curSize atomic.Int64
	curSize.Store(fx.synth.Size())
	fetch := fx.cache.Fetcher(id, fx.fd.Fetch)
	fx.repo.SetDriveSourceFactory(func(context.Context, string) (mkvsubs.Source, error) {
		return drive.NewRangeSource(fetch, curSize.Load()), nil
	})

	fx.fd.SetData(repl.Bytes)
	curSize.Store(repl.Size())
	fx.cache.Validate(id, repl.Size()) // lo que hace el handler cuando ve otro tamaño en Drive

	require.Eventually(t, func() bool {
		st, err := fx.repo.DriveSubtitleWindow(context.Background(), fx.path, 300, false)
		return err == nil && st.CoveredFrom <= 300 && st.CoveredUntil >= 330
	}, 20*time.Second, 50*time.Millisecond, "la sesión tiene que volver a abrir el archivo cuando sus posiciones ya no valen")
}

// ─── (b/e) errores de Drive que no se ven ─────────────────────────────────────────────────

// Un 403 de límite de uso al abrir el archivo no es "este archivo no sirve": antes caía en
// "sin Cues"/"no es Matroska" y mandaba la pista al botón Extraer (bajar todo el archivo).
func TestIntermittentTransientOpenFailureIsNotUnsupported(t *testing.T) {
	old := driveWindowOpenBackoff
	driveWindowOpenBackoff = []time.Duration{time.Millisecond, time.Millisecond}
	oldTTL := driveWindowOpenNegTTL
	driveWindowOpenNegTTL = 0
	t.Cleanup(func() { driveWindowOpenBackoff, driveWindowOpenNegTTL = old, oldTTL })

	fx := newSynthFx(t, defaultSynthOpts(), "synthB1")
	var failing atomic.Bool
	failing.Store(true)
	fx.fd.SetHook(func(ctx context.Context, n int64, rh string) error {
		if failing.Load() {
			return mkvtest.StatusError(http.StatusUnauthorized, "token expired")
		}
		return nil
	})

	info := fx.repo.DriveWindowSupportInfo(context.Background(), fx.path, embeddedSubs())
	require.True(t, info.ReadFailed, "falla de lectura, no archivo no soportado: %+v", info)
	require.Empty(t, info.FileReason)
	require.Equal(t, "auth", info.ErrKind)
	require.Equal(t, http.StatusUnauthorized, info.ErrStatus)

	// La ventana lo informa como estado de error con su motivo, sin romper.
	st, err := fx.repo.DriveSubtitleWindow(context.Background(), fx.path, 0, false)
	require.NoError(t, err)
	require.Equal(t, DriveWindowFailed, st.State)
	require.Equal(t, "auth", st.ErrorKind)
	require.True(t, st.Retrying)
	require.NotEmpty(t, st.ErrorMessage)

	// La pista se pide: 503 con el motivo (reintentable), no 404.
	code, _, h := fx.get(t, "0")
	require.Equal(t, http.StatusServiceUnavailable, code)
	require.Equal(t, "auth", h.Get(HeaderSubsError))

	// Vuelve Drive: el mismo archivo se abre y queda soportado.
	failing.Store(false)
	info = fx.repo.DriveWindowSupportInfo(context.Background(), fx.path, embeddedSubs())
	require.False(t, info.ReadFailed)
	require.Equal(t, map[uint32]bool{0: true, 1: true}, info.Tracks)
}

// Un error de lectura durante la ventana queda en el estado con código y clase, y se cura.
func TestIntermittentWindowErrorIsVisibleAndRecovers(t *testing.T) {
	old := driveWindowRetryAfter
	driveWindowRetryAfter = 50 * time.Millisecond
	t.Cleanup(func() { driveWindowRetryAfter = old })
	fx := newSynthFx(t, defaultSynthOpts(), "synthB2")
	fx.open(t)
	fx.waitCovered(t, 0, 30)
	fx.fd.SetHook(func(ctx context.Context, n int64, rh string) error { return mkvtest.QuotaError() })
	var st DriveWindowStatus
	require.Eventually(t, func() bool { st = fx.window(t, 400); return st.State == DriveWindowFailed }, 20*time.Second, 20*time.Millisecond)
	require.Equal(t, "quota", st.ErrorKind)
	require.Equal(t, http.StatusForbidden, st.ErrorStatus)
	require.True(t, st.Retrying)
	require.NotNil(t, st.Diag)
	require.Positive(t, st.Diag.Failures)
	fx.fd.SetHook(nil)
	fx.waitCovered(t, 400, 30)
}
