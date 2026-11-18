package scanner

import (
	"context"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util/ffmpegutil"
	"kamehouse/internal/util/parallel"
	"runtime"
	"strconv"
	"time"

	"github.com/rs/zerolog"
	"gopkg.in/vansante/go-ffprobe.v2"
)

// FileProber is responsible for extracting technical information from media files.
// It uses a combination of fast internal parsers (mkvparser) and FFprobe as a fallback.
type FileProber struct {
	FFprobePath string
	Logger      *zerolog.Logger
}

func NewFileProber(ffprobePath string, logger *zerolog.Logger) *FileProber {
	return &FileProber{
		FFprobePath: ffprobePath,
		Logger:      logger,
	}
}

// ProbeFiles populates TechnicalInfo for a list of LocalFiles using a bounded worker pool.
func (p *FileProber) ProbeFiles(ctx context.Context, files []*dto.LocalFile) {
	if len(files) == 0 || ctx.Err() != nil {
		return
	}

	p.Logger.Info().Int("count", len(files)).Msg("scanner: Initiating parallel file probing...")

	if len(files) == 1 {
		p.probeFile(ctx, files[0])
		return
	}
	parallel.EachTaskLimitContext(ctx, files, min(8, max(2, runtime.NumCPU())), func(lf *dto.LocalFile, _ int) { p.probeFile(ctx, lf) })
}

func (p *FileProber) probeFile(ctx context.Context, lf *dto.LocalFile) {
	if lf == nil || ctx.Err() != nil {
		return
	}
	if isMatroskaPath(lf.Path) {
		ingestLocalFileEmbeddedMetadata(ctx, lf, p.Logger)
	}
	if shouldFallbackToFFprobe(lf) && p.FFprobePath != "" {
		p.probeWithFFprobe(ctx, lf)
	}
}

func shouldFallbackToFFprobe(lf *dto.LocalFile) bool {
	if lf.TechnicalInfo == nil {
		return true
	}
	// If it's not Matroska, we definitely want FFprobe for better accuracy
	if !isMatroskaPath(lf.Path) {
		return true
	}
	// If MKV parsing failed to get streams
	return len(lf.TechnicalInfo.AudioStreams) == 0
}

func (p *FileProber) probeWithFFprobe(ctx context.Context, lf *dto.LocalFile) {
	ffprobeCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	data, err := ffmpegutil.ProbeURL(ffprobeCtx, p.FFprobePath, lf.Path)
	if err != nil {
		p.Logger.Debug().Err(err).Str("path", lf.Path).Msg("scanner: FFprobe failed")
		return
	}

	applyProbeData(lf, data)
}

// Publish a fresh snapshot: repeated probes replace embedded streams while
// retaining sidecars and flags owned by other scanners.
func applyProbeData(lf *dto.LocalFile, data *ffprobe.ProbeData) {
	if data == nil || data.Format == nil {
		return
	}
	var next dto.FileTechnicalInfo
	if lf.TechnicalInfo != nil {
		next = *lf.TechnicalInfo
	}
	next.VideoStream = nil
	var audioCount, subtitleCount int
	for _, stream := range data.Streams {
		if stream == nil {
			continue
		}
		if stream.CodecType == string(ffprobe.StreamAudio) {
			audioCount++
		}
		if stream.CodecType == string(ffprobe.StreamSubtitle) {
			subtitleCount++
		}
	}
	next.AudioStreams, next.SubtitleStreams = nil, nil
	if audioCount > 0 {
		next.AudioStreams = make([]*dto.AudioStreamInfo, 0, audioCount)
	}
	if subtitleCount > 0 {
		next.SubtitleStreams = make([]*dto.AudioStreamInfo, 0, subtitleCount)
	}

	next.Duration = time.Duration(data.Format.DurationSeconds * float64(time.Second))
	next.Size, _ = strconv.ParseInt(data.Format.Size, 10, 64)
	next.Bitrate, _ = strconv.ParseInt(data.Format.BitRate, 10, 64)
	next.Format = data.Format.FormatName

	for _, stream := range data.Streams {
		if stream == nil {
			continue
		}
		switch stream.CodecType {
		case string(ffprobe.StreamVideo):
			if next.VideoStream == nil {
				next.VideoStream = &dto.VideoStreamInfo{
					Codec:     stream.CodecName,
					Profile:   stream.Profile,
					Width:     stream.Width,
					Height:    stream.Height,
					FrameRate: stream.AvgFrameRate,
				}
			}
		case string(ffprobe.StreamAudio):
			next.AudioStreams = append(next.AudioStreams, &dto.AudioStreamInfo{
				Codec:    stream.CodecName,
				Language: stream.Tags.Language,
				Title:    stream.Tags.Title,
			})
		case string(ffprobe.StreamSubtitle):
			next.SubtitleStreams = append(next.SubtitleStreams, &dto.AudioStreamInfo{
				Codec:    stream.CodecName,
				Language: stream.Tags.Language,
				Title:    stream.Tags.Title,
			})
		}
	}
	lf.TechnicalInfo = &next
}
