// Package httprange expone un recurso HTTP remoto como io.ReadSeeker usando
// peticiones Range. Sirve para parsear contenedores (p. ej. los Cues de un MKV)
// que viven detrás de una URL —como los archivos de Google Drive— leyendo solo
// los bloques necesarios en vez de descargar el archivo entero.
package httprange

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

const (
	defaultChunkSize = 256 * 1024
	defaultMaxChunks = 16
)

// Reader implementa io.ReadSeeker sobre una URL que soporta Range. Lee en
// bloques de tamaño fijo y conserva los últimos bloques en memoria, así los
// saltos cortos del parser (volver a una cabecera, releer un elemento) no
// generan una petición nueva. No es seguro para uso concurrente.
type Reader struct {
	ctx       context.Context
	client    *http.Client
	url       string
	size      int64
	pos       int64
	chunkSize int64
	maxChunks int
	chunks    map[int64][]byte
	order     []int64 // orden de carga, para desalojar el bloque más viejo

	// Requests cuenta las peticiones de datos hechas (útil en tests y logs).
	Requests int
}

// Open resuelve el tamaño del recurso y devuelve un Reader posicionado al inicio.
func Open(ctx context.Context, client *http.Client, url string) (*Reader, error) {
	if client == nil {
		client = http.DefaultClient
	}
	r := &Reader{
		ctx:       ctx,
		client:    client,
		url:       url,
		chunkSize: defaultChunkSize,
		maxChunks: defaultMaxChunks,
		chunks:    make(map[int64][]byte),
	}
	size, err := r.resolveSize()
	if err != nil {
		return nil, err
	}
	r.size = size
	return r, nil
}

// Size devuelve el tamaño total del recurso en bytes.
func (r *Reader) Size() int64 { return r.size }

func (r *Reader) resolveSize() (int64, error) {
	// HEAD primero: el proxy de Drive responde el Content-Length sin tocar Google.
	req, err := http.NewRequestWithContext(r.ctx, http.MethodHead, r.url, nil)
	if err != nil {
		return 0, err
	}
	if resp, err := r.client.Do(req); err == nil {
		_ = resp.Body.Close()
		if resp.StatusCode == http.StatusOK && resp.ContentLength > 0 {
			return resp.ContentLength, nil
		}
	}

	// Fallback: pedir el primer byte y leer el total del Content-Range.
	req, err = http.NewRequestWithContext(r.ctx, http.MethodGet, r.url, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Range", "bytes=0-0")
	resp, err := r.client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusPartialContent {
		return 0, fmt.Errorf("httprange: el servidor no soporta Range (HTTP %d)", resp.StatusCode)
	}
	total, err := parseContentRangeTotal(resp.Header.Get("Content-Range"))
	if err != nil {
		return 0, err
	}
	return total, nil
}

// parseContentRangeTotal extrae el total de "bytes 0-0/12345".
func parseContentRangeTotal(v string) (int64, error) {
	slash := strings.LastIndexByte(v, '/')
	if slash == -1 || slash == len(v)-1 || v[slash+1:] == "*" {
		return 0, fmt.Errorf("httprange: Content-Range sin tamaño total: %q", v)
	}
	return strconv.ParseInt(v[slash+1:], 10, 64)
}

func (r *Reader) Read(p []byte) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	if r.pos >= r.size {
		return 0, io.EOF
	}
	idx := r.pos / r.chunkSize
	chunk, err := r.chunk(idx)
	if err != nil {
		return 0, err
	}
	off := r.pos - idx*r.chunkSize
	if off >= int64(len(chunk)) {
		return 0, io.ErrUnexpectedEOF
	}
	n := copy(p, chunk[off:])
	r.pos += int64(n)
	return n, nil
}

func (r *Reader) Seek(offset int64, whence int) (int64, error) {
	var next int64
	switch whence {
	case io.SeekStart:
		next = offset
	case io.SeekCurrent:
		next = r.pos + offset
	case io.SeekEnd:
		next = r.size + offset
	default:
		return 0, errors.New("httprange: whence inválido")
	}
	if next < 0 {
		return 0, errors.New("httprange: posición negativa")
	}
	r.pos = next
	return next, nil
}

// chunk devuelve el bloque idx, pidiéndolo al servidor si no está en memoria.
func (r *Reader) chunk(idx int64) ([]byte, error) {
	if c, ok := r.chunks[idx]; ok {
		return c, nil
	}
	start := idx * r.chunkSize
	end := start + r.chunkSize - 1
	if end >= r.size {
		end = r.size - 1
	}

	req, err := http.NewRequestWithContext(r.ctx, http.MethodGet, r.url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", start, end))
	r.Requests++
	resp, err := r.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusPartialContent:
	case http.StatusOK:
		// El servidor ignoró el Range: solo sirve si pedíamos desde el inicio, y
		// aun así se lee únicamente el bloque para no bajar el archivo completo.
		if start != 0 {
			return nil, fmt.Errorf("httprange: el servidor ignoró el Range (HTTP 200 en offset %d)", start)
		}
	default:
		return nil, fmt.Errorf("httprange: HTTP %d al leer bytes %d-%d", resp.StatusCode, start, end)
	}

	want := end - start + 1
	buf := make([]byte, want)
	n, err := io.ReadFull(resp.Body, buf)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) {
		return nil, err
	}
	buf = buf[:n]
	if n == 0 {
		return nil, io.ErrUnexpectedEOF
	}

	if len(r.order) >= r.maxChunks {
		oldest := r.order[0]
		r.order = r.order[1:]
		delete(r.chunks, oldest)
	}
	r.chunks[idx] = buf
	r.order = append(r.order, idx)
	return buf, nil
}

// Close libera los bloques en memoria. Las conexiones las administra el client.
func (r *Reader) Close() error {
	r.chunks = nil
	r.order = nil
	return nil
}

// IsRemote informa si path es una URL http(s) en lugar de una ruta local.
func IsRemote(path string) bool {
	return strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://")
}
