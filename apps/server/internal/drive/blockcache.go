package drive

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"kamehouse/internal/util"

	"github.com/shirou/gopsutil/v4/disk"
)

// BlockCache keeps pieces of Drive files on local disk so each byte is
// downloaded from Drive once: rewatching, seeking back, resuming, the MKV
// header/Cues read on every open and the transcoder re-reading the source are
// all served from disk. Besides being faster, it is what keeps the file's daily
// download quota ("downloadQuotaExceeded") from running out.
//
// Files are split in fixed, aligned blocks. A missing block is downloaded once
// (concurrent readers share the download) and streamed to readers as it
// arrives, so a seek does not wait for the whole block. Sequential readers pull
// the next blocks ahead. The cache is bounded: least recently used blocks are
// evicted when it grows past maxBytes.
type BlockCache struct {
	dir          string
	blockSize    int64
	maxBytes     int64
	fetchTimeout time.Duration

	mu         sync.Mutex
	inflight   map[string]*blockDownload
	meta       map[string]blockFileMeta
	revisions  map[string]string // file ID -> immutable cache namespace for its revision
	used       int64
	generation uint64 // guarded by mu; Clear retires earlier downloads
	evicting   atomic.Bool
	writeMu    sync.Mutex // serialize admission, eviction and block writes
	freeBytes  func(string) (uint64, error)
}

type blockFileMeta struct {
	Size        int64  `json:"size"`
	ContentType string `json:"contentType,omitempty"`
}

// DefaultBlockSize balances Drive's per-request latency (~0.5 s to first byte)
// against the bytes pulled for a small read (the Cues, a seek).
const DefaultBlockSize int64 = 16 << 20

// DefaultBlockCacheMaxBytes bounds the disk used by the Drive block cache.
const DefaultBlockCacheMaxBytes int64 = 2 << 30

// Keep room for Windows, updates and the other KameHouse installation.
const blockCacheDiskReserve uint64 = 10 << 30

// NewBlockCache opens (or creates) a cache in dir.
func NewBlockCache(dir string, blockSize, maxBytes int64) (*BlockCache, error) {
	if blockSize <= 0 {
		blockSize = DefaultBlockSize
	}
	if maxBytes <= 0 {
		maxBytes = DefaultBlockCacheMaxBytes
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	c := &BlockCache{
		dir:          dir,
		blockSize:    blockSize,
		maxBytes:     maxBytes,
		fetchTimeout: 2 * time.Minute,
		inflight:     make(map[string]*blockDownload),
		meta:         make(map[string]blockFileMeta),
		revisions:    make(map[string]string),
		freeBytes:    availableDiskBytes,
	}
	c.used, _ = dirSize(dir)
	c.trimForAdmission(0)
	return c, nil
}

func availableDiskBytes(path string) (uint64, error) {
	u, err := disk.Usage(path)
	if err != nil {
		return 0, err
	}
	return u.Free, nil
}

// Called under writeMu (or during construction). Failed space queries disable
// persistence, but readers can still consume the downloaded block in memory.
func (c *BlockCache) trimForAdmission(length int64) bool {
	c.mu.Lock()
	used := c.used
	c.mu.Unlock()
	if used+length > c.maxBytes {
		c.evictTo(max(int64(0), c.maxBytes/10*9-length))
	}
	free, err := c.freeBytes(c.dir)
	if err != nil {
		return false
	}
	required := blockCacheDiskReserve + uint64(length)
	if free < required {
		c.mu.Lock()
		used = c.used
		c.mu.Unlock()
		shortfall := int64(required - free)
		if shortfall > used {
			// Aunque se vacíe toda la caché no se llega a la reserva de disco: no se
			// borra nada, para no dejar la caché vacía sin ganar espacio.
			return false
		}
		c.evictTo(used - shortfall)
		free, err = c.freeBytes(c.dir)
	}
	c.mu.Lock()
	fits := c.used+length <= c.maxBytes
	c.mu.Unlock()
	return fits && err == nil && free >= required
}

func (c *BlockCache) persistBlockGeneration(path string, data []byte, generation uint64) {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	if generation != c.currentGeneration() {
		return
	}
	length := int64(len(data))
	if !c.trimForAdmission(length) {
		return
	}
	var previous int64
	if info, err := os.Stat(path); err == nil {
		previous = info.Size()
	}
	if util.WriteFileAtomic(path, data) == nil {
		c.mu.Lock()
		c.used += length - previous
		c.mu.Unlock()
	}
}

// Dir is where the cache lives.
func (c *BlockCache) Dir() string { return c.dir }

// Stats reports the bytes and blocks stored on disk.
func (c *BlockCache) Stats() (bytes int64, blocks int) {
	_ = filepath.Walk(c.dir, func(_ string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() && strings.HasSuffix(info.Name(), ".blk") {
			bytes += info.Size()
			blocks++
		}
		return nil
	})
	return bytes, blocks
}

// Clear removes every cached block. Earlier readers can finish in memory, but
// their downloads cannot repopulate the cache or be joined by new readers.
func (c *BlockCache) Clear() (freed int64, count int) {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	c.mu.Lock()
	c.generation++
	c.mu.Unlock()
	freed, count = c.Stats()
	entries, _ := os.ReadDir(c.dir)
	for _, e := range entries {
		_ = os.RemoveAll(filepath.Join(c.dir, e.Name()))
	}
	used, _ := dirSize(c.dir)
	c.mu.Lock()
	c.meta = make(map[string]blockFileMeta)
	c.used = used
	c.mu.Unlock()
	return freed, count
}

// Validate drops the cached blocks of fileID when its current size in Drive
// (from the file metadata, which does not count against the download quota)
// differs from the cached one.
func (c *BlockCache) Validate(fileID string, size int64) {
	if size <= 0 || !safeFileID(fileID) {
		return
	}
	if m, ok := c.fileMeta(fileID); ok && m.Size != size {
		c.setFileMeta(fileID, blockFileMeta{Size: size, ContentType: m.ContentType})
	}
}

// ValidateRevision isolates disk blocks and in-flight downloads of each Drive
// revision. An old download can finish, but can never populate the new namespace.
func (c *BlockCache) ValidateRevision(fileID string, size int64, revision string) {
	if !safeFileID(fileID) || revision == "" {
		c.Validate(fileID, size)
		return
	}
	key := "rev_" + util.CreateMD5(fileID+"\x00"+revision)
	c.mu.Lock()
	c.revisions[fileID] = key
	c.mu.Unlock()
	c.Validate(key, size)
}

func (c *BlockCache) revisionKey(fileID string) string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if key := c.revisions[fileID]; key != "" {
		return key
	}
	return fileID
}

// WaitIdle espera (hasta timeout) a que no queden descargas de bloques en curso; devuelve
// false si siguen. Sirve para cerrar con orden y para que las pruebas puedan borrar su
// carpeta temporal sin competir con una escritura de bloque.
func (c *BlockCache) WaitIdle(timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for c.inflightCount() > 0 {
		if time.Now().After(deadline) {
			return false
		}
		time.Sleep(5 * time.Millisecond)
	}
	return true
}

func (c *BlockCache) inflightCount() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.inflight)
}

func (c *BlockCache) currentGeneration() uint64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.generation
}

// Fetcher wraps upstream (one Drive request per call) so ranges of fileID are
// served from the cache. The returned responses are always 206 with a
// Content-Range; only "bytes=S-E" and "bytes=S-" are cached, anything else goes
// straight to upstream.
func (c *BlockCache) Fetcher(fileID string, upstream RangeFetcher) RangeFetcher {
	return func(ctx context.Context, header string) (*http.Response, error) {
		return c.fetcher(c.revisionKey(fileID), upstream, false)(ctx, header)
	}
}

// FetcherWithoutReadAhead reuses cached blocks without speculative downloads.
// Sparse thumbnail seeks need only the blocks actually read by the decoder.
func (c *BlockCache) FetcherWithoutReadAhead(fileID string, upstream RangeFetcher) RangeFetcher {
	return func(ctx context.Context, header string) (*http.Response, error) {
		return c.fetcher(c.revisionKey(fileID), upstream, true)(ctx, header)
	}
}

func (c *BlockCache) fetcher(fileID string, upstream RangeFetcher, noReadAhead bool) RangeFetcher {
	up := retryingFetch(upstream)
	return func(ctx context.Context, rangeHeader string) (*http.Response, error) {
		generation := c.currentGeneration()
		start, end, hasRange, simple := parseByteRange(rangeHeader)
		if !simple || !hasRange || !safeFileID(fileID) {
			return upstream(ctx, rangeHeader)
		}

		meta, known := c.fileMeta(fileID)
		var initial *blockDownload
		if !known || !c.hasBlock(fileID, start/c.blockSize, meta) {
			// Aunque start pase el tamaño conocido se consulta a Drive: si el
			// archivo creció, la respuesta trae el tamaño nuevo.
			d := c.download(fileID, start/c.blockSize, up, generation)
			select {
			case <-d.ready:
			case <-ctx.Done():
				return nil, ctx.Err()
			}
			if err := d.startErr(); err != nil {
				var se *StreamStatusError
				if errors.As(err, &se) && se.Status == http.StatusRequestedRangeNotSatisfiable {
					return notSatisfiable(-1), nil
				}
				// Upstream retries already ran: hide the status error from the
				// caller's own retry loop but keep errors.Is(ErrDownloadQuotaExceeded).
				return nil, &exhaustedError{err: err}
			}
			// The download owns this metadata even if Clear has retired its
			// disk namespace while the caller was waiting for response headers.
			meta = d.meta
			initial = d
		}

		if start >= meta.Size {
			return notSatisfiable(meta.Size), nil
		}
		if end < 0 || end >= meta.Size {
			end = meta.Size - 1
		}
		h := http.Header{}
		h.Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, meta.Size))
		if meta.ContentType != "" {
			h.Set("Content-Type", meta.ContentType)
		}
		return &http.Response{
			StatusCode:    http.StatusPartialContent,
			Header:        h,
			ContentLength: end - start + 1,
			Body:          &blockReader{c: c, ctx: ctx, fileID: fileID, up: up, pos: start, end: end, size: meta.Size, curIdx: -1, noReadAhead: noReadAhead, generation: generation, initial: initial},
		}, nil
	}
}

func notSatisfiable(size int64) *http.Response {
	h := http.Header{}
	if size >= 0 {
		h.Set("Content-Range", fmt.Sprintf("bytes */%d", size))
	}
	return &http.Response{StatusCode: http.StatusRequestedRangeNotSatisfiable, Header: h, Body: io.NopCloser(strings.NewReader(""))}
}

// exhaustedError carries an upstream failure whose retries already ran. It
// matches errors.Is targets of the wrapped error (quota) but is not an
// *StreamStatusError, so retryingFetch does not retry it again.
type exhaustedError struct{ err error }

func (e *exhaustedError) Error() string        { return e.err.Error() }
func (e *exhaustedError) Is(target error) bool { return errors.Is(e.err, target) }

// DriveErrorKind and DriveStatus expose the wrapped answer (the type has no Unwrap on
// purpose, see above) to callers that report why a read failed.
func (e *exhaustedError) DriveErrorKind() string {
	var se *StreamStatusError
	if errors.As(e.err, &se) {
		return se.DriveErrorKind()
	}
	var ne net.Error
	if errors.As(e.err, &ne) || errors.Is(e.err, context.DeadlineExceeded) || errors.Is(e.err, io.ErrUnexpectedEOF) {
		return ErrKindNetwork
	}
	return ErrKindOther
}

func (e *exhaustedError) DriveStatus() int {
	var se *StreamStatusError
	if errors.As(e.err, &se) {
		return se.Status
	}
	return 0
}

// ─── Blocks on disk ──────────────────────────────────────────────────────────

// ValidFileID indica si id tiene la forma de un ID de archivo de Drive
// (alfanumérico, '-' y '_'). Todo ID que venga del cliente pasa por acá antes
// de armar una URL de la API o un LIKE de SQL.
func ValidFileID(id string) bool { return safeFileID(id) }

func safeFileID(id string) bool {
	if id == "" || len(id) > 200 {
		return false
	}
	for _, r := range id {
		if !(r == '-' || r == '_' || r >= '0' && r <= '9' || r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z') {
			return false
		}
	}
	return true
}

func (c *BlockCache) fileDir(fileID string) string { return filepath.Join(c.dir, fileID) }

// blockPath lleva el tamaño del archivo en el nombre: si el archivo cambia en
// Drive, los bloques viejos que no se pudieron borrar (en Windows un bloque
// abierto por un lector no se borra) no coinciden y nunca se sirven.
func (c *BlockCache) blockPath(fileID string, size, idx int64) string {
	return filepath.Join(c.fileDir(fileID), strconv.FormatInt(size, 10)+"-"+strconv.FormatInt(idx, 10)+".blk")
}

func (c *BlockCache) blockLen(idx, size int64) int64 {
	return min(c.blockSize, size-idx*c.blockSize)
}

func (c *BlockCache) hasBlock(fileID string, idx int64, meta blockFileMeta) bool {
	if idx*c.blockSize >= meta.Size {
		return false
	}
	info, err := os.Stat(c.blockPath(fileID, meta.Size, idx))
	return err == nil && info.Size() == c.blockLen(idx, meta.Size)
}

func (c *BlockCache) fileMeta(fileID string) (blockFileMeta, bool) {
	c.mu.Lock()
	m, ok := c.meta[fileID]
	generation := c.generation
	c.mu.Unlock()
	if ok {
		return m, true
	}
	raw, err := os.ReadFile(filepath.Join(c.fileDir(fileID), "meta.json"))
	if err != nil || json.Unmarshal(raw, &m) != nil || m.Size <= 0 {
		return blockFileMeta{}, false
	}
	c.mu.Lock()
	if generation != c.generation {
		c.mu.Unlock()
		return blockFileMeta{}, false
	}
	// A concurrent upstream response may have published fresher metadata
	// while this reader was loading the previous on-disk copy.
	if current, ok := c.meta[fileID]; ok {
		c.mu.Unlock()
		return current, true
	}
	c.meta[fileID] = m
	c.mu.Unlock()
	return m, true
}

// setFileMeta records the size seen upstream. A different size means the file
// changed in Drive: its cached blocks are dropped.
func (c *BlockCache) setFileMeta(fileID string, m blockFileMeta) {
	c.setFileMetaGeneration(fileID, m, c.currentGeneration())
}

func (c *BlockCache) setFileMetaGeneration(fileID string, m blockFileMeta, generation uint64) {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	if generation != c.currentGeneration() {
		return
	}
	if old, ok := c.fileMeta(fileID); ok && old.Size != m.Size {
		_ = os.RemoveAll(c.fileDir(fileID))
		used, _ := dirSize(c.dir)
		c.mu.Lock()
		c.used = used
		c.mu.Unlock()
	} else if ok && old == m {
		return
	}
	_ = os.MkdirAll(c.fileDir(fileID), 0o755)
	if raw, err := json.Marshal(m); err == nil {
		_ = util.WriteFileAtomic(filepath.Join(c.fileDir(fileID), "meta.json"), raw)
	}
	c.mu.Lock()
	c.meta[fileID] = m
	c.mu.Unlock()
}

func dirSize(dir string) (int64, error) {
	var total int64
	err := filepath.Walk(dir, func(_ string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			total += info.Size()
		}
		return nil
	})
	return total, err
}

// evictTo removes least recently used blocks down to target bytes. Blocks still
// open for reading may fail to delete: they are skipped. Caller holds writeMu.
func (c *BlockCache) evictTo(target int64) {
	// Una sola pasada a la vez: varias descargas que terminan pasadas del tope recorrian el
	// directorio y borraban los mismos bloques en paralelo.
	if !c.evicting.CompareAndSwap(false, true) {
		return
	}
	defer c.evicting.Store(false)

	type blk struct {
		path string
		size int64
		mod  time.Time
	}
	var blocks []blk
	_ = filepath.Walk(c.dir, func(p string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() && strings.HasSuffix(info.Name(), ".blk") {
			blocks = append(blocks, blk{p, info.Size(), info.ModTime()})
		}
		return nil
	})
	sort.Slice(blocks, func(i, j int) bool { return blocks[i].mod.Before(blocks[j].mod) })
	c.mu.Lock()
	excess := c.used - target
	c.mu.Unlock()

	// Borrar bloques es E/S de disco: se hace sin c.mu, que toman fileMeta y download en cada
	// pedido de rango de un reproductor.
	var freed int64
	for _, b := range blocks {
		if freed >= excess {
			break
		}
		if os.Remove(b.path) == nil {
			freed += b.size
		}
	}
	c.mu.Lock()
	c.used -= freed
	c.mu.Unlock()
}

// ─── Downloads ───────────────────────────────────────────────────────────────

// blockDownload is one block being fetched from Drive. Readers read what has
// arrived so far from memory; once complete it is written to disk.
type blockDownload struct {
	mu      sync.Mutex
	buf     []byte
	n       int
	done    bool
	err     error
	changed chan struct{} // closed and replaced on every update
	ready   chan struct{} // closed once the length is known or the start failed
	meta    blockFileMeta // immutable once ready is closed
}

func (d *blockDownload) notify() {
	close(d.changed)
	d.changed = make(chan struct{})
}

func (d *blockDownload) startErr() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.buf == nil {
		return d.err
	}
	return nil
}

// readAt copies bytes at off, waiting for them to arrive.
func (d *blockDownload) readAt(ctx context.Context, p []byte, off int) (int, error) {
	for {
		d.mu.Lock()
		if off < d.n {
			n := copy(p, d.buf[off:d.n])
			d.mu.Unlock()
			return n, nil
		}
		if d.err != nil {
			err := d.err
			d.mu.Unlock()
			return 0, err
		}
		if d.done {
			d.mu.Unlock()
			return 0, io.ErrUnexpectedEOF
		}
		ch := d.changed
		d.mu.Unlock()
		select {
		case <-ch:
		case <-ctx.Done():
			return 0, ctx.Err()
		}
	}
}

// download starts (or joins) the download of block idx.
func (c *BlockCache) download(fileID string, idx int64, up RangeFetcher, generation uint64) *blockDownload {
	key := strconv.FormatUint(generation, 10) + "/" + fileID + "/" + strconv.FormatInt(idx, 10)
	c.mu.Lock()
	if d, ok := c.inflight[key]; ok {
		c.mu.Unlock()
		return d
	}
	d := &blockDownload{changed: make(chan struct{}), ready: make(chan struct{})}
	c.inflight[key] = d
	c.mu.Unlock()
	go c.runDownload(key, fileID, idx, d, up, generation)
	return d
}

func (c *BlockCache) runDownload(key, fileID string, idx int64, d *blockDownload, up RangeFetcher, generation uint64) {
	fail := func(err error) {
		d.mu.Lock()
		d.err = err
		d.notify()
		d.mu.Unlock()
		select {
		case <-d.ready:
		default:
			close(d.ready)
		}
		c.mu.Lock()
		delete(c.inflight, key)
		c.mu.Unlock()
	}
	defer func() {
		if r := recover(); r != nil {
			fail(fmt.Errorf("drive: panic downloading block: %v", r))
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), c.fetchTimeout)
	defer cancel()
	start := idx * c.blockSize
	resp, err := up(ctx, fmt.Sprintf("bytes=%d-%d", start, start+c.blockSize-1))
	if err != nil {
		fail(err)
		return
	}
	defer resp.Body.Close()
	last, total, err := validatePartialRange(resp, start, start+c.blockSize-1, -1)
	if err != nil {
		fail(err)
		return
	}
	if last != min(start+c.blockSize-1, total-1) {
		fail(fmt.Errorf("drive: incomplete block Content-Range %q", resp.Header.Get("Content-Range")))
		return
	}
	d.meta = blockFileMeta{Size: total, ContentType: resp.Header.Get("Content-Type")}
	c.setFileMetaGeneration(fileID, d.meta, generation)

	length := c.blockLen(idx, total)
	d.mu.Lock()
	d.buf = make([]byte, length)
	d.mu.Unlock()
	close(d.ready)

	for d.n < len(d.buf) {
		n, rerr := resp.Body.Read(d.buf[d.n:])
		d.mu.Lock()
		d.n += n
		d.notify()
		d.mu.Unlock()
		if rerr != nil {
			if d.n < len(d.buf) {
				if errors.Is(rerr, io.EOF) {
					rerr = io.ErrUnexpectedEOF
				}
				fail(rerr)
				return
			}
			break
		}
	}

	c.persistBlockGeneration(c.blockPath(fileID, total, idx), d.buf, generation)
	d.mu.Lock()
	d.done = true
	d.notify()
	d.mu.Unlock()
	c.mu.Lock()
	delete(c.inflight, key)
	c.mu.Unlock()
}

// prefetch starts downloading block idx if it is neither cached nor in flight.
func (c *BlockCache) prefetch(fileID string, idx, size int64, up RangeFetcher, generation uint64) {
	if idx*c.blockSize >= size || (generation == c.currentGeneration() && c.hasBlock(fileID, idx, blockFileMeta{Size: size})) {
		return
	}
	c.download(fileID, idx, up, generation)
}

// ─── Reader ──────────────────────────────────────────────────────────────────

// blockReader streams [pos, end] of a file, block by block, from disk or from
// the in-flight download.
type blockReader struct {
	noReadAhead bool
	c           *BlockCache
	ctx         context.Context
	fileID      string
	up          RangeFetcher
	pos         int64
	end         int64
	size        int64

	curIdx     int64
	file       *os.File
	dl         *blockDownload
	closed     bool
	generation uint64
	initial    *blockDownload
}

// readAhead is how many following blocks a sequential reader pulls ahead.
const readAhead = 2

func (r *blockReader) Read(p []byte) (int, error) {
	if r.closed {
		return 0, io.ErrClosedPipe
	}
	if r.pos > r.end {
		return 0, io.EOF
	}
	idx := r.pos / r.c.blockSize
	if idx != r.curIdx {
		sequential := r.curIdx >= 0 && idx == r.curIdx+1
		if err := r.open(idx); err != nil {
			return 0, err
		}
		ahead := int64(1)
		if sequential {
			ahead = readAhead
		}
		if r.noReadAhead {
			ahead = 0
		}
		for i := int64(1); i <= ahead; i++ {
			r.c.prefetch(r.fileID, idx+i, r.size, r.up, r.generation)
		}
	}
	off := r.pos - idx*r.c.blockSize
	blockEnd := min(r.c.blockLen(idx, r.size), r.end-idx*r.c.blockSize+1)
	if want := blockEnd - off; int64(len(p)) > want {
		p = p[:want]
	}

	var n int
	var err error
	if r.file != nil {
		n, err = r.file.ReadAt(p, off)
		if errors.Is(err, io.EOF) && n > 0 {
			err = nil
		}
	} else {
		n, err = r.dl.readAt(r.ctx, p, int(off))
	}
	r.pos += int64(n)
	return n, err
}

func (r *blockReader) open(idx int64) error {
	r.release()
	r.curIdx = -1
	meta := blockFileMeta{Size: r.size}
	d := r.initial
	r.initial = nil
	if d == nil && r.generation == r.c.currentGeneration() && r.c.hasBlock(r.fileID, idx, meta) {
		path := r.c.blockPath(r.fileID, r.size, idx)
		if f, err := os.Open(path); err == nil {
			r.file = f
			r.curIdx = idx
			now := time.Now()
			_ = os.Chtimes(path, now, now) // recency for eviction
			return nil
		}
	}
	if d == nil {
		d = r.c.download(r.fileID, idx, r.up, r.generation)
	}
	select {
	case <-d.ready:
	case <-r.ctx.Done():
		return r.ctx.Err()
	}
	if err := d.startErr(); err != nil {
		return err
	}
	r.dl = d
	r.curIdx = idx
	return nil
}

func (r *blockReader) release() {
	if r.file != nil {
		_ = r.file.Close()
		r.file = nil
	}
	r.dl = nil
}

func (r *blockReader) Close() error {
	r.closed = true
	r.release()
	return nil
}

// parseByteRange parses "bytes=S-E" / "bytes=S-" (end -1). An empty header is
// the whole file (hasRange=false). simple=false for suffix or multi-ranges.
func parseByteRange(h string) (start, end int64, hasRange, simple bool) {
	if h == "" {
		return 0, -1, false, true
	}
	spec, ok := strings.CutPrefix(strings.TrimSpace(h), "bytes=")
	if !ok || strings.Contains(spec, ",") {
		return 0, 0, true, false
	}
	a, b, ok := strings.Cut(spec, "-")
	if !ok || a == "" {
		return 0, 0, true, false
	}
	start, err := strconv.ParseInt(strings.TrimSpace(a), 10, 64)
	if err != nil || start < 0 {
		return 0, 0, true, false
	}
	end = -1
	if b = strings.TrimSpace(b); b != "" {
		if end, err = strconv.ParseInt(b, 10, 64); err != nil || end < start {
			return 0, 0, true, false
		}
	}
	return start, end, true, true
}
