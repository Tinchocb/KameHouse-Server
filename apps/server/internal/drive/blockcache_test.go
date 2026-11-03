package drive

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// cacheUpstream sirve data por rangos acotados como el endpoint de Drive y cuenta
// los pedidos y los bytes servidos.
type cacheUpstream struct {
	mu       sync.Mutex
	data     []byte
	requests atomic.Int32
	served   atomic.Int64
	failNext atomic.Int32 // cantidad de pedidos que fallan con 403 de cuota
}

func (f *cacheUpstream) fetch(_ context.Context, rh string) (*http.Response, error) {
	f.requests.Add(1)
	if f.failNext.Load() > 0 {
		f.failNext.Add(-1)
		return nil, &StreamStatusError{Status: http.StatusForbidden, Body: `{"reason":"downloadQuotaExceeded"}`}
	}
	f.mu.Lock()
	data := f.data
	f.mu.Unlock()
	start, end, _, _ := parseByteRange(rh)
	size := int64(len(data))
	if start >= size {
		return nil, &StreamStatusError{Status: http.StatusRequestedRangeNotSatisfiable}
	}
	if end < 0 || end >= size {
		end = size - 1
	}
	body := data[start : end+1]
	f.served.Add(int64(len(body)))
	h := http.Header{}
	h.Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, size))
	h.Set("Content-Type", "video/x-matroska")
	return &http.Response{StatusCode: http.StatusPartialContent, Header: h, Body: io.NopCloser(bytes.NewReader(body))}, nil
}

func readCached(t *testing.T, fetch RangeFetcher, start, end int64) []byte {
	t.Helper()
	resp, err := fetch(context.Background(), "bytes="+strconv.FormatInt(start, 10)+"-"+func() string {
		if end < 0 {
			return ""
		}
		return strconv.FormatInt(end, 10)
	}())
	if err != nil {
		t.Fatalf("fetch %d-%d: %v", start, end, err)
	}
	defer resp.Body.Close()
	got, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read %d-%d: %v", start, end, err)
	}
	return got
}

func newTestCache(t *testing.T, block, max int64) *BlockCache {
	t.Helper()
	c, err := NewBlockCache(t.TempDir(), block, max)
	if err != nil {
		t.Fatal(err)
	}
	// Las descargas adelantadas siguen escribiendo tras la lectura: esperar a
	// que terminen antes de que el test borre el directorio.
	t.Cleanup(func() { waitIdle(t, c) })
	return c
}

func waitIdle(t *testing.T, c *BlockCache) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for c.inflightCount() > 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
}

func TestBlockCacheSirveDesdeDiscoLaSegundaVez(t *testing.T) {
	f := &cacheUpstream{data: testData(10_000)}
	c := newTestCache(t, 1000, 1<<30)
	fetch := c.Fetcher("fileA", f.fetch)

	got := readCached(t, fetch, 1500, 4200)
	if !bytes.Equal(got, f.data[1500:4201]) {
		t.Fatal("datos distintos en la primera lectura")
	}
	// Esperar a que terminen los bloques adelantados antes de contar.
	waitIdle(t, c)
	before := f.requests.Load()

	got = readCached(t, fetch, 1500, 4200)
	if !bytes.Equal(got, f.data[1500:4201]) {
		t.Fatal("datos distintos en la segunda lectura")
	}
	if n := f.requests.Load() - before; n != 0 {
		t.Fatalf("la segunda lectura hizo %d pedidos a Drive, se esperaban 0", n)
	}

	// Rango abierto hasta el final y cola del archivo.
	if got := readCached(t, fetch, 9_990, -1); !bytes.Equal(got, f.data[9_990:]) {
		t.Fatal("cola del archivo incorrecta")
	}

	// Sobrevive a un reinicio: otra instancia sobre el mismo directorio.
	c2, _ := NewBlockCache(c.Dir(), 1000, 1<<30)
	before = f.requests.Load()
	if got := readCached(t, c2.Fetcher("fileA", f.fetch), 2000, 2999); !bytes.Equal(got, f.data[2000:3000]) {
		t.Fatal("datos distintos tras reabrir")
	}
	if n := f.requests.Load() - before; n != 0 {
		t.Fatalf("tras reabrir hizo %d pedidos, se esperaban 0", n)
	}
}

func TestBlockCachePreviewDoesNotReadAhead(t *testing.T) {
	f := &cacheUpstream{data: testData(10_000)}
	c := newTestCache(t, 1000, 1<<30)
	fetch := c.FetcherWithoutReadAhead("fileA", f.fetch)
	for _, end := range []int64{1599, 2200, 2200} {
		if got := readCached(t, fetch, 1500, end); !bytes.Equal(got, f.data[1500:end+1]) {
			t.Fatal("incorrect preview bytes")
		}
		waitIdle(t, c)
		want := int32(1)
		if end == 2200 {
			want = 2
		}
		if got := f.requests.Load(); got != want {
			t.Fatalf("downloaded %d blocks, want only %d demanded blocks", got, want)
		}
	}
}

func TestBlockCacheComparteDescargasConcurrentes(t *testing.T) {
	f := &cacheUpstream{data: testData(4000)}
	c := newTestCache(t, 4000, 1<<30)
	fetch := c.Fetcher("fileB", f.fetch)

	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if got := readCached(t, fetch, 100, 3999); !bytes.Equal(got, f.data[100:]) {
				t.Error("datos distintos en lectura concurrente")
			}
		}()
	}
	wg.Wait()
	if n := f.requests.Load(); n != 1 {
		t.Fatalf("8 lectores del mismo bloque hicieron %d pedidos, se esperaba 1", n)
	}
}

func TestBlockCacheInvalidaSiCambiaElTamaño(t *testing.T) {
	f := &cacheUpstream{data: testData(3000)}
	c := newTestCache(t, 1000, 1<<30)
	fetch := c.Fetcher("fileC", f.fetch)
	readCached(t, fetch, 0, 999)
	waitIdle(t, c)

	// El archivo cambió en Drive (otro tamaño).
	f.mu.Lock()
	f.data = bytes.Repeat([]byte{7}, 5000)
	f.mu.Unlock()
	// Un bloque que no estaba cacheado revela el tamaño nuevo y purga el resto.
	got := readCached(t, fetch, 4500, 4999)
	if !bytes.Equal(got, f.data[4500:]) {
		t.Fatal("datos nuevos incorrectos")
	}
	waitIdle(t, c)
	if got := readCached(t, fetch, 0, 999); !bytes.Equal(got, f.data[:1000]) {
		t.Fatal("se sirvió un bloque viejo tras el cambio de tamaño")
	}

	// Validate con el tamaño de la metadata de Drive también invalida.
	readCached(t, fetch, 1000, 1999)
	waitIdle(t, c)
	c.Validate("fileC", 6000)
	if _, err := os.Stat(filepath.Join(c.Dir(), "fileC", "5000-1.blk")); err == nil {
		t.Fatal("Validate con otro tamaño debería borrar los bloques")
	}
}

// En Windows un bloque abierto no se puede borrar al cambiar el tamaño: aunque
// quede en disco, no debe servirse con el tamaño nuevo.
func TestBlockCacheIgnoraBloqueViejoNoBorrado(t *testing.T) {
	f := &cacheUpstream{data: testData(3000)}
	c := newTestCache(t, 1000, 1<<30)
	fetch := c.Fetcher("fileS", f.fetch)
	readCached(t, fetch, 0, 999)
	waitIdle(t, c)
	stale, err := os.ReadFile(filepath.Join(c.Dir(), "fileS", "3000-0.blk"))
	if err != nil {
		t.Fatal(err)
	}

	f.mu.Lock()
	f.data = bytes.Repeat([]byte{7}, 5000)
	f.mu.Unlock()
	c.Validate("fileS", 5000)
	// Simula el bloque que sobrevivió al borrado.
	if err := os.WriteFile(filepath.Join(c.Dir(), "fileS", "3000-0.blk"), stale, 0o644); err != nil {
		t.Fatal(err)
	}
	if got := readCached(t, fetch, 0, 999); !bytes.Equal(got, f.data[:1000]) {
		t.Fatal("se sirvió un bloque del archivo viejo")
	}
}

func TestBlockCacheDesalojaLoMenosUsado(t *testing.T) {
	f := &cacheUpstream{data: testData(10_000)}
	c := newTestCache(t, 1000, 3500)
	fetch := c.Fetcher("fileD", f.fetch)
	for i := int64(0); i < 10; i++ {
		readCached(t, fetch, i*1000, i*1000+999)
		waitIdle(t, c)
		time.Sleep(15 * time.Millisecond) // mtime distinto por bloque
	}
	if bytes, _ := c.Stats(); bytes > 3500 {
		t.Fatalf("la caché ocupa %d bytes, tope 3500", bytes)
	}
	if _, err := os.Stat(filepath.Join(c.Dir(), "fileD", "10000-9.blk")); err != nil {
		t.Fatal("el bloque más reciente no debería desalojarse")
	}
}

func TestBlockCacheReintentaCuotaYConservaElError(t *testing.T) {
	old := chunkRetryDelays
	chunkRetryDelays = []time.Duration{0, 0}
	defer func() { chunkRetryDelays = old }()

	f := &cacheUpstream{data: testData(3000)}
	c := newTestCache(t, 1000, 1<<30)
	fetch := c.Fetcher("fileE", f.fetch)

	f.failNext.Store(2) // dos rechazos: el tercer intento pasa
	if got := readCached(t, fetch, 0, 999); !bytes.Equal(got, f.data[:1000]) {
		t.Fatal("datos incorrectos tras reintentos")
	}
	// Leer el bloque 0 precarga el 1 en segundo plano: se espera a que termine y
	// se pide el 2, que nadie precargó (si no, el pedido salía de la caché y el
	// test dependía de quién ganaba la carrera).
	waitIdle(t, c)

	f.failNext.Store(100) // cuota agotada del todo
	_, err := fetch(context.Background(), "bytes=2000-2999")
	if !errors.Is(err, ErrDownloadQuotaExceeded) {
		t.Fatalf("se esperaba ErrDownloadQuotaExceeded, llegó %v", err)
	}
	var se *StreamStatusError
	if errors.As(err, &se) {
		t.Fatal("el error no debe ser reintentable otra vez por el lector por bloques")
	}
}

func TestBlockCacheConProxyPorBloques(t *testing.T) {
	f := &cacheUpstream{data: testData(9_000)}
	c := newTestCache(t, 1000, 1<<30)
	cr, err := OpenChunkedRange(context.Background(), c.Fetcher("fileF", f.fetch), 250, -1, 3000)
	if err != nil {
		t.Fatal(err)
	}
	got, err := io.ReadAll(cr.Body)
	_ = cr.Body.Close()
	if err != nil || !bytes.Equal(got, f.data[250:]) || cr.Total != 9000 {
		t.Fatalf("lectura por el proxy incorrecta: %d bytes, total %d, err %v", len(got), cr.Total, err)
	}
}
