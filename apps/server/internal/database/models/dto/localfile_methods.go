package dto

import (
	"cmp"
	"kamehouse/internal/util"
	"kamehouse/internal/util/comparison"
	"regexp"
	"strings"

	"github.com/samber/lo"
)

//----------------------------------------------------------------------------------------------------------------------

// GetEpisodeNumber returns the first episode number from the metadata episodes array.
// This requires the LocalFile to be hydrated.
func (f *LocalFile) GetEpisodeNumber() int {
	if f.Metadata == nil {
		return -1
	}
	// Fallback to legacy Episode field for backwards compatibility
	if len(f.Metadata.Episodes) == 0 && f.Metadata.Episode > 0 {
		return f.Metadata.Episode
	}
	if len(f.Metadata.Episodes) == 0 {
		return -1
	}
	return f.Metadata.Episodes[0]
}

func (f *LocalFile) GetParsedEpisodeTitle() string {
	if f.ParsedData == nil {
		return ""
	}
	return f.ParsedData.EpisodeTitle
}

// GetType returns the metadata type.
// This requires the LocalFile to be hydrated.
func (f *LocalFile) GetType() LocalFileType {
	if f == nil || f.Metadata == nil {
		return ""
	}
	return f.Metadata.Type
}

// IsMain returns true if the metadata type is LocalFileTypeMain
func (f *LocalFile) IsMain() bool {
	if f == nil || f.Metadata == nil {
		return false
	}
	return f.Metadata.Type == LocalFileTypeMain
}

// GetMetadata returns the file metadata.
// This requires the LocalFile to be hydrated.
func (f *LocalFile) GetMetadata() *LocalFileMetadata {
	if f == nil {
		return nil
	}
	return f.Metadata
}

func (f *LocalFile) IsLocked() bool {
	return f.Locked
}

func (f *LocalFile) IsIgnored() bool {
	return f.Ignored
}

// GetNormalizedPath returns the lowercase path of the LocalFile.
// Use this for comparison.
func (f *LocalFile) GetNormalizedPath() string {
	return util.NormalizePath(f.Path)
}

func (f *LocalFile) GetPath() string {
	return f.Path
}

func (f *LocalFile) HasSamePath(path string) bool {
	return f.GetNormalizedPath() == util.NormalizePath(path)
}

// getRegexCompFilename returns a normalized filename without words that could mess up regex comparisons
func (f *LocalFile) getRegexCompFilename() (ret string) {
	ret = f.ParsedData.Original
	if f.ParsedData.EpisodeTitle != "" {
		ret = strings.Replace(ret, f.ParsedData.EpisodeTitle, "PLACEHOLDER", 1)
	}
	if f.ParsedData.ReleaseGroup != "" {
		ret = strings.Replace(ret, f.ParsedData.ReleaseGroup, "PLACEHOLDER", 1)
	}
	return
}

func (f *LocalFile) IsProbablyNC() bool {
	return comparison.ValueContainsNC(f.getRegexCompFilename())
}

func (f *LocalFile) IsProbablySpecial() bool {
	return comparison.ValueContainsSpecial(f.getRegexCompFilename())
}

// GetParsedTitle returns the parsed title of the LocalFile. Falls back to the folder title if the file title is empty.
func (f *LocalFile) GetParsedTitle() string {
	return cmp.Or(f.ParsedData.Title, f.GetFolderTitle())
}

// GetFolderTitle returns the parsed title of the closest folder to the file.
// It will ignore any folder titles that are simply keywords like "specials", "extras", etc.
// If all is true, it will return the title regardless of whether it's a keyword or not.
func (f *LocalFile) GetFolderTitle(all ...bool) string {
	folderTitles := make([]string, 0)
	if len(f.ParsedFolderData) > 0 {
		// Go through each folder data and keep the ones with a title
		data := lo.Filter(f.ParsedFolderData, func(fpd *LocalFileParsedData, _ int) bool {
			// remove non-anime titles
			cleanTitle := strings.TrimSpace(strings.ToLower(fpd.Title))
			if len(all) == 0 || !all[0] {
				if _, ok := comparison.IgnoredFilenames[cleanTitle]; ok {
					return false
				}
				// Also check the original folder name for ignored keywords
				if comparison.ValueContainsIgnoredKeywords(fpd.Original) {
					return false
				}
			}
			return len(cleanTitle) > 0
		})
		if len(data) == 0 {
			return ""
		}
		// Get the titles
		for _, v := range data {
			folderTitles = append(folderTitles, v.Title)
		}
		// If there are multiple titles, return the one closest to the end
		return folderTitles[len(folderTitles)-1]
	}

	return ""
}

// GetSeriesFolderTitle returns the series title from the folder hierarchy,
// walking up from the file's parent folder and skipping seasons, sagas, parts,
// and category folders to find the actual series folder.
func (f *LocalFile) GetSeriesFolderTitle() string {
	if len(f.ParsedFolderData) == 0 {
		return ""
	}

	for i := len(f.ParsedFolderData) - 1; i >= 0; i-- {
		fpd := f.ParsedFolderData[i]
		cleanTitle := strings.TrimSpace(strings.ToLower(fpd.Title))
		if cleanTitle == "" {
			continue
		}
		if _, ok := comparison.IgnoredFilenames[cleanTitle]; ok {
			continue
		}
		if comparison.ValueContainsIgnoredKeywords(fpd.Original) {
			continue
		}
		if isSeasonOrSagaFolderNameDTO(fpd.Original) {
			continue
		}
		return fpd.Title
	}
	return ""
}

var (
	reSeasonFolderInDTO = regexp.MustCompile(`(?i)^(?:season|s|temp|temporada|t)\s*0*(\d+)$`)
	reSagaFolderInDTO   = regexp.MustCompile(`(?i)^(?:(?:[\(\[]?\d{2,4}(?:-\d{2}-\d{2})?[\)\]]?\s*[-–]?\s*)|\d+\s*[-–]\s*)?(?:saga|arco?|arc|part|parte)\s+|saga\b`)
)

func isSeasonOrSagaFolderNameDTO(name string) bool {
	clean := strings.TrimSpace(name)
	return reSeasonFolderInDTO.MatchString(clean) || reSagaFolderInDTO.MatchString(clean)
}
