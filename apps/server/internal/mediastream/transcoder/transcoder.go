package transcoder

import (
	"context"
	"fmt"
	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/util/result"
	"os"
	"path"
	"path/filepath"
	"time"

	"github.com/rs/zerolog"
)

type (
	Transcoder struct {
		// All file streams currently running, index is file path
		streams    *result.Map[string, *FileStream]
		clientChan chan ClientInfo
		tracker    *Tracker
		logger     *zerolog.Logger
		settings   Settings
	}

	Settings struct {
		StreamDir   string
		HwAccel     HwAccelSettings
		FfmpegPath  string
		FfprobePath string
	}

	NewTranscoderOptions struct {
		Logger                *zerolog.Logger
		HwAccelKind           string
		Preset                string
		TempOutDir            string
		FfmpegPath            string
		FfprobePath           string
		HwAccelCustomSettings string
	}
)

func NewTranscoder(opts *NewTranscoderOptions) (*Transcoder, error) {

	// Create a directory that'll hold the stream segments if it doesn't exist
	streamDir := filepath.Join(opts.TempOutDir, "streams")
	_ = os.MkdirAll(streamDir, 0755)

	// Clear the directory containing the streams
	dir, err := os.ReadDir(streamDir)
	if err != nil {
		return nil, err
	}
	for _, d := range dir {
		_ = os.RemoveAll(path.Join(streamDir, d.Name()))
	}

	ret := &Transcoder{
		streams:    result.NewMap[string, *FileStream](),
		clientChan: make(chan ClientInfo, 1000),
		logger:     opts.Logger,
		settings: Settings{
			StreamDir: streamDir,
			HwAccel: GetHardwareAccelSettings(opts.FfmpegPath, HwAccelOptions{
				Kind:           opts.HwAccelKind,
				Preset:         opts.Preset,
				CustomSettings: opts.HwAccelCustomSettings,
			}, opts.Logger),
			FfmpegPath:  opts.FfmpegPath,
			FfprobePath: opts.FfprobePath,
		},
	}
	ret.tracker = NewTracker(ret)

	ret.logger.Info().Msg("transcoder: Initialized")
	return ret, nil
}

func (t *Transcoder) GetSettings() *Settings {
	return &t.settings
}

// Destroy stops all streams and removes the output directory.
// A new transcoder should be created after calling this function.
func (t *Transcoder) Destroy() {
	defer func() {
		if r := recover(); r != nil {
		}
	}()
	t.tracker.Stop()

	t.logger.Debug().Msg("transcoder: Destroying transcoder")
	for _, s := range t.streams.Values() {
		s.Destroy()
	}
	t.streams.Clear()
	//close(t.clientChan)
	t.streams = result.NewMap[string, *FileStream]()
	t.clientChan = make(chan ClientInfo, 10)
	t.logger.Debug().Msg("transcoder: Transcoder destroyed")
}

func (t *Transcoder) getFileStream(path string, hash string, mediaInfo *videofile.MediaInfo) (*FileStream, error) {
	if debugStream {
		start := time.Now()
		t.logger.Trace().Msgf("transcoder: Getting filestream")
		defer func() {
			t.logger.Trace().Msgf("transcoder: Filestream retrieved in %.2fs", time.Since(start).Seconds())
		}()
	}
	ret, _ := t.streams.GetOrSet(path, func() (*FileStream, error) {
		return NewFileStream(path, hash, mediaInfo, &t.settings, t.logger), nil
	})
	if ret == nil {
		return nil, fmt.Errorf("could not get filestream, file may not exist")
	}
	ret.ready.Wait()
	if ret.err != nil {
		t.streams.Delete(path)
		return nil, ret.err
	}
	return ret, nil
}

func (t *Transcoder) GetMaster(path string, hash string, mediaInfo *videofile.MediaInfo, client string) (string, error) {
	if debugStream {
		start := time.Now()
		t.logger.Trace().Msgf("transcoder: Retrieving master file")
		defer func() {
			t.logger.Trace().Msgf("transcoder: Master file retrieved in %.2fs", time.Since(start).Seconds())
		}()
	}
	stream, err := t.getFileStream(path, hash, mediaInfo)
	if err != nil {
		return "", err
	}
	t.clientChan <- ClientInfo{
		client:  client,
		path:    path,
		quality: nil,
		audio:   -1,
		head:    -1,
	}
	return stream.GetMaster(client), nil
}

func (t *Transcoder) RemoveClient(clientId string) {
	t.tracker.RemoveClient(clientId)
}

func (t *Transcoder) GetVideoIndex(
	path string,
	hash string,
	mediaInfo *videofile.MediaInfo,
	quality Quality,
	client string,
) (string, error) {
	if debugStream {
		start := time.Now()
		t.logger.Trace().Msgf("transcoder: Retrieving video index file (%s)", quality)
		defer func() {
			t.logger.Trace().Msgf("transcoder: Video index file retrieved in %.2fs", time.Since(start).Seconds())
		}()
	}
	stream, err := t.getFileStream(path, hash, mediaInfo)
	if err != nil {
		return "", err
	}
	t.clientChan <- ClientInfo{
		client:  client,
		path:    path,
		quality: &quality,
		audio:   -1,
		head:    -1,
	}
	return stream.GetVideoIndex(quality, client)
}

func (t *Transcoder) GetAudioIndex(
	path string,
	hash string,
	mediaInfo *videofile.MediaInfo,
	audio int32,
	client string,
) (string, error) {
	if debugStream {
		start := time.Now()
		t.logger.Trace().Msgf("transcoder: Retrieving audio index file (%d)", audio)
		defer func() {
			t.logger.Trace().Msgf("transcoder: Audio index file retrieved in %.2fs", time.Since(start).Seconds())
		}()
	}
	stream, err := t.getFileStream(path, hash, mediaInfo)
	if err != nil {
		return "", err
	}
	t.clientChan <- ClientInfo{
		client: client,
		path:   path,
		audio:  audio,
		head:   -1,
	}
	return stream.GetAudioIndex(audio, client)
}

func (t *Transcoder) GetVideoSegment(
	ctx context.Context,
	path string,
	hash string,
	mediaInfo *videofile.MediaInfo,
	quality Quality,
	segment int32,
	client string,
) (string, error) {
	if debugStream {
		start := time.Now()
		t.logger.Trace().Msgf("transcoder: Retrieving video segment %d (%s) [GetVideoSegment]", segment, quality)
		defer func() {
			t.logger.Trace().Msgf("transcoder: Video segment retrieved in %.2fs", time.Since(start).Seconds())
		}()
	}
	stream, err := t.getFileStream(path, hash, mediaInfo)
	if err != nil {
		return "", err
	}
	//t.logger.Trace().Msgf("transcoder: Sending client info, segment %d (%s) [GetVideoSegment]", segment, quality)
	t.clientChan <- ClientInfo{
		client:  client,
		path:    path,
		quality: &quality,
		audio:   -1,
		head:    segment,
	}
	//t.logger.Trace().Msgf("transcoder: Getting video segment %d (%s) [GetVideoSegment]", segment, quality)
	return stream.GetVideoSegment(ctx, quality, segment)
}

func (t *Transcoder) GetAudioSegment(
	ctx context.Context,
	path string,
	hash string,
	mediaInfo *videofile.MediaInfo,
	audio int32,
	segment int32,
	client string,
) (string, error) {
	if debugStream {
		start := time.Now()
		t.logger.Trace().Msgf("transcoder: Retrieving audio segment %d (%d)", segment, audio)
		defer func() {
			t.logger.Trace().Msgf("transcoder: Audio segment %d (%d) retrieved in %.2fs", segment, audio, time.Since(start).Seconds())
		}()
	}
	stream, err := t.getFileStream(path, hash, mediaInfo)
	if err != nil {
		return "", err
	}
	t.clientChan <- ClientInfo{
		client: client,
		path:   path,
		audio:  audio,
		head:   segment,
	}
	return stream.GetAudioSegment(ctx, audio, segment)
}

// ─── FFmpeg Builder ─────────────────────────────────────────────────────────

// PlaybackMethod defines the stream processing required.
type PlaybackMethod string

const (
	DirectStream PlaybackMethod = "DIRECT_STREAM"
	Transcode    PlaybackMethod = "TRANSCODE"
)

// FFmpegBuilder uses the Builder pattern to generate FFmpeg CLI arguments.
type FFmpegBuilder struct {
	global  []string
	video   []string
	audio   []string
	subs    []string
	output  []string
	hwAccel *HwAccelSettings
}

// NewFFmpegBuilder initializes an empty builder.
func NewFFmpegBuilder() *FFmpegBuilder {
	return &FFmpegBuilder{
		global: make([]string, 0, 8),
		video:  make([]string, 0, 8),
		audio:  make([]string, 0, 8),
		subs:   make([]string, 0, 4),
		output: make([]string, 0, 16),
	}
}

// WithHardwareAccel attaches a detected HW accelerator profile to the builder.
// When set, the builder emits NVENC/VAAPI/QSY/VideoToolbox encoder flags
// instead of software libx264, avoiding CPU bottlenecks on supported hardware.
func (b *FFmpegBuilder) WithHardwareAccel(hw *HwAccelSettings) *FFmpegBuilder {
	b.hwAccel = hw
	return b
}

// WithSubtitles instructs FFmpeg to burn ASS/SSA subtitles into the video stream.
// This is used as a fallback when Jassub is not available on the client;
// normally ASS subtitles are rendered on the frontend via WebAssembly.
func (b *FFmpegBuilder) WithSubtitles(assPath string) *FFmpegBuilder {
	b.subs = append(b.subs,
		"-vf", fmt.Sprintf("ass=%s", assPath),
	)
	return b
}

// BuildForHLS assembles the final argument slice optimized for HLS streaming.
// When hwAccel is set, the builder uses hardware-accelerated encoding;
// otherwise it falls back to libx264 software encoding.
func (b *FFmpegBuilder) BuildForHLS(decision PlaybackMethod, inputFile, outputDir string) []string {
	b.global = append(b.global, "-y", "-i", inputFile)

	if decision == DirectStream {
		b.video = append(b.video, "-c:v", "copy")
		b.audio = append(b.audio, "-c:a", "copy")
	} else {
		if b.hwAccel != nil && b.hwAccel.Name != "disabled" && len(b.hwAccel.EncodeFlags) > 0 {
			b.global = append(b.global, b.hwAccel.DecodeFlags...)
			b.video = append(b.video, b.hwAccel.EncodeFlags...)
			if b.hwAccel.ScaleFilter != "" {
				b.video = append(b.video,
					"-vf", fmt.Sprintf(b.hwAccel.ScaleFilter, 1920, 1080),
				)
			}
			b.video = append(b.video,
				"-sc_threshold", "0",
				"-force_key_frames", "expr:gte(t,n_forced*3)",
				"-strict", "-2",
			)
		} else {
			b.video = append(b.video,
				"-c:v", "libx264",
				"-preset", "fast",
				"-crf", "23",
				"-maxrate", "5M",
				"-bufsize", "10M",
				"-sc_threshold", "0",
				"-pix_fmt", "yuv420p",
				"-force_key_frames", "expr:gte(t,n_forced*3)",
			)
		}
		b.video = append(b.video, b.subs...)
		b.audio = append(b.audio,
			"-c:a", "aac",
			"-ac", "2",
			"-b:a", "128k",
		)
	}

	b.output = append(b.output,
		"-f", "hls",
		"-hls_time", "3",
		"-hls_playlist_type", "event",
		"-hls_segment_type", "mpegts",
		"-hls_flags", "independent_segments",
		"-hls_list_size", "0",
		"-hls_segment_filename", filepath.Join(outputDir, "%04d.ts"),
		filepath.Join(outputDir, "index.m3u8"),
	)

	args := make([]string, 0, len(b.global)+len(b.video)+len(b.audio)+len(b.output))
	args = append(args, b.global...)
	args = append(args, b.video...)
	args = append(args, b.audio...)
	args = append(args, b.output...)
	return args
}
