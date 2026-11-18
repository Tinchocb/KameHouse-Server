package mkvsubs

import (
	"bytes"
	"compress/zlib"
	"context"
	"errors"
	"fmt"
	"io"
	"sort"
	"sync"
)

// Tipos de pista de Matroska.
const (
	TrackSubtitle = 17
)

// Track es una pista del archivo.
type Track struct {
	Number         uint64
	UID            uint64
	Type           int
	CodecID        string
	CodecPrivate   []byte
	Language       string
	Name           string
	DefaultDurNs   int64
	compAlgo       int // -1 sin compresión; 0 zlib; 3 recorte de cabecera
	compSettings   []byte
	unsupportedEnc bool // cifrado u otra codificación que no sabemos deshacer
}

// TextFormat es cómo se escribe una pista de texto.
type TextFormat int

const (
	FormatUnknown TextFormat = iota
	FormatSRT                // S_TEXT/UTF8
	FormatASS                // S_TEXT/ASS y S_TEXT/SSA
)

// Format dice si Track es de texto que sabemos volcar, y en qué formato.
func (t *Track) Format() TextFormat {
	if t.Type != TrackSubtitle || t.unsupportedEnc {
		return FormatUnknown
	}
	switch t.CodecID {
	case "S_TEXT/UTF8", "S_TEXT/PLAIN":
		return FormatSRT
	case "S_TEXT/ASS", "S_TEXT/SSA", "S_ASS", "S_SSA":
		// S_ASS y S_SSA son los identificadores viejos de Matroska (anteriores a v4); ffprobe
		// los llama "ass" igual que a los modernos.
		return FormatASS
	}
	return FormatUnknown
}

// decode deshace la compresión de contenido de la pista (si tiene).
func (t *Track) decode(data []byte) ([]byte, error) {
	switch t.compAlgo {
	case 0:
		zr, err := zlib.NewReader(bytes.NewReader(data))
		if err != nil {
			return nil, err
		}
		defer zr.Close()
		return io.ReadAll(io.LimitReader(zr, 16<<20))
	case 3:
		return append(append([]byte(nil), t.compSettings...), data...), nil
	}
	return data, nil
}

// Attachment es un archivo adjunto (típicamente una fuente).
type Attachment struct {
	Name string
	off  int64
	size int64
}

// Size es el tamaño de los datos del adjunto.
func (a Attachment) Size() int64 { return a.size }

type cuePoint struct {
	timeMs     int64
	clusterOff int64 // offset absoluto en el archivo
}

// File es un MKV abierto: cabecera, pistas, adjuntos e índice.
type File struct {
	mu sync.Mutex
	r  *reader

	segStart     int64
	segEnd       int64
	scaleNs      int64
	durationMs   int64
	firstCluster int64
	tracks       []*Track
	attachments  []Attachment
	cues         []cuePoint
	// subCues: por pista, las entradas del índice que traen la posición del bloque
	// dentro del cluster (ver cued.go).
	subCues     map[uint64][]SubCue
	clusterHlen clusterHeaderLen
}

// Options ajusta cómo se lee el archivo.
type Options struct {
	// ChunkSize es cuánto se lee de una vez (lectura adelantada). 0: 1 MiB.
	ChunkSize int
}

// notMatroskaOrReadError: no poder leer la cabecera es una falla de lectura (se reintenta),
// salvo que el archivo termine antes de tenerla, que es que no es Matroska.
func notMatroskaOrReadError(err error) error {
	if errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
		return ErrNotMatroska
	}
	return fmt.Errorf("mkvsubs: reading header: %w", err)
}

// maxMasterPayload acota los elementos que se leen enteros a memoria (Tracks, Cues...).
const maxMasterPayload = 64 << 20

// Open lee la cabecera del archivo: pistas, adjuntos y el índice de Cues.
func Open(ctx context.Context, src Source, opts Options) (*File, error) {
	f := &File{r: newReader(src, opts.ChunkSize), scaleNs: 1_000_000, firstCluster: -1}
	size := src.Size()

	if size < 8 {
		return nil, ErrNotMatroska
	}
	h, err := f.r.header(ctx, 0)
	if err != nil {
		return nil, notMatroskaOrReadError(err)
	}
	if h.id != idEBML || h.size < 0 {
		return nil, ErrNotMatroska
	}
	off := int64(h.hlen) + h.size
	seg, err := f.r.header(ctx, off)
	if err != nil {
		return nil, notMatroskaOrReadError(err)
	}
	if seg.id != idSegment {
		return nil, ErrNotMatroska
	}
	f.segStart = off + int64(seg.hlen)
	f.segEnd = size
	if seg.size >= 0 && f.segStart+seg.size < size {
		f.segEnd = f.segStart + seg.size
	}

	var (
		seeks                                  = map[uint32]int64{}
		haveInfo, haveTracks, haveAtt, haveCue bool
	)
	pos := f.segStart
	for pos < f.segEnd {
		eh, err := f.r.header(ctx, pos)
		if err != nil {
			return nil, fmt.Errorf("mkvsubs: reading segment children: %w", err)
		}
		if eh.size < 0 && eh.id != idCluster {
			return nil, fmt.Errorf("%w: unknown-size element before first cluster", ErrMalformed)
		}
		if eh.id == idCluster {
			f.firstCluster = pos
			break
		}
		body := pos + int64(eh.hlen)
		switch eh.id {
		case idSeekHead:
			if err := f.readSeekHead(ctx, body, eh.size, seeks); err != nil {
				return nil, err
			}
		case idInfo:
			if err := f.readInfo(ctx, body, eh.size); err != nil {
				return nil, err
			}
			haveInfo = true
		case idTracks:
			if err := f.readTracks(ctx, body, eh.size); err != nil {
				return nil, err
			}
			haveTracks = true
		case idAttachments:
			if err := f.readAttachments(ctx, body, eh.size); err != nil {
				return nil, err
			}
			haveAtt = true
		case idCues:
			if err := f.readCues(ctx, body, eh.size); err != nil {
				return nil, err
			}
			haveCue = true
		}
		pos = body + eh.size
	}
	if f.firstCluster < 0 {
		return nil, fmt.Errorf("%w: no clusters", ErrMalformed)
	}

	// Lo que el SeekHead ubica después de los clusters (Cues al final, casi siempre).
	jump := func(id uint32, have bool, read func(context.Context, int64, int64) error) error {
		p, ok := seeks[id]
		if have || !ok {
			return nil
		}
		abs := f.segStart + p
		if abs >= size {
			return nil // el SeekHead apunta fuera del archivo: se sigue sin ese elemento
		}
		eh, err := f.r.header(ctx, abs)
		if err != nil {
			// Un fallo de lectura (por ejemplo, de Drive) no es un SeekHead roto: si se
			// tragara, el archivo quedaría como "sin Cues" para siempre.
			return fmt.Errorf("mkvsubs: reading element at %d: %w", abs, err)
		}
		if eh.id != id || eh.size < 0 {
			return nil // índice del SeekHead roto: se sigue sin ese elemento
		}
		return read(ctx, abs+int64(eh.hlen), eh.size)
	}
	if err := jump(idInfo, haveInfo, f.readInfo); err != nil {
		return nil, err
	}
	if err := jump(idTracks, haveTracks, f.readTracks); err != nil {
		return nil, err
	}
	if err := jump(idAttachments, haveAtt, f.readAttachments); err != nil {
		return nil, err
	}
	if err := jump(idCues, haveCue, f.readCues); err != nil {
		return nil, err
	}
	if len(f.tracks) == 0 {
		return nil, ErrNoTracks
	}
	return f, nil
}

func (f *File) readMaster(ctx context.Context, body, size int64) ([]byte, error) {
	if size < 0 || size > maxMasterPayload {
		return nil, fmt.Errorf("mkvsubs: master element of %d bytes", size)
	}
	return f.r.copyAt(ctx, body, int(size))
}

func (f *File) readSeekHead(ctx context.Context, body, size int64, seeks map[uint32]int64) error {
	b, err := f.readMaster(ctx, body, size)
	if err != nil {
		return err
	}
	eachChild(b, func(id uint32, data []byte) {
		if id != idSeek {
			return
		}
		var sid uint32
		var spos int64 = -1
		eachChild(data, func(cid uint32, cd []byte) {
			switch cid {
			case idSeekID:
				sid = uint32(beUint(cd))
			case idSeekPosition:
				spos = int64(beUint(cd))
			}
		})
		if sid != 0 && spos >= 0 {
			if _, dup := seeks[sid]; !dup {
				seeks[sid] = spos
			}
		}
	})
	return nil
}

func (f *File) readInfo(ctx context.Context, body, size int64) error {
	b, err := f.readMaster(ctx, body, size)
	if err != nil {
		return err
	}
	var dur float64
	eachChild(b, func(id uint32, data []byte) {
		switch id {
		case idTimestampScale:
			if v := int64(beUint(data)); v > 0 {
				f.scaleNs = v
			}
		case idDuration:
			dur = beFloat(data)
		}
	})
	f.durationMs = int64(dur * float64(f.scaleNs) / 1e6)
	return nil
}

func (f *File) readTracks(ctx context.Context, body, size int64) error {
	b, err := f.readMaster(ctx, body, size)
	if err != nil {
		return err
	}
	f.tracks = f.tracks[:0]
	eachChild(b, func(id uint32, data []byte) {
		if id != idTrackEntry {
			return
		}
		t := &Track{compAlgo: -1}
		eachChild(data, func(cid uint32, cd []byte) {
			switch cid {
			case idTrackNumber:
				t.Number = beUint(cd)
			case idTrackUID:
				t.UID = beUint(cd)
			case idTrackType:
				t.Type = int(beUint(cd))
			case idCodecID:
				t.CodecID = str(cd)
			case idCodecPrivate:
				t.CodecPrivate = append([]byte(nil), cd...)
			case idTrackName:
				t.Name = str(cd)
			case idLanguage:
				t.Language = str(cd)
			case idDefaultDur:
				t.DefaultDurNs = int64(beUint(cd))
			case idContentEncs:
				eachChild(cd, func(eid uint32, ed []byte) {
					if eid != idContentEnc {
						return
					}
					var encType uint64
					comp := false
					eachChild(ed, func(xid uint32, xd []byte) {
						switch xid {
						case idContentEncType:
							encType = beUint(xd)
						case idContentComp:
							comp = true
							t.compAlgo = 0 // por defecto: zlib
							eachChild(xd, func(yid uint32, yd []byte) {
								switch yid {
								case idContentAlgo:
									t.compAlgo = int(beUint(yd))
								case idContentSetting:
									t.compSettings = append([]byte(nil), yd...)
								}
							})
						}
					})
					if encType != 0 || !comp || (t.compAlgo != 0 && t.compAlgo != 3) {
						t.unsupportedEnc = true
					}
				})
			}
		})
		f.tracks = append(f.tracks, t)
	})
	return nil
}

func (f *File) readAttachments(ctx context.Context, body, size int64) error {
	if size < 0 {
		return fmt.Errorf("%w: unknown-size attachments", ErrMalformed)
	}
	f.attachments = f.attachments[:0]
	end := body + size
	for pos := body; pos < end; {
		h, err := f.r.header(ctx, pos)
		if err != nil {
			return err
		}
		bodyPos := pos + int64(h.hlen)
		if h.id == idAttachedFile && h.size >= 0 {
			var a Attachment
			for cp := bodyPos; cp < bodyPos+h.size; {
				ch, err := f.r.header(ctx, cp)
				if err != nil {
					return err
				}
				cb := cp + int64(ch.hlen)
				switch ch.id {
				case idFileName:
					v, err := f.r.at(ctx, cb, int(min(ch.size, 4096)))
					if err != nil {
						return err
					}
					a.Name = str(v)
				case idFileData:
					a.off, a.size = cb, ch.size
				}
				cp = cb + ch.size
			}
			if a.Name != "" && a.size > 0 {
				f.attachments = append(f.attachments, a)
			}
		}
		pos = bodyPos + h.size
	}
	return nil
}

func (f *File) readCues(ctx context.Context, body, size int64) error {
	b, err := f.readMaster(ctx, body, size)
	if err != nil {
		return err
	}
	f.cues = f.cues[:0]
	f.subCues = map[uint64][]SubCue{}
	eachChild(b, func(id uint32, data []byte) {
		if id != idCuePoint {
			return
		}
		var t int64
		var cpos int64 = -1
		eachChild(data, func(cid uint32, cd []byte) {
			switch cid {
			case idCueTime:
				t = int64(beUint(cd))
			case idCueTrackPos:
				var track uint64
				var pos, rel, dur int64 = -1, -1, 0
				eachChild(cd, func(xid uint32, xd []byte) {
					switch xid {
					case idCueTrack:
						track = beUint(xd)
					case idCueClusterPos:
						pos = int64(beUint(xd))
					case idCueRelativePos:
						rel = int64(beUint(xd))
					case idCueDuration:
						dur = int64(beUint(xd))
					}
				})
				if pos >= 0 && rel >= 0 && track > 0 {
					f.subCues[track] = append(f.subCues[track], SubCue{
						Track: track, TimeMs: t * f.scaleNs / 1_000_000, DurMs: dur * f.scaleNs / 1_000_000,
						clusterOff: f.segStart + pos, rel: rel,
					})
				}
				if cpos < 0 {
					cpos = pos
				}
			}
		})
		if cpos >= 0 {
			f.cues = append(f.cues, cuePoint{timeMs: t * f.scaleNs / 1_000_000, clusterOff: f.segStart + cpos})
		}
	})
	sort.SliceStable(f.cues, func(i, j int) bool { return f.cues[i].timeMs < f.cues[j].timeMs })
	for _, list := range f.subCues {
		sort.SliceStable(list, func(i, j int) bool { return list[i].TimeMs < list[j].TimeMs })
	}
	return nil
}

// SubtitleTracks son las pistas de subtítulos en el orden del archivo: la N-ésima es
// la que ffmpeg/ffprobe llaman `0:s:N`.
func (f *File) SubtitleTracks() []*Track {
	var out []*Track
	for _, t := range f.tracks {
		if t.Type == TrackSubtitle {
			out = append(out, t)
		}
	}
	return out
}

// Attachments son los adjuntos del archivo (fuentes, etc.).
func (f *File) Attachments() []Attachment { return f.attachments }

// DurationMs es la duración declarada del segmento (0 si no la trae).
func (f *File) DurationMs() int64 { return f.durationMs }

// Size es el tamaño del archivo en bytes.
func (f *File) Size() int64 { return f.r.src.Size() }

// FirstCluster es el offset del primer cluster.
func (f *File) FirstCluster() int64 { return f.firstCluster }

// HasCues indica si el archivo trae índice para saltar a un instante.
func (f *File) HasCues() bool { return len(f.cues) > 0 }

// CueCount es la cantidad de puntos del índice.
func (f *File) CueCount() int { return len(f.cues) }

// ClusterBefore devuelve el offset de un cluster que empieza en o antes de timeMs y
// sirve de punto de partida para recorrer desde ahí. Sin Cues, el primero.
func (f *File) ClusterBefore(timeMs int64) int64 {
	i := sort.Search(len(f.cues), func(i int) bool { return f.cues[i].timeMs > timeMs })
	if i == 0 {
		return f.firstCluster
	}
	return f.cues[i-1].clusterOff
}

// ReadAttachment lee los datos de un adjunto.
func (f *File) ReadAttachment(ctx context.Context, a Attachment) ([]byte, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if a.size > 64<<20 {
		return nil, fmt.Errorf("mkvsubs: attachment %q of %d bytes", a.Name, a.size)
	}
	return f.r.copyAt(ctx, a.off, int(a.size))
}

// Block es un bloque de una pista pedida.
type Block struct {
	Track      uint64
	StartMs    int64
	DurationMs int64 // 0 si el bloque no la declara
	Data       []byte
}

// Cluster es un cluster leído: solo trae los bloques de las pistas pedidas.
type Cluster struct {
	StartMs int64
	// Next es el offset del cluster siguiente; -1 si este era el último.
	Next   int64
	Blocks []Block
	// Laced cuenta los bloques de pistas pedidas que traían lacing (se desarman en un
	// Block por cuadro, todos con el instante del bloque).
	Laced int
	// Dropped cuenta los bloques de pistas pedidas que no se pudieron leer (lacing mal
	// formado, cabecera truncada). En un archivo sano es cero.
	Dropped int
}

// ReadCluster lee el cluster que empieza en off y devuelve los bloques de las pistas
// en wanted (por número de pista). El payload de los demás bloques no se pide: dentro
// del búfer de lectura se salta sin costo.
func (f *File) ReadCluster(ctx context.Context, off int64, wanted map[uint64]bool) (*Cluster, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	r := f.r
	h, err := r.header(ctx, off)
	if err != nil {
		return nil, err
	}
	if h.id != idCluster {
		return nil, ErrNotCluster
	}
	cl := &Cluster{Next: -1}
	fileSize := r.src.Size()
	pos := off + int64(h.hlen)
	end := int64(-1)
	if h.size >= 0 {
		end = pos + h.size
	}
	var rels []int64
	var clusterTicks int64
	for (end < 0 || pos < end) && pos < fileSize {
		ch, err := r.header(ctx, pos)
		if err != nil {
			return nil, err
		}
		if end < 0 && isTopLevel(ch.id) {
			break
		}
		if ch.size < 0 {
			return nil, fmt.Errorf("%w: unknown-size element inside cluster", ErrMalformed)
		}
		body := pos + int64(ch.hlen)
		switch ch.id {
		case idTimecode:
			b, err := r.at(ctx, body, int(min(ch.size, 8)))
			if err != nil {
				return nil, err
			}
			clusterTicks = int64(beUint(b))
		case idSimpleBlock:
			rb, err := f.readBlock(ctx, body, ch.size, wanted)
			if err != nil {
				return nil, err
			}
			cl.add(rb, 0, &rels)
		case idBlockGroup:
			rb, durTicks, err := f.readGroup(ctx, body, ch.size, wanted)
			if err != nil {
				return nil, err
			}
			cl.add(rb, ticksToMs(durTicks, f.scaleNs), &rels)
		}
		pos = body + ch.size
	}
	cl.StartMs = ticksToMs(clusterTicks, f.scaleNs)
	for i := range cl.Blocks {
		cl.Blocks[i].StartMs = ticksToMs(clusterTicks+rels[i], f.scaleNs)
	}

	// Siguiente cluster: salta Cues/Tags/Void que haya en el medio.
	for pos < f.segEnd && pos < fileSize {
		nh, err := r.header(ctx, pos)
		if err != nil || nh.size < 0 && nh.id != idCluster {
			break
		}
		if nh.id == idCluster {
			cl.Next = pos
			break
		}
		pos += int64(nh.hlen) + nh.size
	}
	return cl, nil
}

func ticksToMs(ticks, scaleNs int64) int64 { return ticks * scaleNs / 1_000_000 }

// readBlocks es lo que sale de un SimpleBlock/Block de una pista pedida.
type readBlocks struct {
	wanted bool
	rel    int64   // instante relativo al cluster, en ticks
	laced  bool    // el bloque traía lacing
	bad    bool    // no se pudo leer
	frames []Block // un Block por cuadro (uno solo si no hay lacing)
}

func (cl *Cluster) add(rb readBlocks, durMs int64, rels *[]int64) {
	if !rb.wanted {
		return
	}
	if rb.bad {
		cl.Dropped++
		return
	}
	if rb.laced {
		cl.Laced++
	}
	for _, b := range rb.frames {
		b.DurationMs = durMs
		cl.Blocks = append(cl.Blocks, b)
		*rels = append(*rels, rb.rel)
	}
}

// readBlock lee un SimpleBlock/Block. Si no es de una pista pedida, wanted=false y no se
// baja el payload.
func (f *File) readBlock(ctx context.Context, body, size int64, wanted map[uint64]bool) (rb readBlocks, err error) {
	if size < 4 {
		return rb, nil
	}
	head, err := f.r.at(ctx, body, int(min(size, 16)))
	if err != nil {
		return rb, err
	}
	vl := 1
	for mask := byte(0x80); vl <= 8 && head[0]&mask == 0; mask >>= 1 {
		vl++
	}
	if vl > 8 || int64(vl+3) > size || len(head) < vl+3 {
		return rb, nil
	}
	track := uint64(head[0]) & (0xFF >> uint(vl))
	for i := 1; i < vl; i++ {
		track = track<<8 | uint64(head[i])
	}
	if !wanted[track] {
		return rb, nil
	}
	rb.wanted = true
	rb.rel = int64(int16(uint16(head[vl])<<8 | uint16(head[vl+1])))
	lacing := head[vl+2] & 0x06
	data, err := f.r.copyAt(ctx, body+int64(vl)+3, int(size-int64(vl)-3))
	if err != nil {
		return rb, err
	}
	if lacing == 0 {
		rb.frames = []Block{{Track: track, Data: data}}
		return rb, nil
	}
	rb.laced = true
	frames, ok := splitLaced(lacing, data)
	if !ok {
		rb.bad = true
		return rb, nil
	}
	for _, fr := range frames {
		rb.frames = append(rb.frames, Block{Track: track, Data: fr})
	}
	return rb, nil
}

// splitLaced separa los cuadros de un bloque con lacing (0x02 Xiph, 0x06 EBML, 0x04 de
// tamaño fijo). ok=false si los tamaños no cuadran.
func splitLaced(lacing byte, data []byte) (frames [][]byte, ok bool) {
	if len(data) < 1 {
		return nil, false
	}
	n := int(data[0]) + 1
	pos := 1
	sizes := make([]int, 0, n)
	switch lacing {
	case 0x02: // Xiph
		for i := 0; i < n-1; i++ {
			sz := 0
			for {
				if pos >= len(data) {
					return nil, false
				}
				b := int(data[pos])
				pos++
				sz += b
				if b != 255 {
					break
				}
			}
			sizes = append(sizes, sz)
		}
	case 0x06: // EBML
		if n > 1 {
			first, l, good := ebmlVint(data[pos:])
			if !good {
				return nil, false
			}
			pos += l
			prev := int64(first)
			sizes = append(sizes, int(prev))
			for i := 1; i < n-1; i++ {
				raw, l, good := ebmlVint(data[pos:])
				if !good {
					return nil, false
				}
				pos += l
				bias := int64(1)<<(7*uint(l)-1) - 1
				prev += int64(raw) - bias
				if prev < 0 {
					return nil, false
				}
				sizes = append(sizes, int(prev))
			}
		}
	case 0x04: // tamaño fijo
		rest := len(data) - 1
		if rest%n != 0 {
			return nil, false
		}
		for i := 0; i < n-1; i++ {
			sizes = append(sizes, rest/n)
		}
	default:
		return nil, false
	}
	total := 0
	for _, sz := range sizes {
		total += sz
	}
	if total > len(data)-pos {
		return nil, false
	}
	sizes = append(sizes, len(data)-pos-total)
	for _, sz := range sizes {
		frames = append(frames, append([]byte(nil), data[pos:pos+sz]...))
		pos += sz
	}
	return frames, true
}

// ebmlVint lee un entero de ancho variable (sin quitar el sesgo de los que llevan signo).
func ebmlVint(b []byte) (v uint64, n int, ok bool) {
	if len(b) == 0 {
		return 0, 0, false
	}
	n = 1
	for mask := byte(0x80); n <= 8 && b[0]&mask == 0; mask >>= 1 {
		n++
	}
	if n > 8 || len(b) < n {
		return 0, 0, false
	}
	v = uint64(b[0]) & (0xFF >> uint(n))
	for i := 1; i < n; i++ {
		v = v<<8 | uint64(b[i])
	}
	return v, n, true
}

// readGroup lee un BlockGroup: su Block y, si la trae, la BlockDuration (en ticks). Si el
// Block no es de una pista pedida se salta el grupo entero.
func (f *File) readGroup(ctx context.Context, body, size int64, wanted map[uint64]bool) (rb readBlocks, durTicks int64, err error) {
	end := body + size
	for pos := body; pos < end; {
		ch, err := f.r.header(ctx, pos)
		if err != nil {
			return rb, 0, err
		}
		if ch.size < 0 {
			return rb, 0, fmt.Errorf("%w: unknown-size element inside block group", ErrMalformed)
		}
		cb := pos + int64(ch.hlen)
		switch ch.id {
		case idBlock:
			b, err := f.readBlock(ctx, cb, ch.size, wanted)
			if err != nil {
				return rb, 0, err
			}
			if !b.wanted {
				return rb, 0, nil
			}
			rb = b
		case idBlockDuration:
			v, err := f.r.at(ctx, cb, int(min(ch.size, 8)))
			if err != nil {
				return rb, 0, err
			}
			durTicks = int64(beUint(v))
		}
		pos = cb + ch.size
	}
	return rb, durTicks, nil
}
