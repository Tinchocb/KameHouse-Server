package mkvsubs

import (
	"context"
	"fmt"
	"io"
	"sort"
	"sync/atomic"
)

// Lectura de bloques sueltos por el índice.
//
// mkvmerge escribe una Cue por cada bloque de subtítulo, con el cluster y la posición del
// bloque dentro de él. Con eso se puede leer una línea de subtítulo pidiendo solo sus
// bytes (unos cientos), sin recorrer el cluster, que es casi todo video.

// SubCue es la entrada del índice de un bloque.
type SubCue struct {
	Track  uint64
	TimeMs int64
	// DurMs es la CueDuration (0 si el índice no la trae).
	DurMs int64

	clusterOff int64 // offset absoluto del cluster
	rel        int64 // posición del bloque dentro de los datos del cluster
}

// cuedReadSize es cuánto se pide de una vez por bloque: una línea de subtítulo entra de
// sobra; si no, se pide el resto.
const cuedReadSize = 2048

// TrackCues devuelve las entradas del índice de una pista con instante en [fromMs, toMs],
// en orden. Vacío si el índice no lista los bloques de esa pista.
func (f *File) TrackCues(track uint64, fromMs, toMs int64) []SubCue {
	all := f.subCues[track]
	i := sort.Search(len(all), func(i int) bool { return all[i].TimeMs >= fromMs })
	j := sort.Search(len(all), func(i int) bool { return all[i].TimeMs > toMs })
	if i >= j {
		return nil
	}
	return all[i:j]
}

// clusterHeaderLen recuerda el largo del encabezado de los clusters del archivo (ID más
// tamaño): un muxer usa siempre el mismo ancho, así que se lee una vez y después se
// verifica contra cada bloque.
type clusterHeaderLen struct{ v atomic.Int64 }

// ReadCued lee de src el bloque que señala c y lo devuelve (más de uno si trae lacing).
// src puede ser otra fuente que la del archivo: sirve para pedir estos pocos bytes
// directo, sin pasar por una caché de bloques grandes. Es seguro entre goroutines.
func (f *File) ReadCued(ctx context.Context, src Source, c SubCue) ([]Block, error) {
	if hlen := f.clusterHlen.v.Load(); hlen > 0 {
		if blocks, ok, err := f.readCuedAt(ctx, src, c, hlen); err != nil || ok {
			return blocks, err
		}
	}
	// Primera lectura, o un cluster con otro ancho de encabezado: se lee el suyo.
	head := make([]byte, 12)
	n, err := src.ReadAt(ctx, head, c.clusterOff)
	if err != nil && n < 5 {
		return nil, fmt.Errorf("mkvsubs: reading cluster header at %d: %w", c.clusterOff, err)
	}
	h, ok, err := parseHeader(head[:n])
	if err != nil {
		return nil, err
	}
	if !ok || h.id != idCluster {
		return nil, ErrNotCluster
	}
	f.clusterHlen.v.Store(int64(h.hlen))
	blocks, ok, err := f.readCuedAt(ctx, src, c, int64(h.hlen))
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("%w: cue of track %d at %d ms does not point to its block", ErrMalformed, c.Track, c.TimeMs)
	}
	return blocks, nil
}

// readCuedAt lee el bloque suponiendo que el encabezado del cluster mide hlen. ok=false si
// lo que hay ahí no es un bloque de la pista (el ancho supuesto no era el de este cluster).
func (f *File) readCuedAt(ctx context.Context, src Source, c SubCue, hlen int64) (blocks []Block, ok bool, err error) {
	off := c.clusterOff + hlen + c.rel
	size := src.Size()
	if off < 0 || off >= size {
		return nil, false, nil
	}
	buf := make([]byte, min(int64(cuedReadSize), size-off))
	if n, rerr := src.ReadAt(ctx, buf, off); n < len(buf) {
		if rerr == nil || rerr == io.EOF {
			rerr = io.ErrUnexpectedEOF
		}
		return nil, false, fmt.Errorf("mkvsubs: read %d bytes at %d: %w", len(buf), off, rerr)
	}
	h, hok, herr := parseHeader(buf)
	if herr != nil || !hok || h.size < 0 || (h.id != idBlockGroup && h.id != idSimpleBlock) {
		return nil, false, nil
	}
	total := int64(h.hlen) + h.size
	if total > maxMasterPayload {
		return nil, false, nil
	}
	if total > int64(len(buf)) {
		if off+total > size {
			return nil, false, nil
		}
		full := make([]byte, total)
		if n, rerr := src.ReadAt(ctx, full, off); n < len(full) {
			if rerr == nil || rerr == io.EOF {
				rerr = io.ErrUnexpectedEOF
			}
			return nil, false, fmt.Errorf("mkvsubs: read %d bytes at %d: %w", len(full), off, rerr)
		}
		buf = full
	}
	body := buf[h.hlen:total]

	var raw []byte
	durMs := c.DurMs
	if h.id == idSimpleBlock {
		raw = body
	} else {
		eachChild(body, func(id uint32, data []byte) {
			switch id {
			case idBlock:
				raw = data
			case idBlockDuration:
				durMs = ticksToMs(int64(beUint(data)), f.scaleNs)
			}
		})
	}
	track, n, vok := ebmlVint(raw)
	if !vok || track != c.Track || len(raw) < n+3 {
		return nil, false, nil
	}
	lacing := raw[n+2] & 0x06
	payload := raw[n+3:]
	if lacing == 0 {
		return []Block{{Track: track, StartMs: c.TimeMs, DurationMs: durMs, Data: append([]byte(nil), payload...)}}, true, nil
	}
	frames, fok := splitLaced(lacing, payload)
	if !fok {
		return nil, true, nil // bloque ilegible: no es un problema del ancho supuesto
	}
	for _, fr := range frames {
		blocks = append(blocks, Block{Track: track, StartMs: c.TimeMs, DurationMs: durMs, Data: append([]byte(nil), fr...)})
	}
	return blocks, true, nil
}
