package video_analyzer

import (
	"context"
	"fmt"
	"kamehouse/internal/util/cache"
	"path/filepath"
	"runtime"
	"strconv"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"gopkg.in/vansante/go-ffprobe.v2"
)

type VideoInfo struct {
	Filename        string
	Format          string
	Duration        time.Duration
	Size            int64
	Bitrate         int64
	VideoStream     *StreamInfo
	AudioStreams    []*StreamInfo
	SubtitleStreams []*StreamInfo
	FileHash        string
}

type StreamInfo struct {
	Codec     string
	CodecLong string
	Profile   string
	Width     int
	Height    int
	FrameRate string
	Bitrate   int64
	Language  string
	Title     string
}

type Analyzer struct {
	logger *zerolog.Logger
	cache  *cache.Cache[*VideoInfo]
}

func New(logger *zerolog.Logger) *Analyzer {
	return &Analyzer{
		logger: logger,
		cache:  cache.NewCache[*VideoInfo](30 * time.Minute),
	}
}

func NewWithCache(logger *zerolog.Logger, ttl time.Duration) *Analyzer {
	return &Analyzer{
		logger: logger,
		cache:  cache.NewCache[*VideoInfo](ttl),
	}
}

func (a *Analyzer) Analyze(ctx context.Context, filepath string) (*VideoInfo, error) {
	fileHash, err := cache.FileHash(filepath)
	if err != nil {
		a.logger.Debug().Err(err).Str("file", filepath).Msg("video-analyzer: failed to compute file hash, skipping cache")
	} else {
		if cached, ok := a.cache.Get(fileHash); ok {
			a.logger.Debug().Str("file", filepath).Msg("video-analyzer: cache hit")
			return cached, nil
		}
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	data, err := ffprobe.ProbeURL(ctx, filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to probe file: %w", err)
	}

	if len(data.Streams) == 0 {
		return nil, fmt.Errorf("no streams found in file")
	}

	info := &VideoInfo{
		Filename: filepath,
		Format:   data.Format.FormatName,
		Duration: data.Format.Duration(),
		FileHash: fileHash,
	}

	if data.Format.BitRate != "" {
		if br, err := strconv.ParseInt(data.Format.BitRate, 10, 64); err == nil {
			info.Bitrate = br
		}
	}

	if data.Format.Size != "" {
		if size, err := strconv.ParseInt(data.Format.Size, 10, 64); err == nil {
			info.Size = size
		}
	}

	for _, stream := range data.Streams {
		streamInfo := &StreamInfo{
			Codec:     stream.CodecName,
			CodecLong: stream.CodecLongName,
			Profile:   stream.Profile,
			Width:     stream.Width,
			Height:    stream.Height,
			FrameRate: stream.RFrameRate,
			Language:  stream.Tags.Language,
			Title:     stream.Tags.Title,
		}

		if stream.BitRate != "" {
			br, err := strconv.ParseInt(stream.BitRate, 10, 64)
			if err == nil {
				streamInfo.Bitrate = br
			}
		}

		switch stream.CodecType {
		case "video":
			info.VideoStream = streamInfo
		case "audio":
			info.AudioStreams = append(info.AudioStreams, streamInfo)
		case "subtitle":
			info.SubtitleStreams = append(info.SubtitleStreams, streamInfo)
		}
	}

	if fileHash != "" {
		a.cache.Set(fileHash, info)
	}

	return info, nil
}

func (a *Analyzer) AnalyzeFile(ctx context.Context, filename string) (*VideoInfo, error) {
	absPath, err := filepath.Abs(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to get absolute path: %w", err)
	}

	a.logger.Debug().Str("file", absPath).Msg("video-analyzer: analyzing file")

	return a.Analyze(ctx, absPath)
}

func AnalyzeFile(ctx context.Context, filename string, logger *zerolog.Logger) (*VideoInfo, error) {
	return New(logger).AnalyzeFile(ctx, filename)
}

type AnalyzeResult struct {
	Filepath string
	Info     *VideoInfo
	Error    error
}

func (a *Analyzer) AnalyzeParallel(ctx context.Context, filepaths []string) []AnalyzeResult {
	results := make([]AnalyzeResult, len(filepaths))

	workerCount := runtime.NumCPU()
	if workerCount > len(filepaths) {
		workerCount = len(filepaths)
	}
	if workerCount < 1 {
		workerCount = 1
	}

	jobs := make(chan int, len(filepaths))
	var wg sync.WaitGroup

	for w := 0; w < workerCount; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for idx := range jobs {
				fp := filepaths[idx]
				info, err := a.Analyze(ctx, fp)
				results[idx] = AnalyzeResult{
					Filepath: fp,
					Info:     info,
					Error:    err,
				}
			}
		}()
	}

	for i := range filepaths {
		jobs <- i
	}
	close(jobs)

	wg.Wait()

	return results
}

func AnalyzeFilesParallel(ctx context.Context, filepaths []string, logger *zerolog.Logger) []AnalyzeResult {
	return New(logger).AnalyzeParallel(ctx, filepaths)
}

func (a *Analyzer) ClearCache() {
	a.cache.Clear()
}

func (a *Analyzer) CacheSize() int {
	return a.cache.Size()
}
