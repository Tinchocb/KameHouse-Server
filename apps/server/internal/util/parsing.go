package util

import (
	"regexp"
	"strconv"
	"strings"
)

// NormalizeResolution normalizes a resolution string to a standard format
func NormalizeResolution(val string) string {
	val = strings.TrimSpace(val)
	valLower := strings.ToLower(val)

	if strings.Contains(valLower, "4k") || strings.Contains(valLower, "2160") {
		return "2160p"
	}
	if strings.Contains(valLower, "2k") || strings.Contains(valLower, "1440") {
		return "1440p"
	}
	if strings.Contains(valLower, "1080") {
		return "1080p"
	}
	if strings.Contains(valLower, "720") {
		return "720p"
	}
	if strings.Contains(valLower, "540") {
		return "540p"
	}
	if strings.Contains(valLower, "480") {
		return "480p"
	}
	if strings.Contains(valLower, "360") {
		return "360p"
	}
	if strings.Contains(valLower, "240") {
		return "240p"
	}
	if strings.Contains(valLower, "144") {
		return "144p"
	}

	return val // Return original if no standard resolution found
}

// ExtractResolutionInt extracts the resolution from a string and returns it as an integer.
// This is used for comparing resolutions.
// If the resolution is not found, it returns 0.
func ExtractResolutionInt(val string) int {
	val = strings.ToLower(val)

	if strings.Contains(val, "4k") || strings.Contains(val, "2160") {
		return 2160
	}
	if strings.Contains(val, "2k") || strings.Contains(val, "1440") {
		return 1440
	}
	if strings.Contains(val, "1080") {
		return 1080
	}
	if strings.Contains(val, "720") {
		return 720
	}
	if strings.Contains(val, "540") {
		return 540
	}
	if strings.Contains(val, "480") {
		return 480
	}

	re := regexp.MustCompile(`^\d{3,4}([pP])$`)
	matches := re.FindStringSubmatch(val)
	if len(matches) > 1 {
		res, err := strconv.Atoi(matches[1])
		if err != nil {
			return 0
		}
		return res
	}

	return 0
}
