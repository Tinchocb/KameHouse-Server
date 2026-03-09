package dto

import (
	"context"
	"kamehouse/internal/library/filesystem"
	"kamehouse/internal/library/scanner/video_analyzer"
	"strconv"
	"time"

	"github.com/5rahim/habari"
	"github.com/nssteinbrenner/anitogo"
	"github.com/rs/zerolog"
)

const (
	LocalFileTypeMain    LocalFileType = "main"    // Main episodes that are trackable
	LocalFileTypeSpecial LocalFileType = "special" // OVA, ONA, etc.
	LocalFileTypeNC      LocalFileType = "nc"      // Opening, ending, etc.
)

type (
	LocalFileType string
	// LocalFile represents a media file on the local filesystem.
	// It is used to store information about and state of the file, such as its path, name, and parsed data.
	LocalFile struct {
		Path             string                 `json:"path"`
		Name             string                 `json:"name"`
		ParsedData       *LocalFileParsedData   `json:"parsedInfo"`
		ParsedFolderData []*LocalFileParsedData `json:"parsedFolderInfo"`
		Metadata         *LocalFileMetadata     `json:"metadata"`
		TechnicalInfo    *FileTechnicalInfo     `json:"technicalInfo,omitempty"`
		Locked           bool                   `json:"locked"`
		Ignored          bool                   `json:"ignored"` // Unused for now
		LibraryMediaId   uint                   `json:"libraryMediaId"`
		MediaId          int                    `json:"mediaId"`
	}

	// FileTechnicalInfo holds FFprobe technical specifications of a video file.
	FileTechnicalInfo struct {
		Duration        time.Duration      `json:"duration,omitempty"`
		Size            int64              `json:"size,omitempty"`
		Bitrate         int64              `json:"bitrate,omitempty"`
		Format          string             `json:"format,omitempty"`
		VideoStream     *VideoStreamInfo   `json:"videoStream,omitempty"`
		AudioStreams    []*AudioStreamInfo `json:"audioStreams,omitempty"`
		SubtitleStreams []*AudioStreamInfo `json:"subtitleStreams,omitempty"` // Reusing Audio structure since they share basic properties
	}

	VideoStreamInfo struct {
		Codec          string `json:"codec,omitempty"`          // e.g. h264, hevc
		Profile        string `json:"profile,omitempty"`        // e.g. High 10, Main
		Width          int    `json:"width,omitempty"`          // 1920
		Height         int    `json:"height,omitempty"`         // 1080
		FrameRate      string `json:"frameRate,omitempty"`      // 24000/1001
		ColorSpace     string `json:"colorSpace,omitempty"`     // e.g. bt2020nc
		ColorTransfer  string `json:"colorTransfer,omitempty"`  // e.g. smpte2084
		ColorPrimaries string `json:"colorPrimaries,omitempty"` // e.g. bt2020
	}

	AudioStreamInfo struct {
		Codec    string `json:"codec,omitempty"`    // e.g. aac, flac
		Language string `json:"language,omitempty"` // e.g. jpn, eng
		Title    string `json:"title,omitempty"`    // e.g. Japanese 5.1
	}

	// LocalFileMetadata holds metadata related to a media episode.
	LocalFileMetadata struct {
		Episode      int           `json:"episode"`
		AniDBEpisode string        `json:"aniDBEpisode"`
		Type         LocalFileType `json:"type"`
	}

	// LocalFileParsedData holds parsed data from a media file's name.
	// This data is used to identify the media file during the scanning process.
	LocalFileParsedData struct {
		Original     string   `json:"original"`
		Title        string   `json:"title,omitempty"`
		ReleaseGroup string   `json:"releaseGroup,omitempty"`
		Season       string   `json:"season,omitempty"`
		SeasonRange  []string `json:"seasonRange,omitempty"`
		Part         string   `json:"part,omitempty"`
		PartRange    []string `json:"partRange,omitempty"`
		Episode      string   `json:"episode,omitempty"`
		EpisodeRange []string `json:"episodeRange,omitempty"`
		EpisodeTitle string   `json:"episodeTitle,omitempty"`
		Year         string   `json:"year,omitempty"`
	}
)

// NewLocalFileS creates and returns a reference to a new LocalFile struct.
// It will parse the file's name and its directory names to extract necessary information.
//   - opath: The full path to the file.
//   - dirPaths: The full paths to the directories that may contain the file. (Library root paths)
func NewLocalFileS(opath string, dirPaths []string) *LocalFile {
	info := filesystem.SeparateFilePathS(opath, dirPaths)
	return newLocalFile(opath, info)
}

// NewLocalFile creates and returns a reference to a new LocalFile struct.
// It will parse the file's name and its directory names to extract necessary information.
//   - opath: The full path to the file.
//   - dirPath: The full path to the directory containing the file. (The library root path)
func NewLocalFile(opath, dirPath string) *LocalFile {
	info := filesystem.SeparateFilePath(opath, dirPath)
	return newLocalFile(opath, info)
}

func newLocalFile(opath string, info *filesystem.SeparatedFilePath) *LocalFile {
	// Parse filename
	fElements := habari.Parse(info.Filename)
	parsedInfo := NewLocalFileParsedData(info.Filename, fElements)

	// Parse dir names
	parsedFolderInfo := make([]*LocalFileParsedData, 0)
	for _, dirname := range info.Dirnames {
		if len(dirname) > 0 {
			pElements := habari.Parse(dirname)
			parsed := NewLocalFileParsedData(dirname, pElements)
			parsedFolderInfo = append(parsedFolderInfo, parsed)
		}
	}

	localFile := &LocalFile{
		Path:             opath,
		Name:             info.Filename,
		ParsedData:       parsedInfo,
		ParsedFolderData: parsedFolderInfo,
		Metadata: &LocalFileMetadata{
			Episode:      0,
			AniDBEpisode: "",
			Type:         "",
		},
		Locked:         false,
		Ignored:        false,
		LibraryMediaId: 0,
		MediaId:        0,
	}

	return localFile
}

// NewLocalFileParsedData Converts habari.Metadata into LocalFileParsedData, which is more suitable.
func NewLocalFileParsedData(original string, elements *habari.Metadata) *LocalFileParsedData {
	i := new(LocalFileParsedData)
	i.Original = original
	i.Title = elements.FormattedTitle
	i.ReleaseGroup = elements.ReleaseGroup
	i.EpisodeTitle = elements.EpisodeTitle
	i.Year = elements.Year

	if len(elements.SeasonNumber) > 0 {
		if len(elements.SeasonNumber) == 1 {
			i.Season = elements.SeasonNumber[0]
		} else {
			i.SeasonRange = elements.SeasonNumber
		}
	}

	if len(elements.EpisodeNumber) > 0 {
		if len(elements.EpisodeNumber) == 1 {
			i.Episode = elements.EpisodeNumber[0]
		} else {
			i.EpisodeRange = elements.EpisodeNumber
		}
	}

	if len(elements.PartNumber) > 0 {
		if len(elements.PartNumber) == 1 {
			i.Part = elements.PartNumber[0]
		} else {
			i.PartRange = elements.PartNumber
		}
	}

	return i
}

// GetAnitogoParsedTitle returns the parsed anime title using anitogo parser
func GetAnitogoParsedTitle(filename string) string {
	parsed := anitogoParse(filename)
	if parsed == nil {
		return ""
	}
	return parsed.AnimeTitle
}

// GetSeasonNumber parses the season number or returns 1 as default.
func (lf *LocalFile) GetSeasonNumber() int {
	// Heuristic: If Episode is extremely high (anime absolute format), the Season is likely a Sonarr/ReleaseGroup dummy wrapper.
	if lf.ParsedData != nil && lf.ParsedData.Episode != "" {
		if ep, err := strconv.Atoi(lf.ParsedData.Episode); err == nil && ep >= 100 {
			return 1 // Drop fake season
		}
	}
	
	if lf.ParsedData != nil && lf.ParsedData.Season != "" {
		if s, err := strconv.Atoi(lf.ParsedData.Season); err == nil {
			return s
		}
	}
	// Fallback to parsed folder data
	for _, f := range lf.ParsedFolderData {
		if f.Season != "" {
			if s, err := strconv.Atoi(f.Season); err == nil {
				return s
			}
		}
	}
	return 1
}

func anitogoParse(filename string) *anitogoElements {
	elements := anitogo.Parse(filename, anitogo.DefaultOptions)
	if elements == nil {
		return nil
	}
	return &anitogoElements{
		AnimeTitle:      elements.AnimeTitle,
		AnimeYear:       elements.AnimeYear,
		EpisodeNumber:   getFirstOrEmpty(elements.EpisodeNumber),
		ReleaseGroup:    elements.ReleaseGroup,
		VideoResolution: elements.VideoResolution,
	}
}

type anitogoElements struct {
	AnimeTitle      string
	AnimeYear       string
	EpisodeNumber   string
	ReleaseGroup    string
	VideoResolution string
}

func getFirstOrEmpty(slice []string) string {
	if len(slice) > 0 {
		return slice[0]
	}
	return ""
}

// GetVideoInfo returns technical information about a video file using ffprobe
func GetVideoInfo(ctx context.Context, filepath string, logger *zerolog.Logger) (*VideoFileInfo, error) {
	analyzer := video_analyzer.New(logger)
	info, err := analyzer.AnalyzeFile(ctx, filepath)
	if err != nil {
		return nil, err
	}

	return &VideoFileInfo{
		Duration:       info.Duration,
		Format:         info.Format,
		Bitrate:        info.Bitrate,
		VideoCodec:     info.VideoStream.Codec,
		VideoWidth:     info.VideoStream.Width,
		VideoHeight:    info.VideoStream.Height,
		AudioLanguages: getAudioLanguages(info.AudioStreams),
		SubtitleCount:  len(info.SubtitleStreams),
	}, nil
}

func getAudioLanguages(streams []*video_analyzer.StreamInfo) []string {
	languages := make([]string, 0, len(streams))
	seen := make(map[string]bool)
	for _, s := range streams {
		if s.Language != "" && !seen[s.Language] {
			seen[s.Language] = true
			languages = append(languages, s.Language)
		}
	}
	return languages
}

type VideoFileInfo struct {
	Duration       time.Duration
	Format         string
	Bitrate        int64
	VideoCodec     string
	VideoWidth     int
	VideoHeight    int
	AudioLanguages []string
	SubtitleCount  int
}
