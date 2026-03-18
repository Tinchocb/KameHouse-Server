package parser

import (
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// ParsedMedia contains the clean extracted metadata from a raw filename.
type ParsedMedia struct {
	Title        string
	Season       int
	Episode      int
	Resolution   string
	ReleaseGroup string
}

var (
	// crc32Regex matches an 8-character hex code inside brackets, usually at the end of anime files.
	crc32Regex = regexp.MustCompile(`(?i)\[[0-9A-F]{8}\]`)
	
	// releaseGroupRegex matches the leading bracket group e.g. [Erai-raws]
	releaseGroupRegex = regexp.MustCompile(`^\[([^\]]+)\]\s*`)

	// occidentalRegex matches TV scene rules: "Show.S01E02" or "Show 1x02"
	occidentalRegex = regexp.MustCompile(`(?i)^(.*?)[. ](?:s(\d{1,2})e(\d{1,4})|(\d{1,2})x(\d{1,4}))`)

	// animeRangeRegex matches episode ranges like "01-02", "01~02"
	animeRangeRegex = regexp.MustCompile(`(?i)^(.*?)\s+(?:-|~)?\s*0*(\d{1,4})\s*[-~]\s*0*(\d{1,4})(?:v\d)?\s*$`)

	// animeHyphenRegex matches "Title - 01" or "Title - 01v2"
	animeHyphenRegex = regexp.MustCompile(`(?i)^(.*?)\s+-\s+0*(\d{1,4})(?:v\d)?\s*(?:[\[\(].*?[\]\)])*\s*$`)

	// animeAbsoluteRegex matches "Title 01" without a hyphen where the number is at the end of the cleaned string
	animeAbsoluteRegex = regexp.MustCompile(`(?i)^(.*?)\s+0*(\d{1,4})(?:v\d)?\s*$`)

	// resolutionRegex searches for standard resolutions
	resolutionRegex = regexp.MustCompile(`(?i)(1080p|720p|2160p|480p|4K|960p)`)
	
	// cleanSymbolsRegex cleans trailing garbage from titles
	cleanSymbolsRegex = regexp.MustCompile(`[._\-]`)
)

// Parse attempts to extract Title, Season, Episode, Resolution, and ReleaseGroup.
func Parse(filename string) ParsedMedia {
	base := strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename))

	pm := ParsedMedia{
		Season:     1,
		Episode:    1,
		Resolution: "UNKNOWN",
	}

	// Extract and Remove Resolution
	if res := resolutionRegex.FindStringSubmatch(base); res != nil {
		pm.Resolution = strings.ToUpper(res[1])
		base = resolutionRegex.ReplaceAllString(base, "")
	}

	// Remove CRC32 Hashes
	base = crc32Regex.ReplaceAllString(base, "")

	// Extract Release Group at the start
	if rg := releaseGroupRegex.FindStringSubmatch(base); rg != nil {
		pm.ReleaseGroup = strings.TrimSpace(rg[1])
		base = strings.TrimPrefix(base, rg[0])
	}

	// Check Occidental (S01E02)
	if match := occidentalRegex.FindStringSubmatch(base); match != nil {
		pm.Title = cleanTitle(match[1])
		sStr, eStr := match[2], match[3]
		if match[4] != "" {
			sStr, eStr = match[4], match[5]
		}
		pm.Season, _ = strconv.Atoi(sStr)
		pm.Episode, _ = strconv.Atoi(eStr)
		return pm
	}

	// Check Episode Ranges (10-12)
	// We extract the base string by ignoring bracket tags momentarily for matching the end
	cleanedForAbsolute := regexp.MustCompile(`\[.*?\]|\(.*?\)`).ReplaceAllString(base, "")
	cleanedForAbsolute = strings.TrimSpace(cleanedForAbsolute)

	if match := animeRangeRegex.FindStringSubmatch(cleanedForAbsolute); match != nil && match[1] != "" {
		pm.Title = cleanTitle(match[1])
		pm.Episode, _ = strconv.Atoi(match[2])
		return pm
	}

	// Check Anime Hyphen (Title - 01)
	if match := animeHyphenRegex.FindStringSubmatch(base); match != nil {
		pm.Title = cleanTitle(match[1])
		pm.Episode, _ = strconv.Atoi(match[2])
		return pm
	}

	// Check Absolute Numbering (Title 01)
	if match := animeAbsoluteRegex.FindStringSubmatch(cleanedForAbsolute); match != nil {
		pm.Title = cleanTitle(match[1])
		pm.Episode, _ = strconv.Atoi(match[2])
		return pm
	}

	pm.Title = cleanTitle(base)
	return pm
}

func cleanTitle(raw string) string {
	clean := cleanSymbolsRegex.ReplaceAllString(raw, " ")
	return strings.TrimSpace(strings.Join(strings.Fields(clean), " "))
}
