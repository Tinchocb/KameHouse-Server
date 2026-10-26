package mediastream

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"time"

	"kamehouse/internal/mkvsubs"
)

// coveredRunLocked: el tramo de clusters leídos de corrido que contiene a posMs, como
// (inicio, fin) en ms. (-1, -1) si posMs no cae en un tramo leído. El fin es MaxInt64/2
// si el tramo llega al final del archivo.
//
// Un cluster leído solo cubre desde su inicio hasta el inicio del siguiente; mientras el
// siguiente no se leyó, se sabe que cubre al menos el cluster más corto visto. Si posMs
// queda más allá de eso, no está cubierto: decir que sí hace que el reproductor recargue
// la pista una y otra vez con subtítulos que no incluyen donde está.
func (s *driveWindowSession) coveredRunLocked(posMs int64) (from, until int64) {
	idx := -1
	for i, off := range s.order {
		if s.clusters[off].startMs > posMs {
			break
		}
		idx = i
	}
	if idx < 0 {
		return -1, -1
	}
	first := s.clusters[s.order[idx]]
	for i := idx; i > 0; i-- {
		if prev := s.clusters[s.order[i-1]]; prev.next == s.order[i] {
			first = prev
		} else {
			break
		}
	}
	cur := s.clusters[s.order[idx]]
	for cur.next >= 0 {
		nx := s.clusters[cur.next]
		if nx == nil {
			end := cur.startMs + s.minClusterMs
			if posMs >= end {
				return -1, -1
			}
			return first.startMs, end
		}
		cur = nx
	}
	return first.startMs, math.MaxInt64 / 2
}

// backfillLocked: cuánto antes de la posición se lee. Lo normal es un minuto; si ya se vio
// un cartel más largo (que no sea uno permanente), hasta su duración, con un tope de bytes
// del archivo para que un salto no cueste media película.
func (s *driveWindowSession) backfillLocked() int64 {
	ms := driveWindowBackfillMin.Milliseconds()
	if known := s.longestMs + driveWindowBackfillMargin.Milliseconds(); known > ms {
		ms = known
	}
	if limit := s.backfillCapMsLocked(); ms > limit {
		ms = limit
	}
	return max(ms, driveWindowBackfillFloor.Milliseconds())
}

// backfillCapMsLocked traduce el tope de bytes a milisegundos de video con la tasa media.
func (s *driveWindowSession) backfillCapMsLocked() int64 {
	size, dur := s.f.Size(), s.f.DurationMs()
	if size <= 0 || dur <= 0 {
		return 120_000
	}
	return int64(float64(driveWindowBackfillMaxBytes) / float64(size) * float64(dur))
}

// walkLocked recorre la cadena de clusters desde off y devuelve el primero sin leer cuyo
// instante es anterior a limitMs; -1 si todos los anteriores a limitMs ya están.
func (s *driveWindowSession) walkLocked(off, limitMs int64) int64 {
	for off >= 0 {
		c := s.clusters[off]
		if c == nil {
			return off
		}
		if c.startMs >= limitMs {
			return -1
		}
		off = c.next
	}
	return -1
}

// nextOffsetLocked: el próximo cluster a leer, -1 si ya está todo lo necesario.
//
//  1. Desde la posición hacia adelante, hasta el final de la ventana: es lo que hace falta
//     ya para que aparezcan los subtítulos.
//  2. Hacia atrás, desde el comienzo del relleno hasta la posición: carteles largos que
//     empezaron antes del salto.
//  3. El primer cluster, una vez, cuando se salta lejos del principio: ahí están los
//     carteles que duran todo el episodio y los eventos más largos para calibrar el relleno.
func (s *driveWindowSession) nextOffsetLocked() int64 {
	if s.full {
		return s.walkLocked(s.f.FirstCluster(), math.MaxInt64)
	}
	from := max(s.posMs-s.backfillLocked(), 0)
	s.fromMs = from
	if off := s.walkLocked(s.f.ClusterBefore(s.posMs), s.toMs); off >= 0 {
		return off
	}
	if from < s.posMs {
		if off := s.walkLocked(s.f.ClusterBefore(from), s.posMs); off >= 0 {
			return off
		}
	}
	if !s.seeded && s.started && s.posMs > driveWindowSeedMinPos.Milliseconds() {
		first := s.f.FirstCluster()
		if s.clusters[first] == nil {
			return first
		}
		s.seeded = true
	}
	return -1
}

// completeLocked: ¿se leyeron todos los clusters del archivo, de punta a punta?
func (s *driveWindowSession) completeLocked() bool {
	off := s.f.FirstCluster()
	for off >= 0 {
		c := s.clusters[off]
		if c == nil {
			return false
		}
		off = c.next
	}
	return true
}

func (s *driveWindowSession) trackByNumber(n uint64) *mkvsubs.Track {
	for _, t := range s.tracks {
		if t.Number == n {
			return t
		}
	}
	return nil
}

// run lee clusters hasta cubrir la ventana. Corre de a un lector por sesión.
func (s *driveWindowSession) run(r *Repository) {
	defer func() {
		if rec := recover(); rec != nil {
			s.mu.Lock()
			s.running = false
			s.recordFailureLocked(fmt.Errorf("panic: %v", rec))
			s.mu.Unlock()
		}
	}()

	for {
		s.mu.Lock()
		if s.ctx.Err() != nil {
			s.running = false
			s.mu.Unlock()
			return
		}
		if !s.full && time.Since(s.lastReq) > driveWindowStaleAfter {
			// El reproductor no volvió a pedir: no se sigue gastando Drive por nadie.
			s.running = false
			s.mu.Unlock()
			return
		}
		off := s.nextOffsetLocked()
		if off < 0 {
			s.running = false
			done := !s.complete && s.completeLocked()
			if done {
				s.complete = true
			}
			s.stats.passes++
			summary := s.passSummaryLocked()
			s.mu.Unlock()
			if summary != nil {
				summary(r)
			}
			if done {
				s.finalize(r)
			}
			return
		}
		gen := s.readGen
		cctx, cancel := context.WithCancel(s.ctx)
		s.readCancel = cancel
		s.mu.Unlock()

		cl, err := s.readOne(cctx, off)
		cancel()

		s.mu.Lock()
		s.readCancel = nil
		if err != nil {
			if errors.Is(err, context.Canceled) && s.ctx.Err() == nil && s.readGen != gen {
				s.mu.Unlock()
				continue // el reproductor saltó: la lectura abandonada no es una falla
			}
			if s.ctx.Err() != nil {
				s.running = false
				s.mu.Unlock()
				return
			}
			s.running = false
			failure := s.recordFailureLocked(err)
			s.mu.Unlock()
			r.logger.Warn().Err(err).Str("hash", s.hash).Str("file", driveLogName(s.path)).Int64("offset", off).
				Str("kind", failure.kind).Int("status", failure.status).
				Msg("mediastream: Drive window subtitle read failed (retried on the next request)")
			if healKind(failure.kind) {
				// Lo que la sesión sabe del archivo (Cues, tamaño) ya no vale: se descarta y el
				// próximo pedido lo vuelve a abrir.
				r.logger.Warn().Str("hash", s.hash).Str("file", driveLogName(s.path)).
					Msg("mediastream: Drive subtitle window dropped (the file changed); it will be reopened")
				s.reg.drop(s)
			}
			return
		}
		s.storeClusterLocked(off, cl)
		s.mu.Unlock()
	}
}

// readOne lee un cluster esperando su turno de lectura (cupo global) y con tope de tiempo.
func (s *driveWindowSession) readOne(ctx context.Context, off int64) (*mkvsubs.Cluster, error) {
	select {
	case driveWindowSlots <- struct{}{}:
		defer func() { <-driveWindowSlots }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	rctx, cancel := context.WithTimeout(ctx, driveWindowReadTimeout)
	defer cancel()
	t0 := time.Now()
	cl, err := s.f.ReadCluster(rctx, off, s.wanted)
	s.mu.Lock()
	s.stats.readNs += time.Since(t0).Nanoseconds()
	s.mu.Unlock()
	return cl, err
}

// recordFailureLocked anota la falla y devuelve su clasificación.
func (s *driveWindowSession) recordFailureLocked(err error) *windowFailure {
	kind, status := classifyReadError(err)
	f := &windowFailure{msg: err.Error(), kind: kind, status: status, at: time.Now()}
	s.failure = f
	s.stats.lastFail = f
	s.stats.failures++
	return f
}

// storeClusterLocked guarda lo leído de un cluster y actualiza lo aprendido del archivo.
func (s *driveWindowSession) storeClusterLocked(off int64, cl *mkvsubs.Cluster) {
	wc := &wCluster{off: off, next: cl.Next, startMs: cl.StartMs, events: map[uint64][]mkvsubs.Event{}}
	if cl.Next >= 0 {
		wc.span = cl.Next - off
	} else {
		wc.span = s.f.Size() - off
	}
	events := 0
	for _, b := range cl.Blocks {
		t := s.trackByNumber(b.Track)
		if t == nil {
			continue
		}
		ev, err := t.NewEvent(b)
		if err != nil {
			s.stats.dropped++
			continue
		}
		wc.events[b.Track] = append(wc.events[b.Track], ev)
		s.stats.events[b.Track]++
		events++
		if dur := ev.EndMs - ev.StartMs; dur > s.longestMs && dur <= driveWindowLongEventCap.Milliseconds() {
			s.longestMs = dur
		}
	}
	s.clusters[off] = wc
	i := sort.Search(len(s.order), func(i int) bool { return s.order[i] >= off })
	s.order = append(s.order, 0)
	copy(s.order[i+1:], s.order[i:])
	s.order[i] = off
	// Duración de este cluster y del anterior, para saber cuánto cubre uno cuyo siguiente
	// todavía no se leyó.
	if nx := s.clusters[cl.Next]; nx != nil && nx.startMs > wc.startMs {
		s.minClusterMs = min(s.minClusterMs, nx.startMs-wc.startMs)
	}
	if i > 0 {
		if pv := s.clusters[s.order[i-1]]; pv.next == off && wc.startMs > pv.startMs {
			s.minClusterMs = min(s.minClusterMs, wc.startMs-pv.startMs)
		}
	}
	s.minClusterMs = max(s.minClusterMs, 500)
	s.parsed += wc.span
	s.version++
	s.failure = nil // una lectura que salió bien: ya no hay falla vigente
	s.stats.reads++
	s.stats.laced += cl.Laced
	s.stats.dropped += cl.Dropped
	s.stats.passReads++
	s.stats.passBytes += wc.span
	s.stats.passEvents += events
	if !s.seeded && off == s.f.FirstCluster() {
		s.seeded = true
	}
}

// passSummaryLocked arma el log de una pasada de lectura (cuando la franja quedó cubierta).
// Devuelve nil si no vale la pena (una pasada de un solo cluster rápido: es el avance normal
// de la reproducción).
func (s *driveWindowSession) passSummaryLocked() func(r *Repository) {
	st := s.stats
	took := time.Since(st.passStart)
	if st.passReads == 0 {
		return nil
	}
	notable := st.passReads >= 3 || took > 1500*time.Millisecond || st.passRetried
	hash, file := s.hash, driveLogName(s.path)
	pos, from, to := float64(s.posMs)/1000, float64(s.fromMs)/1000, float64(s.toMs)/1000
	tracks := map[int]int{}
	for i, t := range s.tracks {
		if n := st.events[t.Number]; n > 0 {
			tracks[i] = n
		}
	}
	clusters, parsed := len(s.clusters), s.parsed
	return func(r *Repository) {
		ev := r.logger.Debug()
		if notable {
			ev = r.logger.Info()
		}
		ev.Str("hash", hash).Str("file", file).
			Float64("posSec", pos).Float64("fromSec", from).Float64("toSec", to).
			Int("passClusters", st.passReads).Int64("passBytes", st.passBytes).Int("passEvents", st.passEvents).
			Dur("took", took).Int("clusters", clusters).Int64("parsedBytes", parsed).
			Interface("eventsByTrack", tracks).Bool("afterFailure", st.passRetried).
			Msg("mediastream: Drive subtitle window ready")
	}
}
