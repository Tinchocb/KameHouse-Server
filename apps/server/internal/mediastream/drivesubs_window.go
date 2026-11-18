package mediastream

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/mkvsubs"
	"kamehouse/internal/util"

	"github.com/labstack/echo/v4"
)

// Subtítulos de Drive por ventanas.
//
// Sacar los subtítulos de un MKV con ffmpeg obliga a bajar el archivo entero porque las
// pistas van intercaladas con el video. Acá se lee, en cambio, solo la franja de tiempo
// que el reproductor está por mostrar: se ubica por las Cues del archivo el cluster que
// empieza antes de esa franja y se recorren los siguientes, quedándose únicamente con
// los bloques de subtítulos. Los bytes pasan por la caché de bloques de Drive, la misma
// que usa la reproducción, así que lo leído para reproducir no se vuelve a pedir y lo
// leído por los subtítulos tampoco se pide de nuevo al reproducir.
//
// Coste: lo mismo que reproducir esa franja (más la cabecera y las Cues, que ffprobe ya
// dejó en la caché), no el archivo entero. La extracción completa sigue disponible y es
// el respaldo para lo que acá no se soporta (PGS, archivos sin Cues, otros contenedores).
//
// Orden de lectura tras un salto: primero desde donde está el video hacia adelante (para
// que los subtítulos estén cuanto antes), después hacia atrás hasta el relleno (carteles
// largos que empezaron antes del salto) y, por último, el primer cluster del archivo (donde
// suelen estar los carteles que duran todo el episodio). El lector está en
// drivesubs_window_run.go.

const (
	// driveWindowBackfillMin es el relleno hacia atrás mínimo: un cartel largo de ASS puede
	// haber empezado antes de la posición y seguir en pantalla.
	driveWindowBackfillMin = 60 * time.Second
	// driveWindowBackfillFloor es lo mínimo a lo que baja el relleno aunque el tope de bytes
	// sea chico (un archivo de muy alta tasa de bits).
	driveWindowBackfillFloor = 20 * time.Second
	// driveWindowBackfillMargin se suma al cartel más largo conocido.
	driveWindowBackfillMargin = 5 * time.Second
	// driveWindowBackfillMaxBytes: el relleno adaptativo no pasa de esta cantidad de bytes
	// de archivo (≈ 19 % de un episodio de 1 GB).
	driveWindowBackfillMaxBytes = 192 << 20
	// driveWindowLongEventCap: un evento más largo que esto es un cartel permanente (una
	// marca de agua de todo el episodio) y no manda sobre el relleno: una vez leído, ya se tiene.
	driveWindowLongEventCap = 5 * time.Minute
	// driveWindowLookahead: cuánto después de la posición se mantiene leído. Alcanza
	// para que, aun tras un salto, los subtítulos estén antes que el video.
	driveWindowLookahead = 90 * time.Second
	// driveWindowSeekCancel: un salto de más que esto abandona la lectura en curso.
	driveWindowSeekCancel = 45 * time.Second
	// driveWindowSeedMinPos: desde esta posición se lee, además, el primer cluster.
	driveWindowSeedMinPos = 120 * time.Second

	driveWindowSessionsMax = 4
	driveWindowIdleTTL     = 30 * time.Minute

	driveWindowOpenAttempts = 3
	driveWindowOpenTimeout  = 40 * time.Second

	driveSubsTextDoneMarker = "subs.text.done"
)

// Tiempos que las pruebas acortan.
var (
	// driveWindowReadTimeout: tope de una lectura de cluster (incluye esperar a Drive).
	driveWindowReadTimeout = 60 * time.Second
	// driveWindowRetryAfter: espera mínima entre un fallo y el reintento.
	driveWindowRetryAfter = 5 * time.Second
	// driveWindowStaleAfter: si el reproductor no vuelve a pedir en este tiempo, se deja de leer.
	driveWindowStaleAfter = 30 * time.Second
	// driveWindowHold: cuánto espera la descarga de la pista a que la franja esté leída.
	driveWindowHold = 8 * time.Second
	// driveWindowOpenNegTTL: tras un fallo al abrir, se repite el mismo error sin ir a Drive.
	driveWindowOpenNegTTL = 2 * time.Second
	// driveWindowOpenBackoff: espera entre intentos de apertura.
	driveWindowOpenBackoff = []time.Duration{400 * time.Millisecond, 1200 * time.Millisecond}
)

// DriveSourceFactory abre, para un path gdrive://, la lectura por rangos del archivo
// (con la caché de bloques de la reproducción).
type DriveSourceFactory func(ctx context.Context, drivePath string) (mkvsubs.Source, error)

// DriveWindowState es el estado de la lectura por ventanas de un archivo.
type DriveWindowState string

const (
	DriveWindowLoading  DriveWindowState = "loading"  // leyendo la franja pedida
	DriveWindowReady    DriveWindowState = "ready"    // la franja pedida ya está leída
	DriveWindowComplete DriveWindowState = "complete" // se leyó el archivo entero y quedó en disco
	DriveWindowFailed   DriveWindowState = "error"
)

// DriveWindowStatus es lo que ve el reproductor.
type DriveWindowStatus struct {
	State DriveWindowState `json:"state"`
	// Version sube cada vez que se leen subtítulos nuevos: el reproductor vuelve a
	// pedir la pista cuando cambia.
	Version int64 `json:"version"`
	// CoveredFrom y CoveredUntil: el tramo del video (en segundos) con subtítulos leídos
	// de corrido que contiene la posición pedida. Ambos -1 si la posición todavía no
	// está cubierta.
	CoveredFrom  float64 `json:"coveredFrom"`
	CoveredUntil float64 `json:"coveredUntil"`
	// Percent: parte del archivo ya recorrida (0-100).
	Percent float64 `json:"percent"`
	// Error es el texto técnico de la última falla de lectura; ErrorKind su clase
	// ("quota", "rate", "auth", "notfound", "server", "network", "changed", "format",
	// "other"), ErrorStatus el HTTP de Drive (0 si no hubo) y ErrorMessage el texto corto
	// para el usuario. Retrying dice si el servidor va a volver a intentar solo.
	Error        string `json:"error,omitempty"`
	ErrorKind    string `json:"errorKind,omitempty"`
	ErrorStatus  int    `json:"errorStatus,omitempty"`
	ErrorMessage string `json:"errorMessage,omitempty"`
	Retrying     bool   `json:"retrying,omitempty"`
	// Diag es el detalle para el panel de diagnóstico.
	Diag *DriveWindowDiag `json:"diag,omitempty"`
}

// DriveWindowDiag resume qué hizo la lectura de este archivo (panel de diagnóstico).
type DriveWindowDiag struct {
	PositionSec     float64 `json:"positionSec"`
	FromSec         float64 `json:"fromSec"`
	ToSec           float64 `json:"toSec"`
	BackfillSec     float64 `json:"backfillSec"`
	LongestEventSec float64 `json:"longestEventSec"`
	Clusters        int     `json:"clusters"`
	Reads           int     `json:"reads"`
	AvgReadMs       int64   `json:"avgReadMs"`
	ParsedBytes     int64   `json:"parsedBytes"`
	FileBytes       int64   `json:"fileBytes"`
	Cues            int     `json:"cues"`
	Laced           int     `json:"laced"`
	Dropped         int     `json:"dropped"`
	Failures        int     `json:"failures"`
	Moves           int     `json:"moves"`
	Passes          int     `json:"passes"`
	// Opens cuenta las veces que se (re)abrió el archivo: más de 1 = la sesión se curó.
	Opens           int     `json:"opens"`
	OpenedAgoSec    float64 `json:"openedAgoSec"`
	LastError       string  `json:"lastError,omitempty"`
	LastErrorKind   string  `json:"lastErrorKind,omitempty"`
	LastErrorStatus int     `json:"lastErrorStatus,omitempty"`
	LastErrorAgoSec float64 `json:"lastErrorAgoSec,omitempty"`
	// SlotsBusy: lecturas de ventanas en curso en todo el servidor.
	SlotsBusy int                  `json:"slotsBusy"`
	Tracks    []DriveWindowDiagTrk `json:"tracks"`
}

// DriveWindowDiagTrk es una pista de subtítulos del archivo.
type DriveWindowDiagTrk struct {
	Index     int    `json:"index"`
	Codec     string `json:"codec"`
	Language  string `json:"language,omitempty"`
	Name      string `json:"name,omitempty"`
	Supported bool   `json:"supported"`
	Events    int    `json:"events"`
}

type wCluster struct {
	next    int64 // -1: último cluster
	startMs int64
	span    int64 // bytes del cluster en el archivo
	events  map[uint64][]mkvsubs.Event
}

// windowFailure es la última falla de lectura de la sesión.
type windowFailure struct {
	msg    string
	kind   string
	status int
	at     time.Time
}

type driveWindowSession struct {
	reg  *driveWindowRegistry
	path string
	hash string
	f    *mkvsubs.File
	// tracks[i] es la pista de la pista de subtítulos N-ésima del archivo (`0:s:N`).
	tracks []*mkvsubs.Track
	wanted map[uint64]bool
	opens  int // veces que se abrió este archivo (sube al curar la sesión)

	mu       sync.Mutex
	clusters map[int64]*wCluster
	order    []int64 // offsets de los clusters leídos, ordenados
	version  int64
	posMs    int64 // última posición informada por el reproductor
	fromMs   int64
	toMs     int64
	full     bool
	running  bool
	started  bool // el reproductor ya pidió una franja
	failure  *windowFailure
	complete bool
	lastUsed time.Time
	lastReq  time.Time // último pedido de franja del reproductor
	openedAt time.Time
	cancel   context.CancelFunc
	ctx      context.Context
	parsed   int64 // bytes de clusters ya recorridos

	// Lectura en curso, para abandonarla si el reproductor salta lejos.
	readCancel context.CancelFunc
	readGen    int64
	// Lo aprendido leyendo.
	longestMs    int64 // evento más largo (que no sea permanente) visto hasta ahora
	minClusterMs int64 // duración del cluster más corto visto
	seeded       bool  // ya se leyó el primer cluster
	// titleCards: placa del título ya buscada, por segundo de inicio (drivesubs_titlecard.go).
	titleCards map[int64]DriveTitleCard
	// cuedRead: bloques de subtítulo ya leídos por el índice; direct: la lectura sin caché de bloques.
	cuedRead map[mkvsubs.SubCue][]titleEvent
	direct   mkvsubs.Source
	stats    windowStats
}

type windowStats struct {
	reads    int
	readNs   int64
	laced    int
	dropped  int
	failures int
	moves    int
	passes   int
	events   map[uint64]int
	lastFail *windowFailure
	// Pasada actual (desde que arranca el lector hasta que la franja queda cubierta).
	passStart   time.Time
	passReads   int
	passBytes   int64
	passEvents  int
	passRetried bool
}

type openCall struct {
	done chan struct{}
	s    *driveWindowSession
	err  error
}

type openFailure struct {
	err error
	at  time.Time
}

type driveWindowRegistry struct {
	mu       sync.Mutex
	closed   bool
	factory  DriveSourceFactory
	direct   DriveSourceFactory // lectura sin caché de bloques (drivesubs_titlecard.go)
	sessions map[string]*driveWindowSession
	opening  map[string]*openCall
	failed   map[string]openFailure
	// heals registra cuándo se descartó una sesión por tener un índice que ya no vale.
	heals map[string][]time.Time
	// opens cuenta las aperturas por archivo (para el diagnóstico).
	opens map[string]int
}

// Stop admission and cancel sessions before the repository joins owned workers.
// Never wait for network I/O while holding the registry or session mutexes.
func (r *Repository) shutdownDriveWindows() {
	g := &r.driveWin
	g.mu.Lock()
	g.closed = true
	for _, s := range g.sessions {
		s.cancel()
	}
	g.sessions = nil
	g.failed = nil
	g.mu.Unlock()
}

// driveWindowSlots limita cuántas lecturas de clusters corren a la vez en todo el
// servidor (cada una puede mover megas de Drive). Hay un cupo por sesión posible: antes
// eran 2, y dos episodios con Drive colgado (cada lectura espera hasta driveWindowReadTimeout)
// dejaban sin lectura a un tercero, que aparecía como "sin subtítulos". Una sesión nueva
// descarta a la más vieja al llegar al máximo, así que nunca hay más lectores que cupos.
var driveWindowSlots = make(chan struct{}, driveWindowSessionsMax)

// SetDriveSourceFactory registra cómo se lee un archivo de Drive. Sin esto no hay
// lectura por ventanas y todo sigue por la extracción completa.
func (r *Repository) SetDriveSourceFactory(f DriveSourceFactory) {
	r.driveWin.mu.Lock()
	r.driveWin.factory = f
	r.driveWin.mu.Unlock()
}

// session devuelve (abriéndola si hace falta) la sesión del archivo. Abrir lee la
// cabecera y las Cues y deja las fuentes embebidas en la caché de adjuntos. Los errores
// son un *DriveWindowUnavailableError (el archivo no sirve para esto, definitivo) o un
// *DriveReadError (no se pudo leer ahora, pasajero).
func (r *Repository) driveWindowSession(ctx context.Context, drivePath string) (*driveWindowSession, error) {
	g := &r.driveWin
	hash := r.driveSubtitleHash(drivePath)
	for {
		if err := ctx.Err(); err != nil {
			return nil, newReadError(err)
		}
		g.mu.Lock()
		if g.closed {
			g.mu.Unlock()
			return nil, newReadError(context.Canceled)
		}
		if s := g.sessions[hash]; s != nil {
			g.mu.Unlock()
			s.touch()
			return s, nil
		}
		if f, ok := g.failed[hash]; ok && time.Since(f.at) < driveWindowOpenNegTTL {
			g.mu.Unlock()
			return nil, f.err
		}
		if call := g.opening[hash]; call != nil {
			g.mu.Unlock()
			select {
			case <-call.done:
			case <-ctx.Done():
				return nil, newReadError(ctx.Err())
			}
			if call.err != nil && errors.Is(call.err, context.Canceled) && ctx.Err() == nil {
				continue // el que abría se fue: se vuelve a intentar con este pedido
			}
			return call.s, call.err
		}
		call := &openCall{done: make(chan struct{})}
		if g.opening == nil {
			g.opening = map[string]*openCall{}
		}
		g.opening[hash] = call

		// The open belongs to all clients, but each caller may leave its wait.
		// Keep its own deadline rather than inheriting the first HTTP request.
		admitted := r.startWork(func(parentCtx context.Context) {
			var session *driveWindowSession
			var openErr error
			defer func() {
				if v := recover(); v != nil {
					openErr = newReadError(fmt.Errorf("Drive window open panic: %v", v))
				}
				g.mu.Lock()
				delete(g.opening, hash)
				if g.closed {
					if session != nil {
						session.cancel()
					}
					session = nil
					openErr = newReadError(context.Canceled)
				}
				if openErr == nil {
					if g.sessions == nil {
						g.sessions = map[string]*driveWindowSession{}
					}
					g.evictLocked()
					g.sessions[hash] = session
					delete(g.failed, hash)
				} else if !g.closed && errors.Is(openErr, ErrDriveWindowReadFailed) {
					if g.failed == nil {
						g.failed = map[string]openFailure{}
					}
					g.failed[hash] = openFailure{err: openErr, at: time.Now()}
				}
				g.mu.Unlock()
				call.s, call.err = session, openErr
				close(call.done)
			}()
			octx, cancel := context.WithTimeout(parentCtx, driveWindowOpenTimeout)
			defer cancel()
			session, openErr = r.openDriveWindowSession(octx, drivePath, hash)
		})
		if !admitted {
			delete(g.opening, hash)
			call.err = newReadError(context.Canceled)
			close(call.done)
		}
		g.mu.Unlock()
		select {
		case <-ctx.Done():
			return nil, newReadError(ctx.Err())
		case <-call.done:
			return call.s, call.err
		}
	}
}

// openDriveWindowSession abre el archivo: reintenta las fallas pasajeras de lectura (Drive
// limitó, un corte de red) antes de darse por vencido, y distingue "este archivo no sirve
// para esto" de "no se pudo leer ahora".
func (r *Repository) openDriveWindowSession(ctx context.Context, drivePath, hash string) (*driveWindowSession, error) {
	g := &r.driveWin
	g.mu.Lock()
	factory := g.factory
	broken := len(g.heals[hash]) >= 3
	opens := g.opens[hash] + 1
	g.mu.Unlock()
	cacheDir := r.CacheDir()
	if factory == nil || cacheDir == "" {
		return nil, unavailable(WindowReasonNotConfigured, nil)
	}
	if broken {
		return nil, unavailable(WindowReasonBroken, nil)
	}

	started := time.Now()
	var (
		f       *mkvsubs.File
		lastErr error
	)
	for attempt := 0; attempt < driveWindowOpenAttempts; attempt++ {
		if attempt > 0 {
			wait := driveWindowOpenBackoff[min(attempt-1, len(driveWindowOpenBackoff)-1)]
			select {
			case <-time.After(wait):
			case <-ctx.Done():
				return nil, newReadError(ctx.Err())
			}
		}
		src, err := factory(ctx, drivePath)
		if err == nil {
			f, err = mkvsubs.Open(ctx, src, mkvsubs.Options{ChunkSize: 256 << 10})
		}
		if err == nil {
			lastErr = nil
			break
		}
		lastErr = err
		switch {
		case errors.Is(err, mkvsubs.ErrNotMatroska):
			return nil, unavailable(WindowReasonNotMatroska, err)
		case errors.Is(err, mkvsubs.ErrNoTracks):
			return nil, unavailable(WindowReasonNoTracks, err)
		case errors.Is(err, mkvsubs.ErrMalformed), errors.Is(err, mkvsubs.ErrNotCluster):
			return nil, unavailable(WindowReasonNotMatroska, err)
		}
		kind, status := classifyReadError(err)
		r.logger.Debug().Err(err).Str("hash", hash).Str("kind", kind).Int("status", status).Int("attempt", attempt+1).
			Msg("mediastream: Drive subtitle window could not open the file")
		if !kindRetryable(kind) {
			break
		}
	}
	if lastErr != nil {
		re := newReadError(lastErr)
		r.logger.Warn().Err(lastErr).Str("hash", hash).Str("file", driveLogName(drivePath)).Str("kind", re.Kind).Int("status", re.Status).
			Msg("mediastream: Drive subtitle window could not open the file (not reported as unsupported: it is retried)")
		return nil, re
	}
	if !f.HasCues() {
		return nil, unavailable(WindowReasonNoCues, nil)
	}

	s := &driveWindowSession{
		reg:          g,
		path:         drivePath,
		hash:         hash,
		f:            f,
		tracks:       f.SubtitleTracks(),
		wanted:       map[uint64]bool{},
		clusters:     map[int64]*wCluster{},
		lastUsed:     time.Now(),
		openedAt:     time.Now(),
		opens:        opens,
		minClusterMs: 2000,
		stats:        windowStats{events: map[uint64]int{}},
	}
	supported := 0
	for _, t := range s.tracks {
		if t.Format() != mkvsubs.FormatUnknown {
			s.wanted[t.Number] = true
			supported++
		}
	}
	if supported == 0 {
		return nil, unavailable(WindowReasonNoTextTracks, nil)
	}
	if err := writeDriveAttachments(ctx, f, videofile.GetFileAttCacheDir(cacheDir, hash)); err != nil {
		r.logger.Warn().Err(err).Str("hash", hash).Msg("mediastream: could not extract Drive attachments")
	}
	if err := ctx.Err(); err != nil {
		return nil, newReadError(err)
	}
	s.ctx, s.cancel = context.WithCancel(r.workContext())

	g.mu.Lock()
	if g.closed {
		g.mu.Unlock()
		s.cancel()
		return nil, newReadError(context.Canceled)
	}
	if g.opens == nil {
		g.opens = map[string]int{}
	}
	g.opens[hash] = opens
	g.mu.Unlock()

	r.logger.Info().
		Str("hash", hash).Str("file", driveLogName(drivePath)).
		Int64("size", f.Size()).Int64("durationMs", f.DurationMs()).Int("cues", f.CueCount()).
		Int("attachments", len(f.Attachments())).Int("opens", opens).Dur("took", time.Since(started)).
		Str("tracks", describeTracks(s.tracks, s.wanted)).
		Msg("mediastream: Drive subtitle window opened")
	return s, nil
}

func driveLogName(drivePath string) string {
	p := strings.TrimPrefix(drivePath, "gdrive://")
	if i := strings.LastIndexByte(p, '/'); i >= 0 {
		return p[i+1:]
	}
	return p
}

func describeTracks(tracks []*mkvsubs.Track, wanted map[uint64]bool) string {
	var parts []string
	for i, t := range tracks {
		state := "skip"
		if wanted[t.Number] {
			state = "text"
		}
		lang := t.Language
		if lang == "" {
			lang = "und"
		}
		parts = append(parts, fmt.Sprintf("%d=%s/%s/%s", i, t.CodecID, lang, state))
	}
	return strings.Join(parts, " ")
}

// evictLocked descarta sesiones viejas para no acumular memoria.
func (g *driveWindowRegistry) evictLocked() {
	now := time.Now()
	for h, s := range g.sessions {
		s.mu.Lock()
		idle := !s.running && now.Sub(s.lastUsed) > driveWindowIdleTTL
		s.mu.Unlock()
		if idle {
			s.cancel()
			delete(g.sessions, h)
		}
	}
	for len(g.sessions) >= driveWindowSessionsMax {
		var oldest *driveWindowSession
		for _, s := range g.sessions {
			if oldest == nil || s.lastUsedTime().Before(oldest.lastUsedTime()) {
				oldest = s
			}
		}
		oldest.cancel()
		delete(g.sessions, oldest.hash)
	}
}

// drop descarta la sesión (si sigue registrada): el próximo pedido vuelve a abrir el
// archivo y lee de nuevo las Cues. Cuenta los descartes para no entrar en un ciclo.
func (g *driveWindowRegistry) drop(s *driveWindowSession) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.sessions[s.hash] == s {
		delete(g.sessions, s.hash)
	}
	s.cancel()
	if g.heals == nil {
		g.heals = map[string][]time.Time{}
	}
	cut := time.Now().Add(-2 * time.Minute)
	kept := g.heals[s.hash][:0]
	for _, t := range g.heals[s.hash] {
		if t.After(cut) {
			kept = append(kept, t)
		}
	}
	g.heals[s.hash] = append(kept, time.Now())
}

func (s *driveWindowSession) lastUsedTime() time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.lastUsed
}

func (s *driveWindowSession) touch() {
	s.mu.Lock()
	s.lastUsed = time.Now()
	s.mu.Unlock()
}

// writeDriveAttachments deja las fuentes del archivo donde las sirve /att.
func writeDriveAttachments(ctx context.Context, f *mkvsubs.File, dir string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	atts := f.Attachments()
	if len(atts) == 0 {
		return nil
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	var errs []error
	for i, a := range atts {
		if err := ctx.Err(); err != nil {
			return err
		}
		name := filepath.Base(filepath.Clean(a.Name))
		if name == "" || name == "." || name == ".." || name == string(filepath.Separator) {
			name = fmt.Sprintf("font_%d.ttf", i)
		}
		dest := filepath.Join(dir, name)
		if st, err := os.Stat(dest); err == nil && st.Size() == a.Size() {
			continue
		}
		data, err := f.ReadAttachment(ctx, a)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := util.WriteFileAtomic(dest, data); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

// supportsTrack indica si la N-ésima pista de subtítulos se puede leer por ventanas,
// y coincide con lo que ffprobe dijo de ella. Si no, devuelve el motivo.
func (s *driveWindowSession) supportsTrack(sub videofile.Subtitle) (bool, string) {
	if sub.IsImageBased {
		return false, WindowReasonImage
	}
	if sub.Extension == nil || int(sub.Index) >= len(s.tracks) {
		return false, WindowReasonTrackMissing
	}
	t := s.tracks[sub.Index]
	switch t.Format() {
	case mkvsubs.FormatSRT:
		if *sub.Extension == "srt" {
			return true, ""
		}
	case mkvsubs.FormatASS:
		if *sub.Extension == "ass" || *sub.Extension == "ssa" {
			return true, ""
		}
	}
	return false, WindowReasonCodec
}

// DriveWindowSupportInfo dice qué se puede leer por ventanas de un archivo y, si no, por qué.
type DriveWindowSupportInfo struct {
	// Tracks: por índice de subtítulo (el de ffprobe), las pistas que se pueden leer.
	Tracks map[uint32]bool
	// Reasons: el motivo de cada pista que no se puede.
	Reasons map[uint32]string
	// FileReason: por qué no sirve el archivo entero ("" si sirve). Es definitivo.
	FileReason string
	// ReadFailed: no se pudo abrir ahora por un problema de lectura (Drive, red). Es
	// pasajero: no dice nada sobre si el archivo sirve.
	ReadFailed bool
	ErrKind    string
}

// DriveWindowSupportInfo abre la sesión si hace falta y lo informa. Nunca confunde una
// falla pasajera de Drive con un archivo que no sirve.
func (r *Repository) DriveWindowSupportInfo(ctx context.Context, drivePath string, embedded []videofile.Subtitle) DriveWindowSupportInfo {
	info := DriveWindowSupportInfo{Tracks: map[uint32]bool{}, Reasons: map[uint32]string{}}
	s, err := r.driveWindowSession(ctx, drivePath)
	if err != nil {
		var re *DriveReadError
		if errors.As(err, &re) {
			info.ReadFailed, info.ErrKind = true, re.Kind
			return info
		}
		info.FileReason = WindowUnavailableReason(err)
		if info.FileReason == "" {
			info.FileReason = WindowReasonNotMatroska
		}
		r.logger.Debug().Err(err).Str("path", drivePath).Msg("mediastream: Drive window subtitles unavailable")
		return info
	}
	for _, sub := range embedded {
		if ok, why := s.supportsTrack(sub); ok {
			info.Tracks[sub.Index] = true
		} else {
			info.Reasons[sub.Index] = why
		}
	}
	return info
}

// DriveSubtitleWindow pide que estén leídos los subtítulos alrededor de `posSec` (o
// todo el archivo si full) y devuelve el estado. Es idempotente y barato: el
// reproductor lo llama cada pocos segundos con su posición. Un error que satisface
// errors.Is(err, ErrDriveWindowUnavailable) es definitivo; una falla pasajera de lectura
// se informa en el estado (State "error") y no como error.
func (r *Repository) DriveSubtitleWindow(ctx context.Context, drivePath string, posSec float64, full bool) (DriveWindowStatus, error) {
	s, err := r.driveWindowSession(ctx, drivePath)
	if err != nil {
		var re *DriveReadError
		if errors.As(err, &re) {
			return DriveWindowStatus{
				State: DriveWindowFailed, CoveredFrom: -1, CoveredUntil: -1,
				Error: truncate(re.Error(), 300), ErrorKind: re.Kind, ErrorStatus: re.Status,
				ErrorMessage: ReadFailureMessage(re.Kind, re.Status), Retrying: true,
			}, nil
		}
		return DriveWindowStatus{}, err
	}
	return s.request(r, posSec, full), nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func (s *driveWindowSession) request(r *Repository, posSec float64, full bool) DriveWindowStatus {
	posMs := int64(math.Max(posSec, 0) * 1000)
	s.mu.Lock()
	now := time.Now()
	s.lastUsed, s.lastReq = now, now
	moved := s.started && absInt64(posMs-s.posMs) > driveWindowSeekCancel.Milliseconds()
	if moved {
		s.stats.moves++
		s.readGen++
		if s.readCancel != nil {
			s.readCancel() // lo que se está leyendo ya no sirve: se pasa a la franja nueva
		}
	}
	wasPos := s.posMs
	s.started = true
	s.posMs = posMs
	s.toMs = posMs + driveWindowLookahead.Milliseconds()
	s.fromMs = max(posMs-s.backfillLocked(), 0)
	s.full = s.full || full
	retry := s.failure == nil || time.Since(s.failure.at) > driveWindowRetryAfter
	needsWork := !s.running && !s.complete && retry && s.nextOffsetLocked() >= 0
	if needsWork {
		s.running = true
		s.stats.passStart = now
		s.stats.passReads, s.stats.passBytes, s.stats.passEvents = 0, 0, 0
		s.stats.passRetried = s.failure != nil
	}
	s.mu.Unlock()
	if moved {
		r.logger.Info().Str("hash", s.hash).Str("file", driveLogName(s.path)).
			Float64("fromSec", float64(wasPos)/1000).Float64("toSec", float64(posMs)/1000).
			Msg("mediastream: Drive subtitle window moved (seek)")
	}
	if needsWork {
		if !r.startWork(func(context.Context) { s.run(r) }) {
			s.cancel()
			s.mu.Lock()
			s.running = false
			s.recordFailureLocked(context.Canceled)
			s.mu.Unlock()
		}
	}
	return s.status(posMs)
}

func absInt64(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}

func (s *driveWindowSession) status(posMs int64) DriveWindowStatus {
	s.mu.Lock()
	defer s.mu.Unlock()
	st := DriveWindowStatus{Version: s.version, CoveredFrom: -1, CoveredUntil: -1}
	if from, until := s.coveredRunLocked(posMs); until >= 0 {
		st.CoveredFrom = float64(from) / 1000
		st.CoveredUntil = float64(until) / 1000
	}
	if size := s.f.Size(); size > 0 {
		st.Percent = math.Min(float64(s.parsed)/float64(size)*100, 100)
	}
	switch {
	case s.complete:
		st.State = DriveWindowComplete
		st.Percent = 100
	case s.failure != nil:
		st.State = DriveWindowFailed
		st.Error = truncate(s.failure.msg, 300)
		st.ErrorKind = s.failure.kind
		st.ErrorStatus = s.failure.status
		st.ErrorMessage = ReadFailureMessage(s.failure.kind, s.failure.status)
		st.Retrying = kindRetryable(s.failure.kind) || healKind(s.failure.kind)
	case s.running:
		st.State = DriveWindowLoading
	default:
		st.State = DriveWindowReady
	}
	st.Diag = s.diagLocked()
	return st
}

func (s *driveWindowSession) diagLocked() *DriveWindowDiag {
	d := &DriveWindowDiag{
		PositionSec:     float64(s.posMs) / 1000,
		FromSec:         float64(s.fromMs) / 1000,
		ToSec:           float64(s.toMs) / 1000,
		BackfillSec:     float64(s.backfillLocked()) / 1000,
		LongestEventSec: float64(s.longestMs) / 1000,
		Clusters:        len(s.clusters),
		Reads:           s.stats.reads,
		ParsedBytes:     s.parsed,
		FileBytes:       s.f.Size(),
		Cues:            s.f.CueCount(),
		Laced:           s.stats.laced,
		Dropped:         s.stats.dropped,
		Failures:        s.stats.failures,
		Moves:           s.stats.moves,
		Passes:          s.stats.passes,
		Opens:           s.opens,
		OpenedAgoSec:    time.Since(s.openedAt).Seconds(),
		SlotsBusy:       len(driveWindowSlots),
	}
	if s.stats.reads > 0 {
		d.AvgReadMs = s.stats.readNs / int64(s.stats.reads) / int64(time.Millisecond)
	}
	if lf := s.stats.lastFail; lf != nil {
		d.LastError, d.LastErrorKind, d.LastErrorStatus = truncate(lf.msg, 300), lf.kind, lf.status
		d.LastErrorAgoSec = time.Since(lf.at).Seconds()
	}
	for i, t := range s.tracks {
		d.Tracks = append(d.Tracks, DriveWindowDiagTrk{
			Index: i, Codec: t.CodecID, Language: t.Language, Name: t.Name,
			Supported: s.wanted[t.Number], Events: s.stats.events[t.Number],
		})
	}
	return d
}

// render arma la pista N con lo leído hasta ahora. ok=false si la pista no es de texto
// soportado.
func (s *driveWindowSession) render(trackIndex int) (data []byte, events int, ok bool) {
	if trackIndex < 0 || trackIndex >= len(s.tracks) {
		return nil, 0, false
	}
	t := s.tracks[trackIndex]
	if !s.wanted[t.Number] {
		return nil, 0, false
	}
	s.mu.Lock()
	var evs []mkvsubs.Event
	for _, off := range s.order {
		evs = append(evs, s.clusters[off].events[t.Number]...)
	}
	s.mu.Unlock()
	if len(evs) == 0 && t.Format() == mkvsubs.FormatSRT {
		// Un SRT sin eventos aún es un archivo vacío, que el reproductor toma por
		// error: un evento de 1 ms con un espacio no se ve y lo hace válido.
		return []byte("1\n00:00:00,000 --> 00:00:00,001\n \n\n"), 0, true
	}
	return mkvsubs.Render(t, evs), len(evs), true
}

// finalize deja en disco, con el mismo formato que la extracción con ffmpeg, las pistas
// de texto de un archivo leído entero: así sobreviven a un reinicio y se sirven como
// cualquier pista extraída.
func (s *driveWindowSession) finalize(r *Repository) error {
	if err := s.ctx.Err(); err != nil {
		return err
	}
	cacheDir := r.CacheDir()
	if cacheDir == "" {
		return errors.New("module not initialized")
	}
	dir := videofile.GetFileSubsCacheDir(cacheDir, s.hash)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	allText := true
	for i, t := range s.tracks {
		if err := s.ctx.Err(); err != nil {
			return err
		}
		if !s.wanted[t.Number] {
			if t.Type == mkvsubs.TrackSubtitle {
				allText = false
			}
			continue
		}
		data, _, _ := s.render(i)
		ext := "srt"
		if t.Format() == mkvsubs.FormatASS {
			ext = "ass"
		}
		if err := util.WriteFileAtomic(filepath.Join(dir, strconv.Itoa(i)+"."+ext), data); err != nil {
			r.logger.Warn().Err(err).Str("hash", s.hash).Msg("mediastream: could not persist Drive subtitles")
			return err
		}
	}
	stamp := []byte(time.Now().UTC().Format(time.RFC3339))
	if err := r.commitDriveSubtitleMarker(s.ctx, filepath.Join(cacheDir, "videofiles", s.hash, driveSubsTextDoneMarker), stamp); err != nil {
		return err
	}
	if allText {
		if err := videofile.CommitWindowAttachments(cacheDir, s.hash); err != nil {
			r.logger.Warn().Err(err).Str("hash", s.hash).Msg("mediastream: could not commit Drive subtitles")
			return err
		}
		if err := r.commitDriveSubtitleMarker(s.ctx, driveSubsDonePath(cacheDir, s.hash), stamp); err != nil {
			return err
		}
	}
	return nil
}

// Cabeceras con las que el servidor le dice al reproductor qué trae la pista que sirve.
const (
	// HeaderSubsVersion: la versión de lectura (DriveWindowStatus.Version) que incluye la pista.
	HeaderSubsVersion = "X-KH-Subs-Version"
	// HeaderSubsCovered: "<desde>-<hasta>" en segundos del tramo cubierto de la posición.
	HeaderSubsCovered = "X-KH-Subs-Covered"
	// HeaderSubsError: la clase de la falla ("quota", "rate"...) o "unsupported:<motivo>".
	HeaderSubsError = "X-KH-Subs-Error"
	// HeaderSubsErrorStatus: el HTTP de Drive de esa falla.
	HeaderSubsErrorStatus = "X-KH-Subs-Error-Status"
)

// serveDriveWindowSubtitle sirve una pista embebida de Drive desde la lectura por
// ventanas. handled=false si este archivo no la soporta (sigue el flujo de siempre).
func (r *Repository) serveDriveWindowSubtitle(c echo.Context, drivePath string) (handled bool, err error) {
	idx, convErr := strconv.Atoi(c.QueryParam("trackIndex"))
	if convErr != nil || idx < 0 {
		return false, nil
	}
	cacheDir := r.CacheDir()
	if cacheDir == "" {
		return false, nil
	}
	hash := r.driveSubtitleHash(drivePath)

	// Ya completa y en disco (por ejemplo, tras un reinicio).
	if _, statErr := os.Stat(filepath.Join(cacheDir, "videofiles", hash, driveSubsTextDoneMarker)); statErr == nil {
		dir := videofile.GetFileSubsCacheDir(cacheDir, hash)
		prefix := strconv.Itoa(idx) + "."
		if entries, rerr := os.ReadDir(dir); rerr == nil {
			for _, e := range entries {
				if !e.IsDir() && strings.HasPrefix(e.Name(), prefix) {
					return true, c.File(filepath.Join(dir, e.Name()))
				}
			}
		}
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 45*time.Second)
	defer cancel()
	s, serr := r.driveWindowSession(ctx, drivePath)
	if serr != nil {
		if WindowUnavailableReason(serr) == WindowReasonNotConfigured {
			return false, nil // sin fuente de Drive registrada: sigue el flujo de siempre
		}
		return true, r.subtitleOpenError(c, serr)
	}
	if !s.wanted[s.trackAt(idx)] {
		return false, nil
	}
	// El reproductor dice dónde está con POST /drive/subtitles/window. La `t` de la URL es
	// la posición de arranque: solo sirve mientras nadie dijo nada mejor (si no, cada
	// recarga de la pista devolvería la franja al segundo en que se empezó a ver).
	s.mu.Lock()
	started := s.started
	s.mu.Unlock()
	if !started {
		pos, perr := strconv.ParseFloat(c.QueryParam("t"), 64)
		if perr != nil {
			pos = 0
		}
		s.request(r, pos, false)
	} else {
		s.touch()
	}

	// Se espera (poco) a que la franja esté leída: devolver ya lo que haya, aunque sea de
	// otro tramo, hace que el reproductor arme la pista con casi nada y la pida de nuevo.
	s.holdUntilCovered(ctx)

	data, n, ok := s.render(idx)
	if !ok {
		return false, nil
	}
	s.mu.Lock()
	busy := s.running
	failure := s.failure
	version := s.version
	from, until := s.coveredRunLocked(s.posMs)
	s.mu.Unlock()
	h := c.Response().Header()
	if n == 0 && failure != nil {
		h.Set("Retry-After", "5")
		h.Set(HeaderSubsError, failure.kind)
		h.Set(HeaderSubsErrorStatus, strconv.Itoa(failure.status))
		return true, echo.NewHTTPError(http.StatusServiceUnavailable, ReadFailureMessage(failure.kind, failure.status))
	}
	if n == 0 && busy {
		h.Set("Retry-After", "2")
		return true, echo.NewHTTPError(http.StatusServiceUnavailable, "subtitle extraction in progress")
	}
	h.Set("Cache-Control", "no-store")
	h.Set(HeaderSubsVersion, strconv.FormatInt(version, 10))
	if until >= 0 {
		h.Set(HeaderSubsCovered, fmt.Sprintf("%.1f-%.1f", float64(from)/1000, float64(until)/1000))
	}
	if failure != nil {
		h.Set(HeaderSubsError, failure.kind)
		h.Set(HeaderSubsErrorStatus, strconv.Itoa(failure.status))
	}
	return true, c.Blob(http.StatusOK, "text/plain; charset=utf-8", data)
}

// subtitleOpenError responde cuando no se pudo abrir el archivo para servir la pista.
func (r *Repository) subtitleOpenError(c echo.Context, err error) error {
	h := c.Response().Header()
	var re *DriveReadError
	if errors.As(err, &re) {
		h.Set("Retry-After", "5")
		h.Set(HeaderSubsError, re.Kind)
		h.Set(HeaderSubsErrorStatus, strconv.Itoa(re.Status))
		return echo.NewHTTPError(http.StatusServiceUnavailable, ReadFailureMessage(re.Kind, re.Status))
	}
	reason := WindowUnavailableReason(err)
	if reason == "" {
		reason = WindowReasonNotMatroska
	}
	h.Set(HeaderSubsError, "unsupported:"+reason)
	return echo.NewHTTPError(http.StatusNotImplemented, "windowed subtitles not available for this file: "+reason)
}

// holdUntilCovered espera hasta driveWindowHold a que la posición del reproductor tenga
// subtítulos leídos con un poco de margen por delante (o a que haya fallado o terminado).
func (s *driveWindowSession) holdUntilCovered(ctx context.Context) {
	deadline := time.Now().Add(driveWindowHold)
	for {
		s.mu.Lock()
		pos := s.posMs
		_, until := s.coveredRunLocked(pos)
		done := s.complete || s.failure != nil || !s.running || until >= pos+20_000
		s.mu.Unlock()
		if done || time.Now().After(deadline) || ctx.Err() != nil {
			return
		}
		select {
		case <-time.After(40 * time.Millisecond):
		case <-ctx.Done():
			return
		}
	}
}

// trackAt: número de pista Matroska de la N-ésima pista de subtítulos (0 si no existe).
func (s *driveWindowSession) trackAt(i int) uint64 {
	if i < 0 || i >= len(s.tracks) {
		return 0
	}
	return s.tracks[i].Number
}

// ensureDriveAttachments abre la sesión del archivo (si se puede) para que sus
// fuentes embebidas estén en la caché de adjuntos antes de servirlas.
func (r *Repository) ensureDriveAttachments(ctx context.Context, drivePath string) bool {
	_, err := r.driveWindowSession(ctx, drivePath)
	return err == nil
}
