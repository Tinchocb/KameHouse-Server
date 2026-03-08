package parser

import (
	"github.com/nssteinbrenner/anitogo"
)

type Parser struct {
	opts anitogo.Options
}

type ParsedAnime struct {
	Title           string
	AnimeYear       string
	EpisodeNumber   string
	EpisodeTitle    string
	ReleaseGroup    string
	VideoResolution string
	VideoTerm       string
	AudioTerm       string
	FileExtension   string
	FileChecksum    string
	Source          string
	Subtitles       string
}

type FileInfo struct {
	Title           string
	Episode         int
	EpisodeAlt      string
	Year            string
	Season          int
	ReleaseGroup    string
	VideoResolution string
	Codec           string
	Source          string
	Subtitles       string
}

func New() *Parser {
	return &Parser{
		opts: anitogo.DefaultOptions,
	}
}

func NewWithOptions(opts anitogo.Options) *Parser {
	return &Parser{
		opts: opts,
	}
}

func (p *Parser) Parse(filename string) *ParsedAnime {
	elements := anitogo.Parse(filename, p.opts)

	if elements == nil {
		return nil
	}

	return &ParsedAnime{
		Title:           elements.AnimeTitle,
		AnimeYear:       elements.AnimeYear,
		EpisodeNumber:   getFirstOrEmpty(elements.EpisodeNumber),
		EpisodeTitle:    elements.EpisodeTitle,
		ReleaseGroup:    elements.ReleaseGroup,
		VideoResolution: elements.VideoResolution,
		VideoTerm:       getFirstOrEmpty(elements.VideoTerm),
		AudioTerm:       getFirstOrEmpty(elements.AudioTerm),
		FileExtension:   elements.FileExtension,
		FileChecksum:    elements.FileChecksum,
		Source:          getFirstOrEmpty(elements.Source),
		Subtitles:       getFirstOrEmpty(elements.Subtitles),
	}
}

func ParseFilename(filename string) *ParsedAnime {
	return New().Parse(filename)
}

func (p *Parser) ParseFileInfo(filename string) *FileInfo {
	parsed := p.Parse(filename)

	if parsed == nil {
		return nil
	}

	info := &FileInfo{
		Title:           parsed.Title,
		Year:            parsed.AnimeYear,
		ReleaseGroup:    parsed.ReleaseGroup,
		VideoResolution: parsed.VideoResolution,
		Source:          parsed.Source,
		Subtitles:       parsed.Subtitles,
	}

	if parsed.EpisodeNumber != "" {
		info.Episode = parseEpisodeNumber(parsed.EpisodeNumber)
	}

	info.EpisodeAlt = parsed.EpisodeNumber
	info.Codec = parsed.VideoTerm

	return info
}

func ParseFile(filename string) *FileInfo {
	return New().ParseFileInfo(filename)
}

func parseEpisodeNumber(ep string) int {
	num := 0
	for _, c := range ep {
		if c >= '0' && c <= '9' {
			num = num*10 + int(c-'0')
		}
	}
	return num
}

func getFirstOrEmpty(slice []string) string {
	if len(slice) > 0 {
		return slice[0]
	}
	return ""
}
