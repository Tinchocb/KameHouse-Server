package util

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"unicode"

	"github.com/dustin/go-humanize"
)

func Bytes(size uint64) string {
	switch runtime.GOOS {
	case "darwin":
		return humanize.Bytes(size)
	default:
		return humanize.IBytes(size)
	}
}

func Decode(s string) string {
	decoded, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return ""
	}
	return string(decoded)
}

func IsMostlyLatinString(str string) bool {
	if len(str) <= 0 {
		return false
	}
	latinLength := 0
	nonLatinLength := 0
	for _, r := range str {
		if isLatinRune(r) {
			latinLength++
		} else {
			nonLatinLength++
		}
	}
	return latinLength > nonLatinLength
}

func isLatinRune(r rune) bool {
	return unicode.In(r, unicode.Latin)
}

func Pluralize(count int, singular, plural string) string {
	if count == 1 {
		return singular
	}
	return plural
}

// NormalizePath normalizes a path by converting it to lowercase and replacing backslashes with forward slashes
// Warning: Do not use the returned string for anything filesystem related, only for comparison
func NormalizePath(path string) (ret string) {
	if runtime.GOOS == "windows" {
		return strings.ToLower(filepath.ToSlash(path))
	}
	return filepath.ToSlash(path)
}

func Base64DecodeStr(str string) (string, error) {
	decoded, err := base64.StdEncoding.DecodeString(str)
	if err != nil {
		return "", err
	}
	return string(decoded), nil
}

func IsBase64(s string) bool {
	// 1. Check if string is empty
	if len(s) == 0 {
		return false
	}

	// 2. Check if length is valid (must be multiple of 4)
	if len(s)%4 != 0 {
		return false
	}

	// 3. Check for valid padding
	padding := strings.Count(s, "=")
	if padding > 2 {
		return false
	}

	// 4. Check if padding is at the end only
	if padding > 0 && !strings.HasSuffix(s, strings.Repeat("=", padding)) {
		return false
	}

	// 5. Check if string contains only valid base64 characters
	validChars := regexp.MustCompile("^[A-Za-z0-9+/]*=*$")
	if !validChars.MatchString(s) {
		return false
	}

	// 6. Try to decode - this is the final verification
	_, err := base64.StdEncoding.DecodeString(s)
	return err == nil
}

func FileExt(str string) string {
	lastDotIndex := strings.LastIndex(str, ".")
	if lastDotIndex == -1 {
		return ""
	}
	return str[lastDotIndex:]
}

func ReplaceExtension(path, newExt string) string {
	ext := filepath.Ext(path)
	return strings.TrimSuffix(path, ext) + newExt
}

func HashSHA256Hex(s string) string {
	h := sha256.New()
	h.Write([]byte(s))
	return hex.EncodeToString(h.Sum(nil))
}

func CleanMediaTitle(title string) string {
	replacer := strings.NewReplacer(
		" - ", " ",
		":", "",
		"!", "",
		"'", "",
		";", "",
		"*", "",
		"(", "",
		")", "",
		"[", "",
		"]", "",
	)
	return strings.TrimSpace(replacer.Replace(title))
}

// HashStringToInt96 converts a string to a 32-bit integer.
// It uses FNV-1a, masking it to fit safely in JS MAX_SAFE_INTEGER bounds if necessary,
// though typical FNV 32-bit fits well within JS numbers.
func HashStringToInt96(s string) int {
	var hash uint32 = 2166136261
	for i := 0; i < len(s); i++ {
		hash ^= uint32(s[i])
		hash *= 16777619
	}
	// Return as positive int
	return int(hash & 0x7FFFFFFF)
}
