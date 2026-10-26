package util

import (
	"crypto/sha256"
	"encoding/hex"
	"path/filepath"
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

// NormalizePath normalizes a path by converting it to lowercase and replacing backslashes with forward slashes
// Warning: Do not use the returned string for anything filesystem related, only for comparison
func NormalizePath(path string) (ret string) {
	if runtime.GOOS == "windows" {
		return strings.ToLower(filepath.ToSlash(path))
	}
	return filepath.ToSlash(path)
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
