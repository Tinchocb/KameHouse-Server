// Package mediastream handles HLS and direct streaming of media files, transcode preloading, and subtitle extraction.
package mediastream

import (
	"context"
	"errors"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/events"
	"kamehouse/internal/mediastream/cassette"
	"kamehouse/internal/mediastream/pretranscode"
	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/util/ffmpegutil"
	"kamehouse/internal/util/filecache"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog"
	"github.com/samber/mo"
)

type (
	Repository struct {
		transcoder         mo.Option[*cassette.Cassette]
		preTranscoder      mo.Option[*pretranscode.Manager]
		settings           mo.Option[*models.MediastreamSettings]
		playbackManager    *PlaybackManager
		mediaInfoExtractor *videofile.MediaInfoExtractor
		logger             *zerolog.Logger
		wsEventManager     events.WSEventManagerInterface
		fileCacher         *filecache.Cacher
		reqMu              sync.Mutex
		cacheDir           string // where attachments are stored
		transcodeDir       string // where stream segments are stored
		database           *db.Database
		warmingActive      atomic.Bool // guards WarmMediaInfo against overlapping runs
		settingsMu         sync.RWMutex
		// modulesMu guards transcoder and preTranscoder. They are read by every
		// HLS request while initializeTranscoder/initializePreTranscoder swap
		// them, so they must never be touched directly — use the accessors.
		modulesMu sync.RWMutex
	}

	NewRepositoryOptions struct {
		Logger         *zerolog.Logger
		WSEventManager events.WSEventManagerInterface
		FileCacher     *filecache.Cacher
		Database       *db.Database
	}
)

func NewRepository(opts *NewRepositoryOptions) *Repository {
	ret := &Repository{
		logger:             opts.Logger,
		settings:           mo.None[*models.MediastreamSettings](),
		transcoder:         mo.None[*cassette.Cassette](),
		preTranscoder:      mo.None[*pretranscode.Manager](),
		wsEventManager:     opts.WSEventManager,
		fileCacher:         opts.FileCacher,
		mediaInfoExtractor: videofile.NewMediaInfoExtractor(opts.FileCacher, opts.Logger),
		database:           opts.Database,
	}
	ret.playbackManager = NewPlaybackManager(ret)

	return ret
}

func (r *Repository) IsInitialized() bool {
	r.settingsMu.RLock()
	defer r.settingsMu.RUnlock()
	return r.settings.IsPresent()
}

func (r *Repository) GetSettings() mo.Option[*models.MediastreamSettings] {
	r.settingsMu.RLock()
	defer r.settingsMu.RUnlock()
	return r.settings
}

// getTranscoder returns the real-time transcoder, if it is running.
func (r *Repository) getTranscoder() (*cassette.Cassette, bool) {
	r.modulesMu.RLock()
	defer r.modulesMu.RUnlock()
	return r.transcoder.Get()
}

// swapTranscoder installs next and returns the previous transcoder, if any.
func (r *Repository) swapTranscoder(next mo.Option[*cassette.Cassette]) mo.Option[*cassette.Cassette] {
	r.modulesMu.Lock()
	defer r.modulesMu.Unlock()
	prev := r.transcoder
	r.transcoder = next
	return prev
}

// swapPreTranscoder installs next and returns the previous manager, if any.
func (r *Repository) swapPreTranscoder(next mo.Option[*pretranscode.Manager]) mo.Option[*pretranscode.Manager] {
	r.modulesMu.Lock()
	defer r.modulesMu.Unlock()
	prev := r.preTranscoder
	r.preTranscoder = next
	return prev
}

func (r *Repository) OnCleanup() {
	if tc, ok := r.swapTranscoder(mo.None[*cassette.Cassette]()).Get(); ok {
		tc.Destroy()
	}
	if m, ok := r.swapPreTranscoder(mo.None[*pretranscode.Manager]()).Get(); ok {
		m.Stop()
	}
}

func (r *Repository) InitializeModules(settings *models.MediastreamSettings, cacheDir string, transcodeDir string) {
	if settings == nil {
		r.logger.Error().Msg("mediastream: Settings not present")
		return
	}
	// Create the temp directory
	err := os.MkdirAll(transcodeDir, 0755)
	if err != nil {
		r.logger.Error().Err(err).Msg("mediastream: Failed to create transcode directory")
	}

	settings.FfmpegPath = ffmpegutil.ResolveFFmpegPath(cacheDir, settings.FfmpegPath)
	settings.FfprobePath = ffmpegutil.ResolveFFprobePath(cacheDir, settings.FfprobePath)

	r.settingsMu.Lock()
	r.settings = mo.Some(settings)
	r.cacheDir = cacheDir
	r.transcodeDir = transcodeDir
	currentSettings := r.settings
	r.settingsMu.Unlock()

	// Initialize the transcoder (respects the TranscodeEnabled setting on startup)
	_ = r.initializeTranscoder(currentSettings, false)

	// Initialize the pre-transcoder (respects the PreTranscodeEnabled setting)
	r.initializePreTranscoder(settings)

	// Purge stale transcode directory leftovers on startup
	r.ClearTranscodeDir()

	r.logger.Info().Msg("mediastream: Module initialized")
}

// PreTranscodeDir returns the base directory holding pre-transcoded output. The
// user may point it at a roomy disk (Settings → Streaming); otherwise it lives
// beside the rest of the cache, which is also where the "optimized" stream type
// has always looked.
func (r *Repository) PreTranscodeDir() string {
	r.settingsMu.RLock()
	defer r.settingsMu.RUnlock()
	if r.settings.IsPresent() {
		if s := r.settings.MustGet(); s != nil && strings.TrimSpace(s.PreTranscodeLibraryDir) != "" {
			return strings.TrimSpace(s.PreTranscodeLibraryDir)
		}
	}
	return filepath.Join(r.cacheDir, "optimized")
}

// initializePreTranscoder (re)builds the pre-transcode manager from settings. A
// previous manager is stopped first so a settings change doesn't leave orphan
// ffmpeg processes writing to the old directory.
func (r *Repository) initializePreTranscoder(settings *models.MediastreamSettings) {
	if prev, ok := r.swapPreTranscoder(mo.None[*pretranscode.Manager]()).Get(); ok {
		prev.Stop()
	}

	if !settings.PreTranscodeEnabled {
		r.logger.Debug().Msg("mediastream: Pre-transcoding is disabled")
		return
	}

	outputDir := r.PreTranscodeDir()
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		r.logger.Error().Err(err).Str("dir", outputDir).Msg("mediastream: Could not create pre-transcode directory, pre-transcoding stays off")
		return
	}

	m := pretranscode.New(pretranscode.Options{
		Logger:      r.logger,
		OutputDir:   outputDir,
		FfmpegPath:  settings.FfmpegPath,
		FfprobePath: settings.FfprobePath,
		HwAccel: cassette.HwAccelOptions{
			Kind:           settings.TranscodeHwAccel,
			Preset:         settings.TranscodePreset,
			CustomSettings: settings.TranscodeHwAccelCustomSettings,
		},
		// Pre-transcoding is background work: keep it to a single ffmpeg so it can't
		// starve a live playback transcode of CPU/GPU.
		Concurrency: 1,
		Extractor:   r.mediaInfoExtractor,
	})
	m.Start()

	r.swapPreTranscoder(mo.Some(m))
}

// PreTranscoder returns the pre-transcode manager, present only while the
// feature is enabled in settings.
func (r *Repository) PreTranscoder() (*pretranscode.Manager, bool) {
	r.modulesMu.RLock()
	defer r.modulesMu.RUnlock()
	return r.preTranscoder.Get()
}

// TranscoderStats returns the metrics from the real-time transcoder engine,
// or false if the engine is dormant/disabled.
func (r *Repository) TranscoderStats() (cassette.GovernorStats, bool) {
	if tc, ok := r.getTranscoder(); ok {
		return tc.GovernorStats(), true
	}
	return cassette.GovernorStats{}, false
}

// WarmMediaInfo pre-extracts and caches media info (ffprobe) for the given files
// using a small worker pool, so the first play of any file skips the cold-start
// ffprobe. GetInfo is cache-aware (30-day disk TTL keyed by path hash), so
// already-warmed files are near-free. Best-effort: failures are logged at debug
// and never block. Safe to call from a goroutine; overlapping calls are skipped.
// GetMediaInfo devuelve la media info (ffprobe, cacheada por hash) de una ruta
// local o de una URL remota. La usan las fuentes que no pasan por el playback
// manager, como la reproducción directa de Google Drive.
func (r *Repository) GetMediaInfo(path string) (*videofile.MediaInfo, error) {
	if !r.IsInitialized() {
		return nil, errors.New("module not initialized")
	}
	r.settingsMu.RLock()
	if !r.settings.IsPresent() {
		r.settingsMu.RUnlock()
		return nil, errors.New("mediastream settings not loaded")
	}
	ffprobePath := r.settings.MustGet().FfprobePath
	r.settingsMu.RUnlock()
	return r.mediaInfoExtractor.GetInfo(ffprobePath, path)
}

func (r *Repository) WarmMediaInfo(paths []string) {
	if !r.IsInitialized() || len(paths) == 0 {
		return
	}
	if !r.warmingActive.CompareAndSwap(false, true) {
		r.logger.Debug().Msg("mediastream: Media-info warming already in progress, skipping")
		return
	}
	defer r.warmingActive.Store(false)

	r.settingsMu.RLock()
	if !r.settings.IsPresent() {
		r.settingsMu.RUnlock()
		return
	}
	ffprobePath := r.settings.MustGet().FfprobePath
	r.settingsMu.RUnlock()

	start := time.Now()
	r.logger.Info().Int("files", len(paths)).Msg("mediastream: Warming media-info cache")

	const workers = 3
	sem := make(chan struct{}, workers)
	var wg sync.WaitGroup
	var warmed atomic.Int64

	for _, p := range paths {
		if p == "" {
			continue
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(path string) {
			defer wg.Done()
			defer func() { <-sem }()
			defer func() {
				if rec := recover(); rec != nil {
					r.logger.Warn().Msgf("mediastream: panic in WarmMediaInfo worker: %v", rec)
				}
			}()
			if !r.IsInitialized() {
				return
			}
			if _, err := r.mediaInfoExtractor.GetInfo(ffprobePath, path); err != nil {
				r.logger.Debug().Err(err).Str("filepath", path).Msg("mediastream: Media-info warm failed")
				return
			}
			warmed.Add(1)
		}(p)
	}
	wg.Wait()

	r.logger.Info().
		Int64("warmed", warmed.Load()).
		Int("total", len(paths)).
		Dur("took", time.Since(start)).
		Msg("mediastream: Media-info cache warming complete")
}

// CacheWasCleared should be called when the cache directory is manually cleared.
func (r *Repository) CacheWasCleared() {
	r.playbackManager.mediaContainers.Clear()
	r.playbackManager.clientMediaContainers.Clear()
}

func (r *Repository) ClearTranscodeDir() {
	r.reqMu.Lock()
	defer r.reqMu.Unlock()

	r.logger.Trace().Msg("mediastream: Clearing transcode directory")

	r.settingsMu.RLock()
	transDir := r.transcodeDir
	r.settingsMu.RUnlock()

	// Empty the transcode directory
	if transDir != "" {
		files, err := os.ReadDir(transDir)
		if err != nil {
			r.logger.Error().Err(err).Msg("mediastream: Failed to read transcode directory")
			return
		}

		for _, file := range files {
			err = os.RemoveAll(filepath.Join(transDir, file.Name()))
			if err != nil {
				r.logger.Error().Err(err).Msg("mediastream: Failed to remove file from transcode directory")
			}
		}
	}

	r.logger.Debug().Msg("mediastream: Transcode directory cleared")

	r.playbackManager.mediaContainers.Clear()
	r.playbackManager.clientMediaContainers.Clear()
}

// ActiveVideoFileHashes returns a set of file hashes currently active in media containers.
// This is used by the filecacher to avoid pruning actively playing video files.
func (r *Repository) ActiveVideoFileHashes() map[string]struct{} {
	hashes := make(map[string]struct{})

	// Collect from mediaContainers
	r.playbackManager.mediaContainers.Range(func(_ string, mc *MediaContainer) bool {
		if mc != nil && mc.MediaInfo != nil {
			hashes[mc.MediaInfo.Sha] = struct{}{}
		}
		return true
	})

	// Collect from clientMediaContainers
	r.playbackManager.clientMediaContainers.Range(func(_ string, mc *MediaContainer) bool {
		if mc != nil && mc.MediaInfo != nil {
			hashes[mc.MediaInfo.Sha] = struct{}{}
		}
		return true
	})

	return hashes
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Transcode
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (r *Repository) TranscoderIsInitialized() bool {
	_, ok := r.getTranscoder()
	return r.IsInitialized() && ok
}

// RequestTranscodeStream builds a transcode media container. When force is true the
// transcoder engine is initialized on-demand even if TranscodeEnabled is off — this is
// used for explicit user actions (e.g. switching audio track during direct play) that
// require HLS but shouldn't demand the user flip the global setting. For H264 sources
// the video is stream-copied and only the audio is re-encoded, so the cost is low.
//
// caps lets the playback manager upgrade the stream to Direct Play when the client can
// decode the file natively (see DisableAutoSwitchToDirectPlay). force=true suppresses
// that upgrade: the caller explicitly needs HLS, so caps are withheld.
func (r *Repository) RequestTranscodeStream(filepath string, clientID string, force bool, caps *ClientCapabilities) (ret *MediaContainer, err error) {
	r.logger.Debug().Str("filepath", filepath).Bool("force", force).Msg("mediastream: Transcode stream requested")

	if !r.IsInitialized() {
		return nil, errors.New("module not initialized")
	}

	// reqMu now guards ONLY transcoder initialization and ClearTranscodeDir — not the
	// whole request. The expensive newMediaContainer runs lock-free (deduped by
	// singleflight), so concurrent playback requests no longer serialize behind a
	// global mutex or each other's ffprobe.
	if _, ok := r.getTranscoder(); !ok {
		r.reqMu.Lock()
		if _, ok := r.getTranscoder(); !ok { // double-check under the lock
			settings := r.GetSettings()
			if ok := r.initializeTranscoder(settings, force); !ok {
				r.reqMu.Unlock()
				if !force && settings.IsPresent() && !settings.MustGet().TranscodeEnabled {
					return nil, errors.New("La transcodificación está desactivada. Actívala en Ajustes -> Streaming.")
				}
				return nil, errors.New("real-time transcoder not initialized, check your settings")
			}
		}
		r.reqMu.Unlock()
	}

	// force means the caller needs HLS specifically (audio-track switch): withhold caps
	// so the playback manager can't undo that by switching back to Direct Play.
	clientCaps := caps
	if force {
		caps = nil
	}

	ret, err = r.playbackManager.RequestPlayback(filepath, StreamTypeTranscode, clientID, caps)
	if err != nil {
		return
	}
	ret = r.applyVideoPassthrough(ret, clientCaps, clientID)

	return
}

// applyVideoPassthrough: when a transcode stream goes to a client that decodes
// the source video (typically HEVC on an audio-track switch from direct play, or
// a direct play rejected only for its audio codec), copy the video and re-encode
// only the audio instead of a full re-encode a heavy 4K file can't sustain in
// real time. The container is cloned: cached containers are shared by clients.
func (r *Repository) applyVideoPassthrough(ret *MediaContainer, caps *ClientCapabilities, clientID string) *MediaContainer {
	if ret == nil || ret.StreamType != StreamTypeTranscode || !canPassthroughVideo(ret.MediaInfo, caps) {
		return ret
	}
	c := *ret
	c.VideoPassthrough = true
	if clientID != "" {
		r.playbackManager.clientMediaContainers.Set(clientID, &c)
	}
	r.logger.Info().Str("filepath", c.Filepath).Msg("mediastream: Client decodes source video, copying it (audio-only transcode)")
	return &c
}

// canPassthroughVideo reports whether the source video can be copied into the
// HLS stream for this client. H.264 is already copied by the regular ladder;
// this covers HEVC, which hls.js demuxes from MPEG-TS but only plays when the
// client's decoder supports it. VP9/AV1 can't be carried in MPEG-TS.
func canPassthroughVideo(info *videofile.MediaInfo, caps *ClientCapabilities) bool {
	if caps == nil || info == nil || info.Video == nil {
		return false
	}
	switch strings.ToLower(info.Video.Codec) {
	case "hevc", "h265":
		highBitDepth := strings.Contains(info.Video.PixFmt, "10") || strings.Contains(info.Video.PixFmt, "12")
		return caps.Hevc && (!highBitDepth || caps.Hevc10Bit)
	}
	return false
}

// WarmTranscodeSession prepares, in the background, the transcode session of a
// file being played in direct play: media info and keyframe index (the cold
// part: over a minute for a heavy Drive file). Nothing is encoded and no full
// pre-transcode is queued, so it doesn't compete with playback; if the viewer
// then switches to an audio track the client can't decode, HLS starts at once.
func (r *Repository) WarmTranscodeSession(filepath string) error {
	if !r.IsInitialized() {
		return errors.New("module not initialized")
	}

	// Same as an audio-track switch: that switch forces the transcoder on even
	// when the global toggle is off, so warming it must too.
	if _, ok := r.getTranscoder(); !ok {
		r.reqMu.Lock()
		if _, ok := r.getTranscoder(); !ok {
			if ok := r.initializeTranscoder(r.GetSettings(), true); !ok {
				r.reqMu.Unlock()
				return errors.New("real-time transcoder not initialized, check your settings")
			}
		}
		r.reqMu.Unlock()
	}

	go func() {
		defer func() {
			if rec := recover(); rec != nil {
				r.logger.Warn().Interface("panic", rec).Msg("mediastream: panic warming transcode session")
			}
		}()
		container, err := r.playbackManager.newMediaContainer(filepath, StreamTypeTranscode, nil, false)
		if err != nil {
			r.logger.Debug().Err(err).Str("filepath", filepath).Msg("mediastream: Could not warm transcode session")
			return
		}
		tc, ok := r.getTranscoder()
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
		defer cancel()
		start := time.Now()
		if err := tc.WarmSession(ctx, container.Filepath, container.Hash, container.MediaInfo); err != nil {
			r.logger.Debug().Err(err).Str("filepath", filepath).Msg("mediastream: Could not warm transcode session")
			return
		}
		r.logger.Debug().Str("filepath", filepath).Dur("elapsed", time.Since(start)).Msg("mediastream: Transcode session warmed")
	}()
	return nil
}

func (r *Repository) RequestPreloadTranscodeStream(filepath string, preferredAudioLang string) (err error) {
	r.logger.Debug().Str("filepath", filepath).Str("preferredAudioLang", preferredAudioLang).Msg("mediastream: Transcode stream preloading requested")

	if !r.IsInitialized() {
		return errors.New("module not initialized")
	}

	if _, ok := r.getTranscoder(); !ok {
		r.reqMu.Lock()
		if _, ok := r.getTranscoder(); !ok { // double-check under the lock
			settings := r.GetSettings()
			if ok := r.initializeTranscoder(settings, false); !ok {
				r.reqMu.Unlock()
				return errors.New("real-time transcoder not initialized, check your settings")
			}
		}
		r.reqMu.Unlock()
	}

	_, err = r.playbackManager.PreloadPlayback(filepath, StreamTypeTranscode, preferredAudioLang)

	return
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Direct Play
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (r *Repository) RequestDirectPlay(filepath string, clientID string, caps *ClientCapabilities) (ret *MediaContainer, err error) {
	r.logger.Debug().Str("filepath", filepath).Msg("mediastream: Direct play requested")

	if !r.IsInitialized() {
		return nil, errors.New("module not initialized")
	}

	// No global lock: newMediaContainer dedupes concurrent builds via singleflight.
	ret, err = r.playbackManager.RequestPlayback(filepath, StreamTypeDirect, clientID, caps)
	if err != nil {
		return nil, err
	}

	// The client asked for direct play but the server decided the file must be
	// transcoded (e.g. undecodable default audio codec, see isDirectPlayableByClient).
	// The returned container already points at the HLS master playlist, but the
	// transcoder engine may be dormant when TranscodeEnabled=false — serving that
	// playlist with a dead transcoder would guarantee a black screen. Initialize it
	// on-demand with force=true: the server, not the user, decided direct is impossible.
	if _, ok := r.getTranscoder(); ret != nil && ret.StreamType == StreamTypeTranscode && !ok {
		r.reqMu.Lock()
		if _, ok := r.getTranscoder(); !ok { // double-check under the lock
			settings := r.GetSettings()
			if ok := r.initializeTranscoder(settings, true); !ok {
				r.logger.Error().Str("filepath", filepath).Msg("mediastream: Direct→transcode fallback could not initialize the transcoder on-demand")
			}
		}
		r.reqMu.Unlock()
	}
	ret = r.applyVideoPassthrough(ret, caps, clientID)

	return
}

func (r *Repository) RequestPreloadDirectPlay(filepath string) (err error) {
	r.logger.Debug().Str("filepath", filepath).Msg("mediastream: Direct stream preloading requested")

	if !r.IsInitialized() {
		return errors.New("module not initialized")
	}

	_, err = r.playbackManager.PreloadPlayback(filepath, StreamTypeDirect, "")

	return
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Optimized Play
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (r *Repository) RequestOptimizedStream(filepath string, clientID string) (ret *MediaContainer, err error) {
	r.logger.Debug().Str("filepath", filepath).Msg("mediastream: Optimized stream requested")

	if !r.IsInitialized() {
		return nil, errors.New("module not initialized")
	}

	// No global lock: newMediaContainer dedupes concurrent builds via singleflight.
	ret, err = r.playbackManager.RequestPlayback(filepath, StreamTypeOptimized, clientID, nil)

	return
}

func (r *Repository) RequestPreloadOptimizedStream(filepath string) (err error) {
	r.logger.Debug().Str("filepath", filepath).Msg("mediastream: Optimized stream preloading requested")

	if !r.IsInitialized() {
		return errors.New("module not initialized")
	}

	_, err = r.playbackManager.PreloadPlayback(filepath, StreamTypeOptimized, "")

	return
}

///////////////////////////////////////////////////////////////////////////////////////////////

// initializeTranscoder builds the transcoder engine. When force is false it respects the
// TranscodeEnabled setting and refuses to start if transcoding is disabled. When force is
// true (an explicit, user-initiated transcode request) it starts the engine regardless of
// the setting, as long as ffmpeg and the temp dir are available. Constructing the engine is
// cheap — no ffmpeg process runs until a segment is actually requested.
func (r *Repository) initializeTranscoder(settings mo.Option[*models.MediastreamSettings], force bool) bool {
	// Unpublish and destroy the old transcoder if it exists
	if prev, ok := r.swapTranscoder(mo.None[*cassette.Cassette]()).Get(); ok {
		prev.Destroy()
	}

	// If the transcoder is not enabled and this isn't an explicit (forced) request,
	// don't initialize the transcoder.
	if !force && !settings.MustGet().TranscodeEnabled {
		r.logger.Warn().Msg("mediastream: transcoder disabled (TranscodeEnabled=false); files that need transcoding will fail until enabled in Settings -> Streaming")
		return false
	}

	r.settingsMu.RLock()
	transcodeDir := r.transcodeDir
	r.settingsMu.RUnlock()

	// If the temp directory is not set, don't initialize the transcoder
	if transcodeDir == "" {
		r.logger.Error().Msg("mediastream: Transcode directory not set, could not initialize transcoder")
		return false
	}

	opts := &cassette.NewCassetteOptions{
		Logger:                r.logger,
		HwAccelKind:           settings.MustGet().TranscodeHwAccel,
		Preset:                settings.MustGet().TranscodePreset,
		FfmpegPath:            settings.MustGet().FfmpegPath,
		FfprobePath:           settings.MustGet().FfprobePath,
		HwAccelCustomSettings: settings.MustGet().TranscodeHwAccelCustomSettings,
		TempOutDir:            transcodeDir,
		MaxConcurrency:        settings.MustGet().TranscodeThreads,
	}

	tc, err := cassette.New(opts)
	if err != nil {
		r.logger.Error().Err(err).Msg("mediastream: Failed to initialize transcoder")
		return false
	}

	r.playbackManager.mediaContainers.Clear()

	r.logger.Info().Msg("mediastream: Transcoder module initialized")
	// initializeTranscoder is not always called under reqMu (InitializeModules),
	// so a concurrent init may have published its own engine meanwhile.
	if prev, ok := r.swapTranscoder(mo.Some(tc)).Get(); ok && prev != tc {
		prev.Destroy()
	}

	return true
}
