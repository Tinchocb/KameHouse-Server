package cassette

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"kamehouse/internal/matroska"
	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/util"
	"kamehouse/internal/util/httprange"

	"github.com/rs/zerolog"
	lru "github.com/hashicorp/golang-lru/v2"
)

// loopbackHTTPClient lee fuentes remotas servidas por el propio servidor (Drive por
// loopback). El servidor lo reemplaza con SetLoopbackHTTPClient cuando usa TLS,
// para confiar en su propio certificado.
var loopbackHTTPClient atomic.Pointer[http.Client]

// SetLoopbackHTTPClient define el cliente usado para leer fuentes remotas.
func SetLoopbackHTTPClient(c *http.Client) {
	loopbackHTTPClient.Store(c)
}

// LoopbackHTTPClient devuelve el cliente configurado o uno por defecto.
func LoopbackHTTPClient() *http.Client {
	if c := loopbackHTTPClient.Load(); c != nil {
		return c
	}
	return &http.Client{Timeout: 30 * time.Second}
}

// KeyframeIndex holds extracted keyframe timestamps
type KeyframeIndex struct {
	Sha       string    `json:"sha"`
	Keyframes []float64 `json:"keyframes"`
	IsDone    bool      `json:"isDone"`
	Err       error     `json:"-"`

	mu        sync.RWMutex
	ready     sync.WaitGroup
	listeners []func(length int)
}

// Get returns the keyframe timestamp
func (ki *KeyframeIndex) Get(idx int32) float64 {
	ki.mu.RLock()
	defer ki.mu.RUnlock()
	return ki.Keyframes[idx]
}

// Slice returns a copy of keyframe timestamps
func (ki *KeyframeIndex) Slice(start, end int32) []float64 {
	if end <= start {
		return nil
	}
	ki.mu.RLock()
	defer ki.mu.RUnlock()
	out := make([]float64, end-start)
	copy(out, ki.Keyframes[start:end])
	return out
}

// Length returns number of keyframes and status
func (ki *KeyframeIndex) Length() (int32, bool) {
	ki.mu.RLock()
	defer ki.mu.RUnlock()
	return int32(len(ki.Keyframes)), ki.IsDone
}

// GetError returns any extraction error under read lock.
func (ki *KeyframeIndex) GetError() error {
	ki.mu.RLock()
	defer ki.mu.RUnlock()
	return ki.Err
}

// SetError stores an extraction error under write lock.
func (ki *KeyframeIndex) SetError(err error) {
	ki.mu.Lock()
	defer ki.mu.Unlock()
	ki.Err = err
}

// SetDone marks the keyframe extraction as complete under write lock.
func (ki *KeyframeIndex) SetDone() {
	ki.mu.Lock()
	defer ki.mu.Unlock()
	ki.IsDone = true
}

// AddListener registers a callback invoked with the new keyframe count after
// each batch is appended. It runs outside ki.mu.
func (ki *KeyframeIndex) AddListener(fn func(length int)) {
	ki.mu.Lock()
	defer ki.mu.Unlock()
	ki.listeners = append(ki.listeners, fn)
}

// append adds a batch of keyframes, then notifies listeners outside the lock
// so they never run (or take their own locks) while ki.mu is held. The
// keyframes are published before listeners grow the segment tables, so a
// segment index is never valid before its keyframe exists.
func (ki *KeyframeIndex) append(values []float64) {
	ki.mu.Lock()
	ki.Keyframes = append(ki.Keyframes, values...)
	length := len(ki.Keyframes)
	listeners := append([]func(int){}, ki.listeners...)
	ki.mu.Unlock()

	for _, fn := range listeners {
		fn(length)
	}
}

// global keyframe cache

var (
	kfCache, _ = lru.New[string, *KeyframeIndex](200)
	kfCacheMu  sync.Mutex
)

// ClearKeyframeCache removes cached indexes
func ClearKeyframeCache() {
	kfCacheMu.Lock()
	defer kfCacheMu.Unlock()
	if kfCache != nil {
		kfCache.Purge()
	}
}

// getOrExtractKeyframes returns a keyframe index
func getOrExtractKeyframes(
	path string,
	hash string,
	settings *Settings,
	logger *zerolog.Logger,
) (*KeyframeIndex, error) {
	kfCacheMu.Lock()
	if kfCache == nil {
		kfCache, _ = lru.New[string, *KeyframeIndex](200)
	}
	if ki, ok := kfCache.Get(hash); ok {
		kfCacheMu.Unlock()
		ki.ready.Wait()
		return ki, ki.GetError()
	}

	ki := &KeyframeIndex{Sha: hash}
	ki.ready.Add(1)
	kfCache.Add(hash, ki)
	kfCacheMu.Unlock()

	var doneOnce sync.Once
	unblock := func() {
		doneOnce.Do(ki.ready.Done)
	}

	go func() {
		var err error
		defer func() {
			if r := recover(); r != nil {
				err = fmt.Errorf("panic extracting keyframes: %v", r)
				logger.Error().Msgf("cassette: %v", err)
			}
			if err != nil {
				ki.SetError(err)
				kfCacheMu.Lock()
				if kfCache != nil {
					kfCache.Remove(hash)
				}
				kfCacheMu.Unlock()
			}
			unblock()
		}()

		diskPath := filepath.Join(settings.KeyframeCacheDir, hash+".json")

		// Try disk cache first
		if err = getSavedInfo(diskPath, ki); err == nil {
			logger.Trace().Msg("cassette: keyframes disk cache HIT")
			ki.SetDone()
			return
		}

		// Extract from the file
		if err = extractKeyframes(settings.FfprobePath, path, ki, hash, unblock, logger); err == nil {
			ki.SetDone()
			_ = saveInfo(diskPath, ki)
		}
	}()

	ki.ready.Wait()
	return ki, ki.GetError()
}
// extractKeyframes probes the file for keyframes
func extractKeyframes(
	ffprobePath string,
	path string,
	ki *KeyframeIndex,
	hash string,
	unblock func(),
	logger *zerolog.Logger,
) error {
	// Try parsing via pure Go Matroska parser for MKV/WebM files first (much faster than ffprobe)
	// PathExt contempla URLs remotas (fuentes de Drive servidas por loopback),
	// cuya ruta no tiene extensión pero la informan en el parámetro `ext`.
	ext := videofile.PathExt(path)
	if ext == ".mkv" || ext == ".webm" {
		if err := extractKeyframesFromMatroska(path, ki, unblock, logger); err == nil {
			return nil
		}
		// If Matroska parsing failed or has no cues, fallback to ffprobe
		logger.Debug().Msgf("cassette: Go matroska parser failed for %s, falling back to ffprobe", path)
	}

	defer printExecTime(logger, "ffprobe keyframe analysis for %s", path)()

	probeBin := ffprobePath
	if probeBin == "" {
		probeBin = "ffprobe"
	}

	// Optimize keyframe extraction by reading packet headers (avoids decoding the video)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	cmd := util.NewCmdCtx(
		ctx,
		probeBin,
		"-loglevel", "error",
		"-select_streams", "v:0",
		"-show_entries", "packet=pts_time,flags",
		"-of", "csv=print_section=0",
		path,
	)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		_ = stdout.Close()
		return err
	}
	defer func() {
		cancel()
		_ = stdout.Close()
		_ = cmd.Wait()
	}()

	scanner := bufio.NewScanner(stdout)
	buf := make([]float64, 0, 1000)
	batchSize := 100
	flushed := int32(0)

	flush := func(final bool) {
		if len(buf) == 0 && !final {
			return
		}
		ki.append(buf)
		flushed += int32(len(buf))
		unblock()
		buf = buf[:0]
		// After the first 500 keyframes increase batch size to reduce
		// listener overhead on long files
		if flushed >= 500 {
			batchSize = 500
		}
	}

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		// Support both raw PTS (new) and "PTS,flags" (legacy)
		pts := line
		if idx := strings.IndexByte(line, ','); idx != -1 {
			pts = line[:idx]
			flags := line[idx+1:]
			if len(flags) == 0 || flags[0] != 'K' {
				continue
			}
		}
		if pts == "N/A" {
			break
		}
		fpts, err := strconv.ParseFloat(pts, 64)
		if err != nil {
			return err
		}
		buf = append(buf, fpts)
		if len(buf) >= batchSize {
			flush(false)
		}
	}

	if err := scanner.Err(); err != nil {
		logger.Error().Err(err).Msg("cassette: scanner error during keyframe extraction")
		return err
	}

	// Handle files with <=1 keyframe
	if flushed == 0 && len(buf) < 2 {
		dummy, err := makeDummyKeyframes(ffprobePath, path, hash)
		if err != nil {
			return err
		}
		buf = dummy
	}

	flush(true)
	ki.SetDone()
	return nil
}
// makeDummyKeyframes at 2s intervals
func makeDummyKeyframes(ffprobePath, path, hash string) ([]float64, error) {
	const interval = 2.0
	info, err := videofile.FfprobeGetInfo(ffprobePath, path, hash)
	if err != nil {
		return nil, err
	}
	n := int(float64(info.Duration)/interval) + 1
	out := make([]float64, n)
	for i := range out {
		out[i] = float64(i) * interval
	}
	return out, nil
}

// extractKeyframesFromMatroska parses MKV/WebM cues directly (takes only milliseconds)
func extractKeyframesFromMatroska(path string, ki *KeyframeIndex, unblock func(), logger *zerolog.Logger) error {
	start := time.Now()
	var file io.ReadSeeker
	if httprange.IsRemote(path) {
		// Fuente remota: se leen por Range solo la cabecera, el SeekHead y los Cues.
		// El fallback a ffprobe descargaría el archivo entero para listar keyframes.
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		rr, err := httprange.Open(ctx, LoopbackHTTPClient(), path)
		if err != nil {
			return err
		}
		defer rr.Close()
		file = rr
		defer func() {
			logger.Debug().Int("requests", rr.Requests).Msg("cassette: remote matroska cues read over HTTP Range")
		}()
	} else {
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		file = f
	}

	demuxer, err := matroska.NewDemuxer(file)
	if err != nil {
		return err
	}
	defer demuxer.Close()

	cues := demuxer.GetCues()
	if len(cues) == 0 {
		return fmt.Errorf("no cues found in matroska file")
	}

	buf := make([]float64, len(cues))
	for i, cue := range cues {
		buf[i] = float64(cue.Time) / 1e9
	}

	ki.append(buf)
	unblock()
	ki.SetDone()

	logger.Info().
		Int("keyframes", len(cues)).
		Dur("elapsed", time.Since(start)).
		Msg("cassette: keyframes extracted successfully using Go matroska parser")
	return nil
}
