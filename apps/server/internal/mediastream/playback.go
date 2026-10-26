package mediastream

import (
	"context"
	"errors"
	"fmt"
	"kamehouse/internal/mediastream/cassette"
	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/util/httprange"
	"kamehouse/internal/util/result"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"github.com/samber/mo"
	"golang.org/x/sync/singleflight"
)

var attachmentSemaphore = make(chan struct{}, 2)

// preloadClientID is the tracker client used by the zero-latency preload.
const preloadClientID = "preload-client"

const (
	StreamTypeTranscode StreamType = "transcode" // On-the-fly transcoding
	StreamTypeOptimized StreamType = "optimized" // Pre-transcoded
	StreamTypeDirect    StreamType = "direct"    // Direct streaming
)

type (
	StreamType string

	// ClientCapabilities describes the codecs/containers the requesting client can
	// decode natively. Populated by the web player via canPlayType/MediaSource
	// probing. A nil pointer means "unknown client" and falls back to the static
	// Chromium-based assumptions used before capabilities existed.
	ClientCapabilities struct {
		Hevc      bool `json:"hevc"`      // HEVC/H.265 8-bit
		Hevc10Bit bool `json:"hevc10Bit"` // HEVC Main 10
		Av1       bool `json:"av1"`
		Vp9       bool `json:"vp9"`
		Ac3       bool `json:"ac3"`
		Eac3      bool `json:"eac3"`
		Dts       bool `json:"dts"`
		Matroska  bool `json:"matroska"` // can demux .mkv in <video> (Chromium yes, Firefox/Safari no)
		// HlsHevc: el reproductor HLS del cliente lee HEVC dentro de MPEG-TS, que es lo que
		// manda la copia de video (applyVideoPassthrough). hls.js sí; el HLS nativo de
		// Chromium no (se queda cargando sin dar error). Sin informar se asume que sí, así
		// los clientes que no lo mandan (la web) siguen igual.
		HlsHevc *bool `json:"hlsHevc,omitempty"`
	}

	PlaybackManager struct {
		logger                *zerolog.Logger
		stateMu               sync.Mutex                 // Guards currentMediaContainer (no longer serialized by repository.reqMu).
		currentMediaContainer mo.Option[*MediaContainer] // The current media being played.
		repository            *Repository
		mediaContainers       *result.Map[string, *MediaContainer] // Temporary cache for the media containers.
		clientMediaContainers *result.Map[string, *MediaContainer]
		// Dedupes concurrent identical newMediaContainer builds (keyed by hash:streamType)
		// so a hover-preload racing the play click runs ffprobe once instead of twice.
		containerGroup singleflight.Group
		// Tracks in-flight attachment/subtitle extractions keyed by file hash. The value
		// is an *extractionJob whose done channel is closed when the job ends; on
		// failure the entry is deleted so a later request can retry. The subtitles/PGS
		// endpoints block on this (WaitForExtraction) instead of racing an empty dir.
		extractionJobs sync.Map // hash -> *extractionJob
	}

	MediaContainer struct {
		Filepath   string               `json:"filePath"`
		Hash       string               `json:"hash"`
		StreamType StreamType           `json:"streamType"` // Tells the frontend how to play the media.
		StreamURL  string               `json:"streamUrl"`  // The relative endpoint to stream the media.
		MediaInfo  *videofile.MediaInfo `json:"mediaInfo"`
		// VideoPassthrough: this client decodes the source video codec, so the
		// transcode master offers only the video-copy tier (audio still → AAC).
		// Per client (containers are cloned before setting it), never serialized.
		VideoPassthrough bool `json:"-"`
		//Metadata  *Metadata       `json:"metadata"`
		// todo: add more fields (e.g. metadata)
	}
)

func NewPlaybackManager(repository *Repository) *PlaybackManager {
	return &PlaybackManager{
		logger:                repository.logger,
		repository:            repository,
		mediaContainers:       result.NewMap[string, *MediaContainer](),
		clientMediaContainers: result.NewMap[string, *MediaContainer](),
	}
}

// setCurrentMediaContainer / getCurrentMediaContainer guard the "current media"
// pointer that stream endpoints fall back to when a request carries no bound
// clientID. Previously the surrounding repository.reqMu made these writes safe;
// now that container builds run lock-free (singleflight), the writes/reads need
// their own small mutex.
func (p *PlaybackManager) setCurrentMediaContainer(mc *MediaContainer) {
	p.stateMu.Lock()
	p.currentMediaContainer = mo.Some(mc)
	p.stateMu.Unlock()
}

func (p *PlaybackManager) getCurrentMediaContainer() (*MediaContainer, bool) {
	p.stateMu.Lock()
	defer p.stateMu.Unlock()
	return p.currentMediaContainer.Get()
}

// fingerprint returns a short cache-key component so containers built for
// clients with different codec support don't leak into each other's decisions.
func (c *ClientCapabilities) fingerprint() string {
	if c == nil {
		return "legacy"
	}
	b := func(v bool) byte {
		if v {
			return '1'
		}
		return '0'
	}
	return string([]byte{b(c.Hevc), b(c.Hevc10Bit), b(c.Av1), b(c.Vp9), b(c.Ac3), b(c.Eac3), b(c.Dts), b(c.Matroska)})
}

// RequestPlayback is called by the frontend to stream a media file
func (p *PlaybackManager) RequestPlayback(filepath string, streamType StreamType, clientID string, caps *ClientCapabilities) (ret *MediaContainer, err error) {

	p.logger.Debug().Str("filepath", filepath).Any("type", streamType).Msg("mediastream: Requesting playback")

	start := time.Now()

	// Create a new media container. priority=true: this is the episode being played,
	// so its attachment extraction skips the preload semaphore and starts immediately.
	ret, err = p.newMediaContainer(filepath, streamType, caps, true)

	if err != nil {
		p.logger.Error().Err(err).Msg("mediastream: Failed to create media container")
		return nil, fmt.Errorf("failed to create media container: %w", err)
	}

	// Bind the session: stream endpoints (segments, ranges, subtitles) resolve the
	// file from this per-client (and global fallback) pointer.
	p.setCurrentMediaContainer(ret)
	if clientID != "" {
		p.clientMediaContainers.Set(clientID, ret)
	}

	p.logger.Info().Str("filepath", filepath).Str("hash", ret.Hash).Dur("total", time.Since(start)).Msg("mediastream: Ready to play media")

	return
}

// PreloadPlayback is called by the frontend to preload a media container so that the data is stored in advanced
func (p *PlaybackManager) PreloadPlayback(filepath string, streamType StreamType, preferredAudioLang string) (ret *MediaContainer, err error) {

	p.logger.Debug().Str("filepath", filepath).Any("type", streamType).Str("preferredAudioLang", preferredAudioLang).Msg("mediastream: Preloading playback")

	// Create a new media container. priority=false: preloads (hover) must not jump the
	// extraction queue ahead of the episode currently playing.
	ret, err = p.newMediaContainer(filepath, streamType, nil, false)

	if err != nil {
		p.logger.Error().Err(err).Msg("mediastream: Failed to create media container")
		return nil, fmt.Errorf("failed to create media container: %w", err)
	}

	// A preload means the user is likely to watch this file next. If it needs a live
	// transcode, queue a full background pre-transcode so the play after this one is
	// instant and costs nothing at watch time. Idempotent: already-done or
	// already-queued files are no-ops.
	if ret.StreamType == StreamTypeTranscode {
		if ptm, ok := p.repository.PreTranscoder(); ok {
			if _, err := ptm.Enqueue(ret.Filepath); err != nil {
				p.logger.Debug().Err(err).Str("filepath", ret.Filepath).Msg("mediastream: Could not queue pre-transcode")
			}
		}
	}

	// Zero Latency Next: Pre-transcode and cache the first N segments (video and audio) of the next episode in the background.
	if _, hasTranscoder := p.repository.getTranscoder(); ret.StreamType == StreamTypeTranscode && hasTranscoder {
		go func() {
			defer func() {
				if r := recover(); r != nil {
					p.logger.Warn().Interface("panic", r).Msg("mediastream: panic in zero-latency pre-transcode goroutine")
				}
			}()
			if !p.repository.IsInitialized() {
				return
			}
			tc, ok := p.repository.getTranscoder()
			if !ok || tc == nil {
				return
			}
			ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
			defer cancel()
			// One tracker client per preloaded file: with a shared id two overlapping preloads
			// kept moving the same client between paths, and ClientTracker killed the session of
			// the path it left on every move.
			preloadClient := preloadClientID + ":" + ret.Hash
			// Stop the heads the preload spawned once it is done (each head
			// otherwise keeps encoding up to 100 segments of this episode).
			defer tc.PreloadDone(preloadClient)

			preloadSegments := 3
			settingsOpt := p.repository.GetSettings()
			if settingsOpt.IsPresent() {
				s := settingsOpt.MustGet()
				if s != nil && s.TranscodeThreads > 0 {
					preloadSegments = s.TranscodeThreads
				}
			}

			p.logger.Debug().Str("filepath", ret.Filepath).Int("segments", preloadSegments).Msg("mediastream: Pre-transcoding video segments for zero-latency start")
			for i := 0; i < preloadSegments; i++ {
				_, _ = tc.GetVideoSegment(ctx, ret.Filepath, ret.Hash, ret.MediaInfo, cassette.StartQuality(ret.MediaInfo), int32(i), preloadClient)
			}

			if len(ret.MediaInfo.Audios) > 0 {
				defaultAudioIdx := pickPreloadAudio(ret.MediaInfo.Audios, preferredAudioLang)

				p.logger.Debug().Str("filepath", ret.Filepath).Int("segments", preloadSegments).Int32("audioIndex", defaultAudioIdx).Msg("mediastream: Pre-transcoding audio segments for zero-latency start")
				for i := 0; i < preloadSegments; i++ {
					_, _ = tc.GetAudioSegment(ctx, ret.Filepath, ret.Hash, ret.MediaInfo, defaultAudioIdx, int32(i), preloadClient)
				}
			}
			p.logger.Info().Str("filepath", ret.Filepath).Int("segments", preloadSegments).Msg("mediastream: Finished proactive pre-transcoding of segments")
		}()
	}

	p.logger.Info().Str("filepath", filepath).Msg("mediastream: Ready to play media")

	return
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Optimize
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (p *PlaybackManager) newMediaContainer(filePath string, streamType StreamType, caps *ClientCapabilities, priority bool) (ret *MediaContainer, err error) {
	p.logger.Debug().Str("filepath", filePath).Any("type", streamType).Msg("mediastream: New media container requested")
	// Get the hash of the file.
	hash, err := videofile.GetHashFromPath(filePath)
	if err != nil {
		return nil, err
	}

	p.logger.Trace().Str("hash", hash).Msg("mediastream: Checking cache")

	// Cache key includes the client capability fingerprint: the direct-vs-transcode
	// decision depends on what the requesting client can decode, so a container
	// built for a HEVC-capable client must not be reused for one that isn't.
	cacheKey := hash + "|" + caps.fingerprint()

	// Fast path: cache hit (lock-free read). Only reuse if the stream type matches and a
	// live-transcode container has not been outdated by a finished pre-transcode.
	if mc, ok := p.mediaContainers.Get(cacheKey); ok && mc.StreamType == streamType && !p.preTranscodeFinished(mc) {
		p.logger.Debug().Str("hash", hash).Bool("cached", true).Msg("mediastream: Media container cache HIT")
		return mc, nil
	}

	// Slow path: dedupe concurrent identical builds. Keyed by hash:streamType:caps so
	// a preload racing a play (or two clients opening the same file) runs ffprobe
	// once and shares the result; different files still build in parallel (no global
	// lock). This replaces the old repository-wide reqMu around the whole request.
	key := cacheKey + ":" + string(streamType)
	v, err, _ := p.containerGroup.Do(key, func() (interface{}, error) {
		// Re-check the cache: a concurrent build may have completed while we queued.
		if mc, ok := p.mediaContainers.Get(cacheKey); ok && mc.StreamType == streamType && !p.preTranscodeFinished(mc) {
			p.logger.Debug().Str("hash", hash).Bool("cached", true).Msg("mediastream: Media container cache HIT (deduped)")
			return mc, nil
		}
		return p.buildMediaContainer(filePath, hash, streamType, caps, cacheKey, priority)
	})
	if err != nil {
		return nil, err
	}
	return v.(*MediaContainer), nil
}

// preTranscodeFinished reports whether a container cached as a live transcode is outdated
// because the file has been pre-transcoded since. Containers live in the cache until the
// transcoder module is re-initialized and buildMediaContainer only looks for the pre-transcoded
// output when it builds one, so without this check a file played before its pre-transcode
// finished keeps being transcoded live on every later play.
func (p *PlaybackManager) preTranscodeFinished(mc *MediaContainer) bool {
	if mc.StreamType != StreamTypeTranscode || mc.MediaInfo == nil {
		return false
	}
	ptm, ok := p.repository.PreTranscoder()
	return ok && ptm.Ready(mc.Hash, len(mc.MediaInfo.Audios))
}

// buildMediaContainer performs the expensive work (ffprobe media-info extraction,
// codec compatibility decision, stream-URL resolution) and caches the result. It
// must only be called from within the containerGroup singleflight in
// newMediaContainer so the ffprobe never runs concurrently for the same file.
func (p *PlaybackManager) buildMediaContainer(filePath string, hash string, streamType StreamType, caps *ClientCapabilities, cacheKey string, priority bool) (ret *MediaContainer, err error) {
	p.logger.Trace().Str("hash", hash).Msg("mediastream: Creating media container")

	// Get the media information of the file.
	ret = &MediaContainer{
		Filepath:   filePath,
		Hash:       hash,
		StreamType: streamType,
	}

	p.logger.Debug().Msg("mediastream: Extracting media info")

	ffprobeStart := time.Now()
	ffprobePath := "ffprobe"
	if s, ok := p.repository.GetSettings().Get(); ok && s != nil && s.FfprobePath != "" {
		ffprobePath = s.FfprobePath
	}
	ret.MediaInfo, err = p.repository.mediaInfoExtractor.GetInfo(ffprobePath, filePath)
	if err != nil {
		return nil, err
	}
	p.logger.Debug().Str("hash", hash).Bool("cached", false).Dur("mediaInfo", time.Since(ffprobeStart)).Msg("mediastream: Media info extracted")

	p.logger.Debug().Msg("mediastream: Extracted media info, starting attachment extraction")

	// Extract attachments (fonts, embedded subtitles) in the background so it doesn't block
	// playback start. Exactly one extraction runs per file hash: the subtitles/PGS endpoints
	// wait on the tracked channel (WaitForExtraction) instead of racing a half-written dir,
	// and preloads (priority=false) queue behind the playback semaphore so the episode being
	// watched extracts first.
	p.startAttachmentExtraction(filePath, hash, ret.MediaInfo, priority)

	// Resolve the playback policy: the requested stream type is a hint, not a verdict.
	// Fail-closed: sin ajustes cargados el directo es la única salida; el ajuste real lo sobrescribe.
	policy := playbackPolicy{directPlayOnly: true}
	if s, ok := p.repository.GetSettings().Get(); ok && s != nil {
		policy.directPlayOnly = s.DirectPlayOnly
		policy.disableAutoSwitchToDirect = s.DisableAutoSwitchToDirectPlay
	}

	if resolved, reason := resolveStreamType(streamType, ret.MediaInfo, caps, policy); resolved != streamType {
		p.logger.Info().
			Str("filepath", filePath).
			Str("ext", strings.ToLower(ret.MediaInfo.Extension)).
			Str("from", string(streamType)).
			Str("to", string(resolved)).
			Str("caps", caps.fingerprint()).
			Str("reason", reason).
			Msg("mediastream: Stream type switched")
		streamType = resolved
		ret.StreamType = resolved
	}

	// A live transcode is pointless when this file was already pre-transcoded:
	// serve the finished HLS off disk instead of re-encoding it every play. Ready also
	// checks that the output holds every audio track, so the player can still switch them.
	audioTracks := 0
	if ret.MediaInfo != nil {
		audioTracks = len(ret.MediaInfo.Audios)
	}
	preReady := false
	if ptm, ok := p.repository.PreTranscoder(); ok {
		preReady = ptm.Ready(hash, audioTracks)
	}
	if streamType == StreamTypeTranscode && preReady {
		p.logger.Info().Str("filepath", filePath).Msg("mediastream: Pre-transcoded output found. Serving the optimized stream.")
		streamType = StreamTypeOptimized
		ret.StreamType = StreamTypeOptimized
	}

	streamURL := ""
	switch streamType {
	case StreamTypeDirect:
		// Directly serve the file.
		streamURL = "/api/v1/mediastream/direct/play"
	case StreamTypeTranscode:
		// Live transcode the file.
		streamURL = "/api/v1/mediastream/transcode/master.m3u8"
	case StreamTypeOptimized:
		if preReady {
			streamURL = "/api/v1/mediastream/hls/master.m3u8"
		} else {
			// Solo original: sin HLS previo no se convierte; el archivo queda en directo o falla.
			if policy.directPlayOnly {
				return nil, ErrDirectOnly
			}
			// Fall back gracefully to transcode stream
			ret.StreamType = StreamTypeTranscode
			streamURL = "/api/v1/mediastream/transcode/master.m3u8"
		}
	}

	if streamURL == "" {
		return nil, errors.New("invalid stream type")
	}

	// Set the stream URL.
	ret.StreamURL = streamURL

	// Store the media container in the map.
	p.mediaContainers.Set(cacheKey, ret)

	return
}

// extractionJob is one attachment extraction in flight for a file hash.
type extractionJob struct {
	// done is closed when the job ends.
	done chan struct{}

	// promote is closed when the episode being played needs a job that is still queued behind
	// the preload semaphore, so it starts at once instead of waiting for other files' jobs.
	promote     chan struct{}
	promoteOnce sync.Once
}

func (j *extractionJob) promoteNow() {
	j.promoteOnce.Do(func() { close(j.promote) })
}

// startAttachmentExtraction launches (at most once per hash) the ffmpeg demux that
// writes embedded subtitles and fonts to the cache. The job's done channel is closed
// when it ends so waiters can proceed; on failure the entry is removed so
// a subsequent request can retry. priority=false routes the work through the global
// attachmentSemaphore (preloads), priority=true bypasses it (the episode being played),
// including a job a preload registered first that is still waiting for a slot.
func (p *PlaybackManager) startAttachmentExtraction(filePath string, hash string, mediaInfo *videofile.MediaInfo, priority bool) {
	// Fuentes remotas (Drive por loopback): ffmpeg tendría que descargar el archivo
	// completo para volcar subtítulos y fuentes. No se extraen; el handler no expone
	// esas pistas para estas fuentes, así que nadie queda esperando la extracción.
	if httprange.IsRemote(filePath) {
		return
	}
	job := &extractionJob{done: make(chan struct{}), promote: make(chan struct{})}
	actual, loaded := p.extractionJobs.LoadOrStore(hash, job)
	if loaded {
		// Another request already started (or finished) extraction for this hash. If it is
		// still queued behind the preload semaphore and the episode is now being played, let
		// it start at once: the subtitle/PGS endpoints are waiting on it.
		if priority {
			actual.(*extractionJob).promoteNow()
		}
		return
	}

	go func() {
		defer close(job.done)

		if !priority {
			select {
			case attachmentSemaphore <- struct{}{}:
				defer func() { <-attachmentSemaphore }()
			case <-job.promote:
			}
		}

		// Read settings/cacheDir under settingsMu: InitializeModules may be
		// swapping them concurrently.
		p.repository.settingsMu.RLock()
		settings, hasSettings := p.repository.settings.Get()
		cacheDir := p.repository.cacheDir
		p.repository.settingsMu.RUnlock()
		if !hasSettings || settings == nil {
			p.extractionJobs.Delete(hash)
			return
		}

		// Background on purpose: the extracted fonts/subs are shared by every
		// client of this file, so no single request may cancel the job.
		if err := videofile.ExtractAttachment(context.Background(), settings.FfmpegPath, filePath, hash, mediaInfo, cacheDir, p.logger); err != nil {
			p.logger.Error().Err(err).Str("filepath", filePath).Msg("mediastream: Attachment extraction failed")
			// Allow a later request to retry by dropping the (about-to-close) job entry.
			p.extractionJobs.Delete(hash)
		} else {
			p.logger.Debug().Str("filepath", filePath).Msg("mediastream: Attachment extraction completed")
		}
	}()
}

// WaitForExtraction blocks until the attachment/subtitle extraction for the given hash
// has finished, ctx is cancelled, or there is no extraction in flight. It returns nil
// when extraction is done (or was never needed) and ctx.Err() when the wait times out.
func (p *PlaybackManager) WaitForExtraction(ctx context.Context, hash string) error {
	v, ok := p.extractionJobs.Load(hash)
	if !ok {
		// No job tracked for this hash. Either extraction was never triggered or it
		// failed (entry deleted); if the subs dir already exists the caller will find
		// the files, otherwise it will report the appropriate error.
		return nil
	}
	job := v.(*extractionJob)
	select {
	case <-job.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// playbackPolicy carries the user's stream-type preferences (Settings → Streaming)
// into the pure resolveStreamType decision.
type playbackPolicy struct {
	// directPlayOnly: never fall back to transcode — the user prefers a hard
	// failure over burning CPU/GPU.
	directPlayOnly bool
	// disableAutoSwitchToDirect: keep transcoding even when the client could play
	// the file natively.
	disableAutoSwitchToDirect bool
}

// resolveStreamType decides the stream type actually used for playback. The
// requested type is a hint: a Direct request falls back to Transcode when the
// client can't decode the file, and a Transcode request upgrades to Direct when
// it can — transcoding a natively-playable file wastes CPU/GPU for no gain.
// Both switches are gated by the user's policy. Returns the resolved type and a
// short reason for logging ("" when unchanged).
//
// The Transcode→Direct upgrade requires explicit caps: a nil caps means the
// caller either doesn't know the client's codecs or deliberately needs HLS (an
// audio-track switch passes nil), and in neither case should we gamble.
func resolveStreamType(requested StreamType, info *videofile.MediaInfo, caps *ClientCapabilities, policy playbackPolicy) (StreamType, string) {
	switch requested {
	case StreamTypeDirect:
		if policy.directPlayOnly {
			return StreamTypeDirect, ""
		}
		if !isDirectPlayableByClient(info, caps) {
			return StreamTypeTranscode, "container or codecs not supported by this client"
		}

	case StreamTypeTranscode:
		// directPlayOnly rige también los pedidos explícitos de transcode (fallback tras un
		// error de decodificación, cambio de pista): el encoder no arranca y el cliente ve el fallo.
		if policy.directPlayOnly {
			return StreamTypeDirect, "direct-only: transcode disabled"
		}
		if policy.disableAutoSwitchToDirect || caps == nil {
			return StreamTypeTranscode, ""
		}
		if isDirectPlayableByClient(info, caps) {
			return StreamTypeDirect, "client decodes this file natively"
		}
	}

	return requested, ""
}

// isDirectPlayableByClient decides whether the file can be played natively by
// the requesting client without transcoding. When caps is nil (older clients
// that don't report capabilities) it assumes a Chromium/WebView2 engine, which
// matches the previous hardcoded behavior.
func isDirectPlayableByClient(info *videofile.MediaInfo, caps *ClientCapabilities) bool {
	switch strings.ToLower(info.Extension) {
	case "mp4", "m4v", "webm", "mov", "ogg":
		// Universal containers.
	case "mkv":
		// Chromium/WebView2 demuxes Matroska natively; Firefox and Safari do not.
		if caps != nil && !caps.Matroska {
			return false
		}
	default:
		return false
	}

	if info.Video != nil {
		vCodec := strings.ToLower(info.Video.Codec)
		// 10/12-bit content needs special handling: no browser decodes Hi10P H.264,
		// and HEVC Main 10 requires explicit hardware support on the client.
		isHighBitDepth := strings.Contains(info.Video.PixFmt, "10") || strings.Contains(info.Video.PixFmt, "12")
		switch vCodec {
		case "h264":
			if isHighBitDepth {
				return false
			}
		case "hevc", "h265":
			if caps != nil {
				if !caps.Hevc {
					return false
				}
				if isHighBitDepth && !caps.Hevc10Bit {
					return false
				}
			}
		case "vp8":
			// Universally supported.
		case "vp9":
			if caps != nil && !caps.Vp9 {
				return false
			}
		case "av1":
			if caps != nil && !caps.Av1 {
				return false
			}
		default:
			return false
		}
	}

	// The DEFAULT audio track must be decodable by the client. In direct play the
	// browser plays whichever track the container marks as default and exposes no API
	// to switch it (Chromium/WebView2), so it is not enough that *some* track is
	// supported: if the default is e.g. E-AC3 while a secondary FLAC track exists, the
	// browser would still try (and fail) to play the E-AC3 default → black screen /
	// silence. Falling back to transcode here lets hls.js expose both tracks switchably.
	if len(info.Audios) > 0 {
		defaultAudio := info.Audios[0]
		for _, audio := range info.Audios {
			if audio.IsDefault {
				defaultAudio = audio
				break
			}
		}
		if !isAudioCodecSupported(defaultAudio.Codec, caps) {
			return false
		}
	}

	return true
}

// isAudioCodecSupported reports whether the client can natively decode the given audio
// codec. AC3/E-AC3/DTS are proprietary and not shipped in Chromium, so only clients that
// explicitly probed support for them may direct-play those.
func isAudioCodecSupported(codec string, caps *ClientCapabilities) bool {
	switch strings.ToLower(codec) {
	case "aac", "mp3", "opus", "flac", "vorbis":
		return true
	case "ac3":
		return caps != nil && caps.Ac3
	case "eac3", "e-ac-3":
		return caps != nil && caps.Eac3
	case "dts", "dca":
		return caps != nil && caps.Dts
	}
	return false
}

// pickPreloadAudio elige la pista a pre-transcodificar con el mismo criterio que
// el player (track-selection.ts): el idioma preferido (latino primero si se pidió
// "spa-lat") y, entre las que coinciden, la de mejor calidad; si solo hay una
// versión peor, esa. Sin coincidencia → la pista por defecto del archivo.
func pickPreloadAudio(audios []videofile.Audio, preferredLang string) int32 {
	lower := func(p *string) string {
		if p == nil {
			return ""
		}
		return strings.ToLower(*p)
	}
	isSpanish := func(lang string) bool {
		return lang == "spa" || lang == "es" || strings.HasPrefix(lang, "es-") || strings.HasPrefix(lang, "spa-")
	}
	best := func(pred func(a videofile.Audio) bool) (int32, bool) {
		idx, score, found := int32(0), -1, false
		for _, a := range audios {
			if s := audioQualityScore(a); pred(a) && s > score {
				idx, score, found = int32(a.Index), s, true
			}
		}
		return idx, found
	}

	pref := strings.ToLower(preferredLang)
	if pref != "" && pref != "und" {
		if pref == "spa-lat" || pref == "es-419" || pref == "es-la" {
			if idx, ok := best(func(a videofile.Audio) bool {
				lang, title := lower(a.Language), lower(a.Title)
				return lang == "es-419" || lang == "es-la" || lang == "spa-lat" ||
					(isSpanish(lang) && (strings.Contains(title, "lat") || strings.Contains(title, "hispano") || strings.Contains(title, "mexico")))
			}); ok {
				return idx
			}
			if idx, ok := best(func(a videofile.Audio) bool {
				title := lower(a.Title)
				return isSpanish(lower(a.Language)) && !strings.Contains(title, "castellano") && !strings.Contains(title, "spain")
			}); ok {
				return idx
			}
		} else if idx, ok := best(func(a videofile.Audio) bool {
			lang := lower(a.Language)
			return lang == pref || (isSpanish(pref) && isSpanish(lang))
		}); ok {
			return idx
		}
	}

	for _, a := range audios {
		if a.IsDefault {
			return int32(a.Index)
		}
	}
	return 0
}

// audioQualityScore: codec sin pérdida > surround con pérdida > estéreo
// comprimido, y a igual codec más canales. Espejo de audioQualityScore en web.
func audioQualityScore(a videofile.Audio) int {
	codec := strings.ToLower(a.Codec)
	score := 1
	switch {
	case codec == "flac" || codec == "truehd" || codec == "mlp" || codec == "alac" || strings.HasPrefix(codec, "pcm"):
		score = 4
	case codec == "eac3" || codec == "ac3" || codec == "dts" || codec == "opus":
		score = 3
	case codec == "aac" || codec == "vorbis":
		score = 2
	}
	ch := int(a.Channels)
	if ch == 0 {
		ch = 2
	}
	return score*100 + ch
}
