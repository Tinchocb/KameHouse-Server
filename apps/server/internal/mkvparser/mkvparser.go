package mkvparser

import (
	"context"
	"fmt"
	"io"
	"kamehouse/internal/matroska"
	"path/filepath"
	"strings"
	"sync"

	"github.com/rs/zerolog"
	"github.com/samber/lo"
)

var subtitleExtensions = map[string]struct{}{".ass": {}, ".ssa": {}, ".srt": {}, ".vtt": {}, ".txt": {}}
var fontExtensions = map[string]struct{}{".ttf": {}, ".ttc": {}, ".woff": {}, ".woff2": {}, ".bdf": {}, ".otf": {}, ".cff": {}, ".otc": {}, ".pfa": {}, ".pfb": {}, ".pcf": {}, ".pfr": {}, ".fnt": {}, ".eot": {}}

// MetadataParser parses Matroska metadata from a file.
type MetadataParser struct {
	reader       io.ReadSeeker
	logger       *zerolog.Logger
	realLogger   *zerolog.Logger
	parseErr     error
	parseOnce    sync.Once
	metadataOnce sync.Once

	// Internal state for parsing
	demuxer *matroska.Demuxer

	// Result
	extractedMetadata *Metadata
}

// NewMetadataParser creates a new MetadataParser.
func NewMetadataParser(reader io.ReadSeeker, logger *zerolog.Logger) *MetadataParser {
	return &MetadataParser{
		reader:            reader,
		logger:            logger,
		realLogger:        logger,
		extractedMetadata: nil,
	}
}

// convertTrackType converts Matroska track type uint to a string representation.
func convertTrackType(trackType uint8) TrackType {
	switch trackType {
	case matroska.TypeVideo:
		return TrackTypeVideo
	case matroska.TypeAudio:
		return TrackTypeAudio
	case matroska.TypeSubtitle:
		return TrackTypeSubtitle
	default:
		return TrackTypeUnknown
	}
}

func getLanguageCode(track *TrackInfo) string {
	if track.LanguageIETF != "" {
		return track.LanguageIETF
	}
	if track.Language != "" && track.Language != "und" {
		return track.Language
	}
	return "eng"
}

// parseMetadataOnce performs the actual parsing of the file stream.
func (mp *MetadataParser) parseMetadataOnce(_ context.Context) {
	mp.parseOnce.Do(func() {
		mp.logger.Debug().Msg("mkvparser: Starting metadata parsing")

		_, _ = mp.reader.Seek(0, io.SeekStart)

		// Create demuxer
		demuxer, err := matroska.NewDemuxer(mp.reader,
			matroska.IDSegmentInfo,
			matroska.IDSegment,
			matroska.IDTags,
			matroska.IDTracks,
			matroska.IDChapters,
			matroska.IDAttachments,
		)
		if err != nil {
			mp.logger.Error().Err(err).Msg("mkvparser: Failed to create demuxer")
			mp.parseErr = fmt.Errorf("mkvparser: Failed to create demuxer: %w", err)
			return
		}

		mp.demuxer = demuxer
		mp.logger.Debug().Msg("mkvparser: Metadata parsing completed")
	})
}

// GetMetadata extracts all relevant metadata from the file.
func (mp *MetadataParser) GetMetadata(ctx context.Context) *Metadata {
	mp.parseMetadataOnce(ctx)

	mp.metadataOnce.Do(func() {
		if mp.parseErr != nil {
			mp.extractedMetadata = &Metadata{
				Error: mp.parseErr,
			}
			return
		}

		result := &Metadata{
			VideoTracks:    make([]*TrackInfo, 0),
			AudioTracks:    make([]*TrackInfo, 0),
			SubtitleTracks: make([]*TrackInfo, 0),
			Tracks:         make([]*TrackInfo, 0),
			Chapters:       make([]*ChapterInfo, 0),
			Attachments:    make([]*AttachmentInfo, 0),
			Tags:           make(map[string][]string),
		}

		// Get file info
		fileInfo, err := mp.demuxer.GetFileInfo()
		if err != nil {
			mp.logger.Error().Err(err).Msg("mkvparser: Failed to get file info")
			result.Error = err
			mp.extractedMetadata = result
			return
		}

		result.Title = fileInfo.Title
		result.MuxingApp = fileInfo.MuxingApp
		result.WritingApp = fileInfo.WritingApp
		result.TimecodeScale = float64(fileInfo.TimecodeScale)
		if fileInfo.Duration > 0 {
			// Duration in matroska-go is in nanoseconds, convert to seconds
			result.Duration = float64(fileInfo.Duration) / 1e9
		}

		result.Tags = flattenMatroskaTags(mp.demuxer.GetTags())

		// Get tracks
		numTracks, err := mp.demuxer.GetNumTracks()
		if err != nil {
			mp.logger.Error().Err(err).Msg("mkvparser: Failed to get number of tracks")
			result.Error = err
			mp.extractedMetadata = result
			return
		}

		for i := uint(0); i < numTracks; i++ {
			trackInfo, err := mp.demuxer.GetTrackInfo(i)
			if err != nil {
				mp.logger.Error().Err(err).Uint("track", i).Msg("mkvparser: Failed to get track info")
				continue
			}

			track := &TrackInfo{
				Number:       int64(trackInfo.Number),
				UID:          trackInfo.UID,
				Type:         convertTrackType(trackInfo.Type),
				CodecID:      trackInfo.CodecID,
				Name:         trackInfo.Name,
				Language:     trackInfo.Language,
				LanguageIETF: trackInfo.LanguageIETF,
				Default:      trackInfo.Default,
				Forced:       trackInfo.Forced,
				Enabled:      trackInfo.Enabled,
				CodecPrivate: string(trackInfo.CodecPrivate),
			}

			// Convert video info
			if trackInfo.Type == matroska.TypeVideo {
				track.Video = &VideoTrack{
					PixelWidth:  uint64(trackInfo.Video.PixelWidth),
					PixelHeight: uint64(trackInfo.Video.PixelHeight),
				}
			}

			// Convert audio info
			if trackInfo.Type == matroska.TypeAudio {
				track.Audio = &AudioTrack{
					SamplingFrequency: trackInfo.Audio.SamplingFreq,
					Channels:          uint64(trackInfo.Audio.Channels),
					BitDepth:          uint64(trackInfo.Audio.BitDepth),
				}
			}

			// Store compression info
			if trackInfo.CompEnabled {
				track.contentEncodings = &ContentEncodings{
					ContentEncoding: []ContentEncoding{
						{
							ContentCompression: &ContentCompression{
								ContentCompAlgo: uint64(trackInfo.CompMethod),
							},
						},
					},
				}
			}

			track.defaultDuration = trackInfo.DefaultDuration

			result.Tracks = append(result.Tracks, track)

			switch track.Type {
			case TrackTypeVideo:
				result.VideoTracks = append(result.VideoTracks, track)
			case TrackTypeAudio:
				result.AudioTracks = append(result.AudioTracks, track)
			case TrackTypeSubtitle:
				// Fix missing fields
				track.Name = lo.If(track.Name != "", track.Name).Else(strings.ToUpper(lo.If(track.Language != "", track.Language).Else(track.LanguageIETF)))
				track.Language = getLanguageCode(track)
				result.SubtitleTracks = append(result.SubtitleTracks, track)
			}
		}

		// Get chapters
		chapters := mp.demuxer.GetChapters()
		for _, chapter := range chapters {
			chapterInfo := &ChapterInfo{
				UID:   chapter.UID,
				Start: float64(chapter.Start) / 1e9, // Convert nanoseconds to seconds
				End:   float64(chapter.End) / 1e9,
			}

			if len(chapter.Display) > 0 {
				chapterInfo.Text = chapter.Display[0].String
				for _, display := range chapter.Display {
					if display.Language != "" {
						chapterInfo.Languages = append(chapterInfo.Languages, display.Language)
					}
				}
			}

			result.Chapters = append(result.Chapters, chapterInfo)
		}

		// Get attachments
		attachments := mp.demuxer.GetAttachments()
		for _, attachment := range attachments {
			attachmentInfo := &AttachmentInfo{
				UID:         attachment.UID,
				Filename:    attachment.Name,
				Mimetype:    attachment.MimeType,
				Size:        int(attachment.Length),
				Description: attachment.Description,
				Data:        attachment.Data,
			}

			//// Extract attachment data from file
			//data, err := mp.extractAttachmentData(attachment.Position, attachment.Length)
			//if err != nil {
			//	mp.logger.Error().Err(err).Str("filename", attachment.Name).Msg("mkvparser: Failed to extract attachment data")
			//} else {
			//	attachmentInfo.Data = data
			//	attachmentInfo.Size = len(data)
			//}

			// Determine attachment type
			fileExt := strings.ToLower(filepath.Ext(attachment.Name))
			if _, ok := fontExtensions[fileExt]; ok {
				attachmentInfo.Type = AttachmentTypeFont
			} else if _, ok := subtitleExtensions[fileExt]; ok {
				attachmentInfo.Type = AttachmentTypeSubtitle
			} else {
				attachmentInfo.Type = AttachmentTypeOther
			}

			result.Attachments = append(result.Attachments, attachmentInfo)
		}

		mp.logger.Debug().
			Int("tracks", len(result.Tracks)).
			Int("chapters", len(result.Chapters)).
			Int("attachments", len(result.Attachments)).
			Msg("mkvparser: Metadata parsing complete")

		// Generate MimeCodec string
		result.MimeCodec = mp.generateMimeCodec(result)

		mp.extractedMetadata = result
	})

	return mp.extractedMetadata
}

// extractAttachmentData reads attachment data from the file at the given position
//func (mp *MetadataParser) extractAttachmentData(position uint64, length uint64) ([]byte, error) {
//	// Seek to attachment position
//	_, err := mp.reader.Seek(int64(position), io.SeekStart)
//	if err != nil {
//		return nil, fmt.Errorf("failed to seek to attachment: %w", err)
//	}
//
//	// Read attachment data
//	data := make([]byte, length)
//	n, err := io.ReadFull(mp.reader, data)
//	if err != nil {
//		return nil, fmt.Errorf("failed to read attachment data: %w", err)
//	}
//
//	if n != int(length) {
//		return nil, fmt.Errorf("attachment data size mismatch: expected %d, got %d", length, n)
//	}
//
//	// Try to decompress if it's zlib compressed
//	if len(data) > 2 && data[0] == 0x78 { // zlib magic number
//		zlibReader, err := zlib.NewReader(bytes.NewReader(data))
//		if err == nil {
//			decompressed, err := io.ReadAll(zlibReader)
//			_ = zlibReader.Close()
//			if err == nil {
//				return decompressed, nil
//			}
//		}
//	}
//
//	return data, nil
//}

// generateMimeCodec generates RFC 6381 codec string
func (mp *MetadataParser) generateMimeCodec(metadata *Metadata) string {
	var codecStrings []string
	seenCodecs := make(map[string]bool)

	if len(metadata.VideoTracks) > 0 {
		firstVideoTrack := metadata.VideoTracks[0]
		var videoCodecStr string
		switch firstVideoTrack.CodecID {
		case "V_MPEGH/ISO/HEVC":
			videoCodecStr = "hvc1"
		case "V_MPEG4/ISO/AVC":
			videoCodecStr = "avc1"
		case "V_AV1":
			videoCodecStr = "av01"
		case "V_VP9":
			videoCodecStr = "vp09"
		case "V_VP8":
			videoCodecStr = "vp8"
		default:
			if firstVideoTrack.CodecID != "" {
				videoCodecStr = strings.ToLower(strings.ReplaceAll(firstVideoTrack.CodecID, "/", "."))
			}
		}
		if videoCodecStr != "" && !seenCodecs[videoCodecStr] {
			codecStrings = append(codecStrings, videoCodecStr)
			seenCodecs[videoCodecStr] = true
		}
	}

	for _, audioTrack := range metadata.AudioTracks {
		var audioCodecStr string
		switch audioTrack.CodecID {
		case "A_AAC":
			audioCodecStr = "mp4a.40.2"
		case "A_AC3":
			audioCodecStr = "ac-3"
		case "A_EAC3":
			audioCodecStr = "ec-3"
		case "A_OPUS":
			audioCodecStr = "opus"
		case "A_DTS":
			audioCodecStr = "dts"
		case "A_FLAC":
			audioCodecStr = "flac"
		case "A_TRUEHD":
			audioCodecStr = "mlp"
		default:
			if audioTrack.CodecID != "" {
				audioCodecStr = strings.ToLower(strings.ReplaceAll(audioTrack.CodecID, "/", "."))
			}
		}
		if audioCodecStr != "" && !seenCodecs[audioCodecStr] {
			codecStrings = append(codecStrings, audioCodecStr)
			seenCodecs[audioCodecStr] = true
		}
	}

	ret := ""
	if len(codecStrings) > 0 {
		ret = fmt.Sprintf("video/x-matroska; codecs=\"%s\"", strings.Join(codecStrings, ", "))
	} else {
		ret = "video/x-matroska"
	}

	return ret
}

func flattenMatroskaTags(tags []*matroska.Tag) map[string][]string {
	ret := make(map[string][]string)
	for _, tag := range tags {
		if tag == nil {
			continue
		}
		for _, simpleTag := range tag.SimpleTags {
			name := normalizeMatroskaTagName(simpleTag.Name)
			value := strings.TrimSpace(simpleTag.Value)
			if name == "" || value == "" {
				continue
			}
			ret[name] = append(ret[name], value)
		}
	}
	return ret
}

func normalizeMatroskaTagName(name string) string {
	name = strings.TrimSpace(strings.ToUpper(name))
	name = strings.NewReplacer(" ", "_", "-", "_").Replace(name)
	return name
}
