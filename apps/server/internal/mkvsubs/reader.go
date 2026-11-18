// Package mkvsubs saca las pistas de subtítulos de texto y las fuentes de un archivo
// Matroska leído por rangos (por ejemplo, un archivo de Google Drive), sin leerlo
// entero cuando no hace falta.
//
// Un MKV intercala los bloques de subtítulos con los de video y audio dentro de cada
// Cluster. Este paquete indexa el archivo con las Cues (que dicen en qué byte empieza
// cada cluster de cada instante), y recorre solo los clusters de la ventana de tiempo
// pedida. Así, mostrar los subtítulos de los próximos minutos cuesta lo mismo que
// reproducirlos, no el archivo completo.
package mkvsubs

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
)

// Source es un archivo remoto leído por rangos.
type Source interface {
	// ReadAt llena p con los bytes desde off. El llamador nunca pide más allá de Size().
	ReadAt(ctx context.Context, p []byte, off int64) (int, error)
	// Size es el tamaño total del archivo en bytes.
	Size() int64
}

// BytesSource es una Source en memoria (tests y archivos chicos).
type BytesSource []byte

func (b BytesSource) ReadAt(_ context.Context, p []byte, off int64) (int, error) {
	if off < 0 || off >= int64(len(b)) {
		return 0, io.EOF
	}
	n := copy(p, b[off:])
	if n < len(p) {
		return n, io.ErrUnexpectedEOF
	}
	return n, nil
}

func (b BytesSource) Size() int64 { return int64(len(b)) }

var (
	// ErrNotMatroska: el archivo no empieza con una cabecera EBML Matroska/WebM.
	ErrNotMatroska = errors.New("mkvsubs: not a matroska file")
	// ErrNoTracks: no se encontró el elemento Tracks.
	ErrNoTracks = errors.New("mkvsubs: tracks not found")
	// ErrNoCues removed: readers handle cueless files gracefully.
	// ErrNotCluster: en el offset pedido no hay un Cluster.
	ErrNotCluster = errors.New("mkvsubs: not a cluster")
	// ErrMalformed: la estructura del archivo no es la esperada (un elemento con ID o
	// tamaño imposible, por ejemplo porque el archivo cambió desde que se leyó el índice).
	ErrMalformed = errors.New("mkvsubs: malformed element")
)

// reader lee del Source con un búfer de lectura adelantada: leer encabezados de
// elementos contiguos cuesta una sola petición, y saltar un payload dentro del búfer
// no cuesta ninguna. No es seguro entre goroutines.
type reader struct {
	src   Source
	chunk int
	buf   []byte
	off   int64 // offset del archivo del primer byte de buf
}

func newReader(src Source, chunk int) *reader {
	if chunk <= 0 {
		chunk = 1 << 20
	}
	return &reader{src: src, chunk: chunk}
}

// at devuelve n bytes desde off (menos si el archivo termina antes). El slice solo es
// válido hasta la próxima lectura: quien lo conserve debe copiarlo.
func (r *reader) at(ctx context.Context, off int64, n int) ([]byte, error) {
	size := r.src.Size()
	if n <= 0 {
		return nil, nil
	}
	if off < 0 || off >= size {
		return nil, io.EOF
	}
	if off+int64(n) > size {
		n = int(size - off)
	}
	if r.buf != nil && off >= r.off && off+int64(n) <= r.off+int64(len(r.buf)) {
		s := off - r.off
		return r.buf[s : s+int64(n)], nil
	}
	want := max(n, r.chunk)
	if off+int64(want) > size {
		want = int(size - off)
	}
	if cap(r.buf) >= want {
		r.buf = r.buf[:want]
	} else {
		r.buf = make([]byte, want)
	}
	r.off = off
	got, err := r.src.ReadAt(ctx, r.buf, off)
	if got < want {
		r.buf = r.buf[:got]
		if got < n {
			r.buf = nil
			if err == nil || errors.Is(err, io.EOF) {
				err = io.ErrUnexpectedEOF
			}
			return nil, fmt.Errorf("mkvsubs: read %d bytes at %d: %w", n, off, err)
		}
	}
	return r.buf[:n], nil
}

// copyAt es at con una copia independiente del búfer.
func (r *reader) copyAt(ctx context.Context, off int64, n int) ([]byte, error) {
	b, err := r.at(ctx, off, n)
	if err != nil {
		return nil, err
	}
	return append([]byte(nil), b...), nil
}

// IDs de elementos Matroska (con los bits de marca incluidos).
const (
	idEBML           uint32 = 0x1A45DFA3
	idSegment        uint32 = 0x18538067
	idSeekHead       uint32 = 0x114D9B74
	idSeek           uint32 = 0x4DBB
	idSeekID         uint32 = 0x53AB
	idSeekPosition   uint32 = 0x53AC
	idInfo           uint32 = 0x1549A966
	idTimestampScale uint32 = 0x2AD7B1
	idDuration       uint32 = 0x4489
	idTracks         uint32 = 0x1654AE6B
	idTrackEntry     uint32 = 0xAE
	idTrackNumber    uint32 = 0xD7
	idTrackUID       uint32 = 0x73C5
	idTrackType      uint32 = 0x83
	idCodecID        uint32 = 0x86
	idCodecPrivate   uint32 = 0x63A2
	idTrackName      uint32 = 0x536E
	idLanguage       uint32 = 0x22B59C
	idDefaultDur     uint32 = 0x23E383
	idContentEncs    uint32 = 0x6D80
	idContentEnc     uint32 = 0x6240
	idContentEncType uint32 = 0x5033
	idContentComp    uint32 = 0x5034
	idContentAlgo    uint32 = 0x4254
	idContentSetting uint32 = 0x4255
	idCues           uint32 = 0x1C53BB6B
	idCuePoint       uint32 = 0xBB
	idCueTime        uint32 = 0xB3
	idCueTrackPos    uint32 = 0xB7
	idCueClusterPos  uint32 = 0xF1
	idCueRelativePos uint32 = 0xF0
	idCueDuration    uint32 = 0xB2
	idCueTrack       uint32 = 0xF7
	idAttachments    uint32 = 0x1941A469
	idAttachedFile   uint32 = 0x61A7
	idFileName       uint32 = 0x466E
	idFileData       uint32 = 0x465C
	idCluster        uint32 = 0x1F43B675
	idTimecode       uint32 = 0xE7
	idSimpleBlock    uint32 = 0xA3
	idBlockGroup     uint32 = 0xA0
	idBlock          uint32 = 0xA1
	idBlockDuration  uint32 = 0x9B
	idTags           uint32 = 0x1254C367
	idChapters       uint32 = 0x1043A770
)

// isTopLevel: elementos hijos directos de Segment (terminan un Cluster de tamaño
// desconocido).
func isTopLevel(id uint32) bool {
	switch id {
	case idCluster, idCues, idTags, idChapters, idAttachments, idSeekHead, idInfo, idTracks:
		return true
	}
	return false
}

type header struct {
	id   uint32
	size int64 // -1: tamaño desconocido
	hlen int
}

// parseHeader decodifica ID y tamaño al comienzo de b. ok=false si b es muy corto.
func parseHeader(b []byte) (h header, ok bool, err error) {
	if len(b) == 0 {
		return h, false, nil
	}
	idLen := 1
	for mask := byte(0x80); idLen <= 4 && b[0]&mask == 0; mask >>= 1 {
		idLen++
	}
	if idLen > 4 {
		return h, false, fmt.Errorf("%w: invalid element id byte 0x%02x", ErrMalformed, b[0])
	}
	if len(b) < idLen+1 {
		return h, false, nil
	}
	for i := 0; i < idLen; i++ {
		h.id = h.id<<8 | uint32(b[i])
	}
	sz := b[idLen:]
	szLen := 1
	for mask := byte(0x80); szLen <= 8 && sz[0]&mask == 0; mask >>= 1 {
		szLen++
	}
	if szLen > 8 {
		return h, false, fmt.Errorf("%w: invalid element size byte 0x%02x", ErrMalformed, sz[0])
	}
	if len(sz) < szLen {
		return h, false, nil
	}
	v := uint64(sz[0]) & (0xFF >> uint(szLen))
	allOnes := v == uint64(0xFF>>uint(szLen))
	for i := 1; i < szLen; i++ {
		v = v<<8 | uint64(sz[i])
		allOnes = allOnes && sz[i] == 0xFF
	}
	h.hlen = idLen + szLen
	if allOnes {
		h.size = -1
	} else {
		if v > uint64(1)<<62 {
			return h, false, fmt.Errorf("%w: element size %d out of range", ErrMalformed, v)
		}
		h.size = int64(v)
	}
	return h, true, nil
}

// header lee el encabezado del elemento que empieza en off.
func (r *reader) header(ctx context.Context, off int64) (header, error) {
	b, err := r.at(ctx, off, 12)
	if err != nil {
		return header{}, err
	}
	h, ok, err := parseHeader(b)
	if err != nil {
		return header{}, fmt.Errorf("%w at %d", err, off)
	}
	if !ok {
		return header{}, io.ErrUnexpectedEOF
	}
	return h, nil
}

func beUint(b []byte) uint64 {
	var v uint64
	for _, c := range b {
		v = v<<8 | uint64(c)
	}
	return v
}

func beFloat(b []byte) float64 {
	switch len(b) {
	case 4:
		return float64(math.Float32frombits(uint32(beUint(b))))
	case 8:
		return math.Float64frombits(beUint(b))
	}
	return 0
}

func str(b []byte) string {
	for len(b) > 0 && b[len(b)-1] == 0 {
		b = b[:len(b)-1]
	}
	return string(b)
}

// eachChild recorre los hijos de un elemento maestro que ya está en memoria.
func eachChild(b []byte, fn func(id uint32, data []byte)) {
	for len(b) > 0 {
		h, ok, err := parseHeader(b)
		if err != nil || !ok {
			return
		}
		end := len(b)
		if h.size >= 0 && int64(h.hlen)+h.size <= int64(len(b)) {
			end = h.hlen + int(h.size)
		}
		fn(h.id, b[h.hlen:end])
		b = b[end:]
	}
}
