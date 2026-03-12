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
	// animeRegex matches typical release groups: "[Group] Title - 01"
	animeRegex = regexp.MustCompile(`^(?:\[([^\]]+)\]\s*)?(.*?)\s*-\s*(\d{1,4})`)
	// occidentalRegex matches TV scene rules: "Show.S01E02" or "Show 1x02"
	occidentalRegex = regexp.MustCompile(`^(.*?)[. ](?:s(\d{1,2})e(\d{1,4})|(\d{1,2})x(\d{1,4}))(?i)`)
	// resolutionRegex searches for standard resolutions
	resolutionRegex = regexp.MustCompile(`(?i)(1080p|720p|2160p|480p|4K)`)
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

	if res := resolutionRegex.FindStringSubmatch(base); res != nil {
		pm.Resolution = strings.ToUpper(res[1])
	}

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

	if match := animeRegex.FindStringSubmatch(base); match != nil {
		pm.ReleaseGroup = strings.TrimSpace(match[1])
		pm.Title = cleanTitle(match[2])
		pm.Episode, _ = strconv.Atoi(match[3])
		return pm
	}

	pm.Title = cleanTitle(base)
	return pm
}

func cleanTitle(raw string) string {
	clean := cleanSymbolsRegex.ReplaceAllString(raw, " ")
	return strings.TrimSpace(strings.Join(strings.Fields(clean), " "))
}
