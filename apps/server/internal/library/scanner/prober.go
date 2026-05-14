package scanner

import (
	"context"
	"kamehouse/internal/database/models/dto"
	"runtime"
	"strconv"
	"sync"
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
	if len(files) == 0 {
		return
	}

	p.Logger.Info().Int("count", len(files)).Msg("scanner: Initiating parallel file probing...")

	maxWorkers := runtime.NumCPU()
	if maxWorkers < 2 {
		maxWorkers = 2
	}
	if maxWorkers > 8 {
		maxWorkers = 8 // Cap it to avoid too many simultaneous FFprobe processes
	}

	jobs := make(chan *dto.LocalFile, len(files))
	for _, lf := range files {
		jobs <- lf
	}
	close(jobs)

	var wg sync.WaitGroup
	for i := 0; i < maxWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for lf := range jobs {
				select {
				case <-ctx.Done():
					return
				default:
				}

				// 1. Try fast MKV parsing first (covers most anime collections)
				if isMatroskaPath(lf.Path) {
					ingestLocalFileEmbeddedMetadata(ctx, lf, p.Logger)
				}

				// 2. If TechnicalInfo is still empty or missing basic fields, fallback to FFprobe
				if shouldFallbackToFFprobe(lf) && p.FFprobePath != "" {
					p.probeWithFFprobe(ctx, lf)
				}
			}
		}()
	}
	wg.Wait()
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
	ffprobe.SetFFProbeBinPath(p.FFprobePath)

	ffprobeCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	data, err := ffprobe.ProbeURL(ffprobeCtx, lf.Path)
	if err != nil {
		p.Logger.Debug().Err(err).Str("path", lf.Path).Msg("scanner: FFprobe failed")
		return
	}

	if lf.TechnicalInfo == nil {
		lf.TechnicalInfo = &dto.FileTechnicalInfo{}
	}

	lf.TechnicalInfo.Duration = time.Duration(data.Format.DurationSeconds) * time.Second
	lf.TechnicalInfo.Size, _ = strconv.ParseInt(data.Format.Size, 10, 64)
	lf.TechnicalInfo.Bitrate, _ = strconv.ParseInt(data.Format.BitRate, 10, 64)
	lf.TechnicalInfo.Format = data.Format.FormatName

	for _, stream := range data.Streams {
		switch stream.CodecType {
		case string(ffprobe.StreamVideo):
			if lf.TechnicalInfo.VideoStream == nil {
				lf.TechnicalInfo.VideoStream = &dto.VideoStreamInfo{
					Codec:     stream.CodecName,
					Profile:   stream.Profile,
					Width:     stream.Width,
					Height:    stream.Height,
					FrameRate: stream.AvgFrameRate,
				}
			}
		case string(ffprobe.StreamAudio):
			lf.TechnicalInfo.AudioStreams = append(lf.TechnicalInfo.AudioStreams, &dto.AudioStreamInfo{
				Codec:    stream.CodecName,
				Language: stream.Tags.Language,
				Title:    stream.Tags.Title,
			})
		case string(ffprobe.StreamSubtitle):
			lf.TechnicalInfo.SubtitleStreams = append(lf.TechnicalInfo.SubtitleStreams, &dto.AudioStreamInfo{
				Codec:    stream.CodecName,
				Language: stream.Tags.Language,
				Title:    stream.Tags.Title,
			})
		}
	}
}
