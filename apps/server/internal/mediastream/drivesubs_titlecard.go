package mediastream

import (
	"context"
	"math"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"

	"kamehouse/internal/mkvsubs"
)

// Placa del título de un episodio de Drive.
//
// Muchos episodios abren con opening → resumen del anterior → placa con el título → episodio.
// Sin capítulos en el archivo ni datos de AniSkip nadie dice dónde termina el resumen, pero
// los subtítulos sí marcan la placa: en ASS con un estilo propio ("Titulos", "Title"...) y,
// cuando el ASS no la subtitula, en SRT escrita toda en mayúsculas. El reproductor usa ese
// instante como fin del resumen.
//
// Lectura: si el índice del archivo lista los bloques de subtítulo (mkvmerge lo hace), se
// piden solo esos bloques, directo a Drive: unos KB en vez del tramo de video. Si no, se
// recorren los clusters del tramo, con la misma caché de bloques que la reproducción. En
// ningún caso se toca la franja que sigue al reproductor.

const (
	// driveTitleCardScan es cuánto se busca, como mucho, después de `from`.
	driveTitleCardScan = 4 * time.Minute
	// driveTitleCardParallel: bloques de subtítulo que se piden a la vez por el índice.
	driveTitleCardParallel = 12
	// driveTitleCardChunk: cada cuántos bloques se mira si la placa ya apareció.
	driveTitleCardChunk = 24
	// Un título en mayúsculas tiene al menos estas letras y palabras ("¡GOKU VUELVE!").
	capsTitleMinLetters = 8
	capsTitleMinWords   = 2
	// songSpanGapMs: líneas de canción a menos de esto son de la misma canción.
	songSpanGapMs = 120_000
)

var (
	// titleStyleRe: estilos de la placa del título.
	titleStyleRe = regexp.MustCompile(`(?i)^\s*(t[ií]tulos?|titles?|(ep|episode|episodio|cap[ií]tulo)[ _-]?(title|t[ií]tulo)|cartel[ _-]+(del[ _-]+)?t[ií]tulo|title[ _-]?card)([^\pL]|$)`)
	// songStyleRe: estilos de las canciones de opening y ending.
	songStyleRe = regexp.MustCompile(`(?i)(^|[^\pL])(op|ed|opening|ending|kara|karaoke|song|insert)([^\pL]|$)`)
	assTagRe    = regexp.MustCompile(`\{[^}]*\}`)
	srtTagRe    = regexp.MustCompile(`<[^>]*>`)
)

// DriveTitleCard es lo que se encontró al comienzo del episodio.
type DriveTitleCard struct {
	// TitleStart: segundo en que aparece la placa del título; -1 si no se encontró.
	TitleStart float64 `json:"titleStart"`
	// SongEnd: segundo en que termina la última línea de canción anterior a la placa
	// (el fin del opening según los subtítulos); 0 si no hay ninguna en el tramo leído.
	SongEnd float64 `json:"songEnd"`
}

// titleEvent es una línea de subtítulo reducida a lo que importa para hallar la placa.
type titleEvent struct {
	startMs, endMs int64
	ass            bool
	style, text    string
}

// assEventFields devuelve el estilo y el texto (sin etiquetas) de un evento ASS tal como
// va en un bloque de Matroska: "ReadOrder,Layer,Style,Name,MarginL,MarginR,MarginV,Effect,Text".
func assEventFields(data []byte) (style, text string) {
	parts := strings.SplitN(string(data), ",", 9)
	if len(parts) < 9 {
		return "", ""
	}
	return strings.TrimSpace(parts[2]), strings.TrimSpace(assTagRe.ReplaceAllString(parts[8], ""))
}

func newTitleEvent(t *mkvsubs.Track, ev mkvsubs.Event) titleEvent {
	te := titleEvent{startMs: ev.StartMs, endMs: ev.EndMs}
	if t.Format() == mkvsubs.FormatASS {
		te.ass = true
		te.style, te.text = assEventFields(ev.Data)
	} else {
		te.text = strings.TrimSpace(srtTagRe.ReplaceAllString(string(ev.Data), ""))
	}
	return te
}

// isCapsTitle: una línea escrita toda en mayúsculas, con largo de título.
func isCapsTitle(text string) bool {
	letters := 0
	for _, r := range text {
		if unicode.IsLetter(r) {
			if !unicode.IsUpper(r) {
				return false
			}
			letters++
		}
	}
	return letters >= capsTitleMinLetters && len(strings.Fields(text)) >= capsTitleMinWords
}

// assTitleMs es el instante del primer evento ASS con estilo de título en [fromMs, limitMs]; -1 si no hay.
func assTitleMs(events []titleEvent, fromMs, limitMs int64) int64 {
	title := int64(-1)
	for _, e := range events {
		if e.ass && e.text != "" && e.startMs >= fromMs && e.startMs <= limitMs && titleStyleRe.MatchString(e.style) &&
			(title < 0 || e.startMs < title) {
			title = e.startMs
		}
	}
	return title
}

// pickTitleCard decide la placa con los eventos leídos de [fromMs, limitMs].
//
// Manda el estilo de título del ASS. Sin él vale una línea en mayúsculas de un SRT, pero
// solo si se sabe dónde terminó el opening (fromMs, o un karaoke del ASS que terminó antes)
// y fuera de las canciones: la letra también suele ir en mayúsculas ("CHA-LA HEAD-CHA-LA"),
// y por eso tampoco cuenta una línea que se repite.
func pickTitleCard(events []titleEvent, fromMs, limitMs int64) DriveTitleCard {
	out := DriveTitleCard{TitleStart: -1}
	var songs []titleEvent
	for _, e := range events {
		if e.ass && songStyleRe.MatchString(e.style) && !titleStyleRe.MatchString(e.style) {
			songs = append(songs, e)
		}
	}

	// Una canción es un tramo: sus líneas, juntando las que distan menos de songSpanGapMs
	// (las pausas instrumentales). Así una línea suelta en medio también queda adentro.
	sort.SliceStable(songs, func(i, j int) bool { return songs[i].startMs < songs[j].startMs })
	var spans [][2]int64
	for _, sg := range songs {
		if n := len(spans); n > 0 && sg.startMs-spans[n-1][1] <= songSpanGapMs {
			spans[n-1][1] = max(spans[n-1][1], sg.endMs)
			continue
		}
		spans = append(spans, [2]int64{sg.startMs, sg.endMs})
	}

	title := assTitleMs(events, fromMs, limitMs)
	if title < 0 {
		seen := map[string]int{}
		for _, e := range events {
			if !e.ass && isCapsTitle(e.text) {
				seen[e.text]++
			}
		}
		for _, e := range events {
			if e.ass || e.startMs < fromMs || e.startMs > limitMs || !isCapsTitle(e.text) || seen[e.text] != 1 {
				continue
			}
			afterOpening, inSong := fromMs > 0, false
			for _, sp := range spans {
				if sp[1] <= e.startMs {
					afterOpening = true
				}
				if e.startMs >= sp[0]-1000 && e.startMs <= sp[1]+1000 {
					inSong = true
				}
			}
			if afterOpening && !inSong && (title < 0 || e.startMs < title) {
				title = e.startMs
			}
		}
	}
	if title < 0 {
		return out
	}
	out.TitleStart = float64(title) / 1000
	for _, sg := range songs {
		if sg.endMs <= title {
			out.SongEnd = math.Max(out.SongEnd, float64(sg.endMs)/1000)
		}
	}
	return out
}

// SetDriveDirectSourceFactory registra cómo leer un archivo de Drive sin pasar por la caché
// de bloques: para pedir unos pocos bytes sueltos (un bloque de subtítulo) no conviene
// bajar el bloque de 16 MiB que los contiene. Sin esto, la placa se busca por clusters.
func (r *Repository) SetDriveDirectSourceFactory(f DriveSourceFactory) {
	r.driveWin.mu.Lock()
	r.driveWin.direct = f
	r.driveWin.mu.Unlock()
}

// DriveTitleCard busca la placa del título de un archivo de Drive a partir de fromSec (el
// fin del opening si se conoce, o 0). Los errores son los de abrir la sesión de lectura
// por franjas (ErrDriveWindowUnavailable si el archivo no sirve para esto) o una falla
// pasajera de lectura; lo ya leído se conserva, así que reintentar es barato.
func (r *Repository) DriveTitleCard(ctx context.Context, drivePath string, fromSec float64) (DriveTitleCard, error) {
	s, err := r.driveWindowSession(ctx, drivePath)
	if err != nil {
		return DriveTitleCard{}, err
	}
	s.touch()
	return s.titleCard(ctx, r, int64(math.Max(fromSec, 0)*1000))
}

func (s *driveWindowSession) titleCard(ctx context.Context, r *Repository, fromMs int64) (DriveTitleCard, error) {
	var text []*mkvsubs.Track
	for _, t := range s.tracks {
		if s.wanted[t.Number] && t.Format() != mkvsubs.FormatUnknown {
			text = append(text, t)
		}
	}
	if len(text) == 0 {
		return DriveTitleCard{TitleStart: -1}, nil
	}

	key := fromMs / 1000
	s.mu.Lock()
	cached, ok := s.titleCards[key]
	s.mu.Unlock()
	if ok {
		return cached, nil
	}

	limitMs := fromMs + driveTitleCardScan.Milliseconds()
	events, viaCues, err := s.titleEventsByCues(ctx, r, text, fromMs, limitMs)
	if err != nil {
		return DriveTitleCard{}, err
	}
	if !viaCues {
		if events, err = s.titleEventsByClusters(ctx, text, fromMs, limitMs); err != nil {
			return DriveTitleCard{}, err
		}
	}
	out := pickTitleCard(events, fromMs, limitMs)

	s.mu.Lock()
	if s.titleCards == nil {
		s.titleCards = map[int64]DriveTitleCard{}
	}
	s.titleCards[key] = out
	s.mu.Unlock()
	r.logger.Debug().Str("hash", s.hash).Str("file", driveLogName(s.path)).Bool("byCues", viaCues).
		Float64("fromSec", float64(fromMs)/1000).Float64("titleSec", out.TitleStart).Float64("songEndSec", out.SongEnd).
		Int("events", len(events)).Msg("mediastream: Drive title card looked up")
	return out, nil
}

// directSource abre (una vez por sesión) la lectura directa del archivo. nil si no hay.
func (s *driveWindowSession) directSource(ctx context.Context, r *Repository) mkvsubs.Source {
	s.mu.Lock()
	src := s.direct
	s.mu.Unlock()
	if src != nil {
		return src
	}
	r.driveWin.mu.Lock()
	factory := r.driveWin.direct
	r.driveWin.mu.Unlock()
	if factory == nil {
		return nil
	}
	src, err := factory(ctx, s.path)
	if err != nil || src == nil || src.Size() != s.f.Size() {
		return nil
	}
	s.mu.Lock()
	s.direct = src
	s.mu.Unlock()
	return src
}

// titleEventsByCues lee, por el índice, los eventos de las pistas de texto en [fromMs,
// limitMs]. ok=false si el archivo no indexa sus subtítulos o no hay lectura directa. Va en
// orden de tiempo y corta en cuanto aparece una placa con estilo de título.
func (s *driveWindowSession) titleEventsByCues(ctx context.Context, r *Repository, text []*mkvsubs.Track, fromMs, limitMs int64) (events []titleEvent, ok bool, err error) {
	type job struct {
		t *mkvsubs.Track
		c mkvsubs.SubCue
	}
	var jobs []job
	for _, t := range text {
		if len(s.f.TrackCues(t.Number, 0, math.MaxInt64)) == 0 {
			return nil, false, nil // una pista sin índice: no se puede saber qué falta
		}
		for _, c := range s.f.TrackCues(t.Number, fromMs, limitMs) {
			jobs = append(jobs, job{t, c})
		}
	}
	src := s.directSource(ctx, r)
	if src == nil {
		return nil, false, nil
	}
	sort.SliceStable(jobs, func(i, j int) bool { return jobs[i].c.TimeMs < jobs[j].c.TimeMs })

	for start := 0; start < len(jobs); start += driveTitleCardChunk {
		chunk := jobs[start:min(start+driveTitleCardChunk, len(jobs))]
		results := make([][]titleEvent, len(chunk))
		errs := make([]error, len(chunk))
		sem := make(chan struct{}, driveTitleCardParallel)
		var wg sync.WaitGroup
		for i, j := range chunk {
			wg.Add(1)
			go func() {
				defer wg.Done()
				select {
				case sem <- struct{}{}:
					defer func() { <-sem }()
				case <-ctx.Done():
					errs[i] = ctx.Err()
					return
				}
				results[i], errs[i] = s.cuedEvents(ctx, src, j.t, j.c)
			}()
		}
		wg.Wait()
		for i := range chunk {
			if errs[i] != nil {
				return nil, true, errs[i]
			}
			events = append(events, results[i]...)
		}
		if assTitleMs(events, fromMs, limitMs) >= 0 {
			break // lo anterior a la placa ya está leído: no hace falta seguir
		}
	}
	return events, true, nil
}

// cuedEvents lee (o saca de lo ya leído) los eventos del bloque que señala c.
func (s *driveWindowSession) cuedEvents(ctx context.Context, src mkvsubs.Source, t *mkvsubs.Track, c mkvsubs.SubCue) ([]titleEvent, error) {
	s.mu.Lock()
	got, ok := s.cuedRead[c]
	s.mu.Unlock()
	if ok {
		return got, nil
	}
	rctx, cancel := context.WithTimeout(ctx, driveWindowReadTimeout)
	defer cancel()
	blocks, err := s.f.ReadCued(rctx, src, c)
	if err != nil {
		return nil, err
	}
	var out []titleEvent
	for _, b := range blocks {
		if ev, evErr := t.NewEvent(b); evErr == nil {
			out = append(out, newTitleEvent(t, ev))
		}
	}
	s.mu.Lock()
	if s.cuedRead == nil {
		s.cuedRead = map[mkvsubs.SubCue][]titleEvent{}
	}
	s.cuedRead[c] = out
	s.mu.Unlock()
	return out, nil
}

// titleEventsByClusters recorre los clusters del tramo (el camino de los archivos sin
// índice de subtítulos). Corta en cuanto aparece una placa con estilo de título.
func (s *driveWindowSession) titleEventsByClusters(ctx context.Context, text []*mkvsubs.Track, fromMs, limitMs int64) ([]titleEvent, error) {
	wanted := map[uint64]bool{}
	for _, t := range text {
		wanted[t.Number] = true
	}
	var events []titleEvent
	for off := s.f.ClusterBefore(fromMs); off >= 0; {
		startMs, next, evs, err := s.titleCardCluster(ctx, off, wanted)
		if err != nil {
			return nil, err
		}
		if startMs > limitMs {
			break
		}
		events = append(events, evs...)
		if assTitleMs(events, fromMs, limitMs) >= 0 {
			break
		}
		off = next
	}
	return events, nil
}

// titleCardCluster devuelve los eventos de texto del cluster en off: los que ya leyó la
// franja del reproductor, o leyéndolo (con el mismo cupo global de lecturas).
func (s *driveWindowSession) titleCardCluster(ctx context.Context, off int64, wanted map[uint64]bool) (startMs, next int64, events []titleEvent, err error) {
	s.mu.Lock()
	if wc := s.clusters[off]; wc != nil {
		for n := range wanted {
			if t := s.trackByNumber(n); t != nil {
				for _, ev := range wc.events[n] {
					events = append(events, newTitleEvent(t, ev))
				}
			}
		}
		startMs, next = wc.startMs, wc.next
		s.mu.Unlock()
		return startMs, next, events, nil
	}
	s.mu.Unlock()

	select {
	case driveWindowSlots <- struct{}{}:
		defer func() { <-driveWindowSlots }()
	case <-ctx.Done():
		return 0, -1, nil, ctx.Err()
	}
	rctx, cancel := context.WithTimeout(ctx, driveWindowReadTimeout)
	defer cancel()
	cl, err := s.f.ReadCluster(rctx, off, wanted)
	if err != nil {
		return 0, -1, nil, err
	}
	for _, b := range cl.Blocks {
		t := s.trackByNumber(b.Track)
		if t == nil {
			continue
		}
		if ev, evErr := t.NewEvent(b); evErr == nil {
			events = append(events, newTitleEvent(t, ev))
		}
	}
	return cl.StartMs, cl.Next, events, nil
}
