package metadata_provider

import (
	"regexp"
	"strconv"
)

var (
	reDigitsOnly  = regexp.MustCompile(`[0-9]+`)
	reDigitsGroup = regexp.MustCompile(`([0-9]+)`)
)

func ExtractEpisodeInteger(s string) (int, bool) {
	// Find the first match in the input string.
	match := reDigitsOnly.FindString(s)

	if match != "" {
		// Convert the matched string to an integer.
		num, err := strconv.Atoi(match)
		if err != nil {
			return 0, false
		}
		return num, true
	}

	return 0, false
}

func OffsetAnidbEpisode(s string, offset int) string {
	if offset == 0 {
		return s
	}

	// Replace the first matched integer with the incremented value.
	result := reDigitsGroup.ReplaceAllStringFunc(s, func(matched string) string {
		num, err := strconv.Atoi(matched)
		if err == nil {
			num = num + offset
			return strconv.Itoa(num)
		} else {
			return matched
		}
	})

	return result
}
