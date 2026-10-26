package drive

import (
	"context"
	"errors"
	"io"
)

// RangeSource lee un archivo de Drive por rangos acotados. Con el RangeFetcher de
// BlockCache.Fetcher comparte los bytes con la reproducción: lo que ya se bajó (o se
// está bajando) para reproducir no se vuelve a pedir a Drive.
type RangeSource struct {
	fetch RangeFetcher
	size  int64
	chunk int64
}

// NewRangeSource arma una fuente para un archivo de `size` bytes.
func NewRangeSource(fetch RangeFetcher, size int64) *RangeSource {
	return &RangeSource{fetch: fetch, size: size, chunk: MediaChunkSize}
}

// ProbeRangeSource es NewRangeSource cuando no se conoce el tamaño: lo averigua con una
// lectura de 1 byte.
func ProbeRangeSource(ctx context.Context, fetch RangeFetcher) (*RangeSource, error) {
	cr, err := OpenChunkedRange(ctx, fetch, 0, 0, MediaChunkSize)
	if err != nil {
		return nil, err
	}
	_ = cr.Body.Close()
	if cr.Total <= 0 {
		return nil, errors.New("drive: unknown file size")
	}
	return NewRangeSource(fetch, cr.Total), nil
}

// Size es el tamaño del archivo.
func (s *RangeSource) Size() int64 { return s.size }

// ReadAt llena p con los bytes desde off.
func (s *RangeSource) ReadAt(ctx context.Context, p []byte, off int64) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	if off < 0 || off >= s.size {
		return 0, io.EOF
	}
	end := min(off+int64(len(p)), s.size) - 1
	cr, err := OpenChunkedRange(ctx, s.fetch, off, end, s.chunk)
	if err != nil {
		return 0, err
	}
	defer cr.Body.Close()
	n, err := io.ReadFull(cr.Body, p[:end-off+1])
	if err == nil && n < len(p) {
		// ReaderAt reports EOF when the caller requested past the file boundary,
		// even though the bounded upstream response itself was read completely.
		err = io.EOF
	}
	return n, err
}
