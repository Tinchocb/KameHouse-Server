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
	Episodes     []int // Multi-episode support: [1, 2, 3] for ranges like "01-03"
	Resolution  string
	ReleaseGroup string
	IsMulti     bool // Flag indicating multi-episode file

	// Deprecated: Use Episodes instead. Kept for backwards compatibility.
	Episode int
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
	resolutionRegex = regexp.MustCompile(`(?i)\b(2160p|1080p|960p|720p|480p|4k|8k)\b`)

	// bracketedTagRegex removes every bracketed/parenthesized release tag, no matter where it appears.
	bracketedTagRegex = regexp.MustCompile(`\[[^\]]*\]|\([^)]*\)`)

	// noisyTokenRegex catches common technical tokens that should never become part of the title.
	noisyTokenRegex = regexp.MustCompile(`(?i)\b(?:2160p|1080p|960p|720p|480p|4k|8k|uhd|hdr10?|dv|dolby\s*vision|hevc|x265|h\.?265|x264|h\.?264|avc|av1|aac|flac|opus|dts|truehd|atmos|ddp?|eac3|ac3|web[-_. ]?dl|webrip|bluray|blu[-_. ]?ray|bdrip|dvdrip|hdrip|remux|proper|repack|batch|dual[-_. ]?audio|multi[-_. ]?subs?|multi[-_. ]?audio|10[-_. ]?bit|8[-_. ]?bit|hi10p)\b`)

	// emptySeparatorRunsRegex collapses separators left behind by removed tags and codecs.
	emptySeparatorRunsRegex = regexp.MustCompile(`[\s._]+`)

	// cleanSymbolsRegex cleans trailing garbage from titles
	cleanSymbolsRegex = regexp.MustCompile(`[._\-]`)
)

// Parse attempts to extract Title, Season, Episode(s), Resolution, and ReleaseGroup.
func Parse(filename string) ParsedMedia {
	base := strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename))

	pm := ParsedMedia{
		Season:     1,
		Episodes:   []int{1},
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

	base = sanitizeSubGroupTags(base)

	// Check Occidental (S01E02)
	if match := occidentalRegex.FindStringSubmatch(base); match != nil {
		pm.Title = cleanTitle(match[1])
		sStr, eStr := match[2], match[3]
		if match[4] != "" {
			sStr, eStr = match[4], match[5]
		}
		pm.Season, _ = strconv.Atoi(sStr)
		epNum, _ := strconv.Atoi(eStr)
		pm.Episodes = []int{epNum}
		return pm
	}

	// Check Episode Ranges (10-12) - Multi-episode support
	cleanedForAbsolute := sanitizeSubGroupTags(base)

	if match := animeRangeRegex.FindStringSubmatch(cleanedForAbsolute); match != nil && match[1] != "" {
		pm.Title = cleanTitle(match[1])
		start, _ := strconv.Atoi(match[2])
		end, _ := strconv.Atoi(match[3])

		// Build episode range array
		if end > start {
			pm.Episodes = make([]int, 0, end-start+1)
			for i := start; i <= end; i++ {
				pm.Episodes = append(pm.Episodes, i)
			}
			pm.IsMulti = true
		} else {
			pm.Episodes = []int{start}
		}
		// Backwards compatibility
		if len(pm.Episodes) > 0 {
			pm.Episode = pm.Episodes[0]
		}
		return pm
	}

	// Check Anime Hyphen (Title - 01)
	if match := animeHyphenRegex.FindStringSubmatch(base); match != nil {
		pm.Title = cleanTitle(match[1])
		epNum, _ := strconv.Atoi(match[2])
		pm.Episodes = []int{epNum}
		pm.Episode = epNum // Backwards compatibility
		return pm
	}

	// Check Absolute Numbering (Title 01)
	if match := animeAbsoluteRegex.FindStringSubmatch(cleanedForAbsolute); match != nil {
		pm.Title = cleanTitle(match[1])
		epNum, _ := strconv.Atoi(match[2])
		pm.Episodes = []int{epNum}
		pm.Episode = epNum // Backwards compatibility
		return pm
	}

	pm.Title = cleanTitle(base)
	return pm
}

// SanitizeSubGroupTags strips fansub, quality, codec and release noise from a title fragment.
func SanitizeSubGroupTags(input string) string {
	return sanitizeSubGroupTags(input)
}

func sanitizeSubGroupTags(input string) string {
	clean := crc32Regex.ReplaceAllString(input, " ")
	clean = bracketedTagRegex.ReplaceAllString(clean, " ")
	clean = resolutionRegex.ReplaceAllString(clean, " ")
	clean = noisyTokenRegex.ReplaceAllString(clean, " ")
	clean = emptySeparatorRunsRegex.ReplaceAllString(clean, " ")
	return strings.TrimSpace(clean)
}

func cleanTitle(raw string) string {
	clean := sanitizeSubGroupTags(raw)
	clean = cleanSymbolsRegex.ReplaceAllString(clean, " ")
	return strings.TrimSpace(strings.Join(strings.Fields(clean), " "))
}
