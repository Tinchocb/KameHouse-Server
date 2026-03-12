package streaming

import (
	"context"
	"fmt"
	"strconv"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/util/filecache"

	"github.com/rs/zerolog"
)

// StreamOrchestrator is entirely decoupled from HTTP — it only returns structs/URLs.
type StreamOrchestrator struct {
	logger             *zerolog.Logger
	db                 *db.Database
	mediaInfoExtractor *videofile.MediaInfoExtractor
	transcoder         *FfmpegTranscoder
}

type StreamingOptions struct {
	FfmpegPath string
}

// OrchestratorResponse is transport-agnostic: callers map it to HTTP, WS, or native player contracts.
type OrchestratorResponse struct {
	Decision Decision `json:"decision"`
	PlayURL  string   `json:"playUrl"`
}

func NewStreamOrchestrator(database *db.Database, logger *zerolog.Logger, cache *filecache.Cacher, opts *StreamingOptions) *StreamOrchestrator {
	ffmpegPath := "ffmpeg"
	if opts != nil && opts.FfmpegPath != "" {
		ffmpegPath = opts.FfmpegPath
	}
	return &StreamOrchestrator{
		logger:             logger,
		db:                 database,
		mediaInfoExtractor: videofile.NewMediaInfoExtractor(cache, logger),
		transcoder:         NewTranscoder(ffmpegPath, logger),
	}
}

// HandleRequest resolves the local media file, evaluates playback against the ClientProfile,
// and returns the appropriate URL — all strictly decoupled from HTTP transport.
func (o *StreamOrchestrator) HandleRequest(ctx context.Context, mediaId string, clientProfile ClientProfile) (*OrchestratorResponse, error) {
	mId, err := strconv.Atoi(mediaId)
	if err != nil {
		return nil, fmt.Errorf("invalid mediaId %q: %w", mediaId, err)
	}

	lfs, _, err := db.GetLocalFiles(o.db)
	if err != nil {
		return nil, fmt.Errorf("could not list local files: %w", err)
	}

	var targetFile *dto.LocalFile
	for _, l := range lfs {
		if l.MediaId == mId && l.IsMain() {
			targetFile = l
			break
		}
	}
	if targetFile == nil {
		return nil, fmt.Errorf("media file not found for ID %s", mediaId)
	}

	info, infoErr := o.mediaInfoExtractor.GetInfo(o.transcoder.FfmpegPath, targetFile.GetNormalizedPath())
	if infoErr != nil {
		o.logger.Warn().Err(infoErr).Msg("streaming: media info extraction failed — forcing TRANSCODE fallback")
	}

	decision := EvaluatePlayback(info, clientProfile)

	o.logger.Info().
		Str("method", string(decision.Method)).
		Str("reason", decision.Reason).
		Str("mediaId", mediaId).
		Msg("streaming: orchestration decision")

	var playURL string
	if decision.Method == DirectPlay {
		playURL = fmt.Sprintf("/api/v1/media/%s/direct", mediaId)
	} else {
		// Async FFmpeg HLS session — non-blocking: caller receives the m3u8 URL immediately.
		go func() {
			if _, err := o.transcoder.StartSession(ctx, mediaId, targetFile.GetNormalizedPath()); err != nil {
				o.logger.Error().Err(err).Str("mediaId", mediaId).Msg("streaming: transcode session failed")
			}
		}()
		playURL = fmt.Sprintf("/api/v1/media/%s/hls/master.m3u8", mediaId)
	}

	return &OrchestratorResponse{
		Decision: decision,
		PlayURL:  playURL,
	}, nil
}

// Orchestrate is a backward-compatible wrapper around HandleRequest (int mediaId variant).
func (o *StreamOrchestrator) Orchestrate(ctx context.Context, mediaId int, clientProfile *ClientProfile) (*OrchestratorResponse, error) {
	profile := ClientProfile{}
	if clientProfile != nil {
		profile = *clientProfile
	}
	return o.HandleRequest(ctx, strconv.Itoa(mediaId), profile)
}
