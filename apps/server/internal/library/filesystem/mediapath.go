package filesystem

import (
	"errors"
	"kamehouse/internal/util"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type SeparatedFilePath struct {
	Filename   string
	Dirnames   []string
	PrefixPath string
}

// SeparateFilePath separates a path into a filename and a slice of dirnames while ignoring the prefix.
func SeparateFilePath(path string, prefixPath string) *SeparatedFilePath {
	path = filepath.ToSlash(path)
	prefixPath = filepath.ToSlash(prefixPath)
	cleaned := path
	if strings.HasPrefix(strings.ToLower(path), strings.ToLower(prefixPath)) {
		cleaned = path[len(prefixPath):] // Remove prefix
	}
	fp := filepath.Base(filepath.ToSlash(path))
	// Use strings-based dir computation to keep forward slashes on Windows
	cleanedSlash := strings.TrimPrefix(cleaned, "/")
	parentsPath := ""
	if idx := strings.LastIndex(cleanedSlash, "/"); idx >= 0 {
		parentsPath = cleanedSlash[:idx]
	}

	return &SeparatedFilePath{
		Filename:   fp,
		Dirnames:   strings.Split(parentsPath, "/"),
		PrefixPath: prefixPath,
	}
}

// SeparateFilePathS separates a path into a filename and a slice of dirnames while ignoring the prefix.
// Unlike [SeparateFilePath], it will check multiple prefixes.
//
// Example:
//
//	path = "/path/to/file.mkv"
//	potentialPrefixes = []string{"/path/to", "/path"}
//	fp, dirs := SeparateFilePathS(path, potentialPrefixes)
//	fmt.Println(fp) // file.mkv
//	fmt.Println(dirs) // [to]
func SeparateFilePathS(path string, potentialPrefixes []string) *SeparatedFilePath {
	// Sort prefix paths by length in descending order
	sort.Slice(potentialPrefixes, func(i, j int) bool {
		return len(potentialPrefixes[i]) > len(potentialPrefixes[j])
	})

	// Check each prefix path, and remove the first match from the path
	prefixPath := ""
	for _, p := range potentialPrefixes {
		// Normalize the paths for comparison only
		if strings.HasPrefix(util.NormalizePath(path), util.NormalizePath(p)) {
			// Remove the prefix from the path
			path = path[len(p):]
			prefixPath = p
			break
		}
	}

	filename := filepath.ToSlash(filepath.Base(path))
	parentsPath := filepath.ToSlash(filepath.Dir(filepath.ToSlash(path)))

	dirs := make([]string, 0)
	for _, dir := range strings.Split(parentsPath, "/") {
		if dir != "" {
			dirs = append(dirs, dir)
		}
	}

	return &SeparatedFilePath{
		Filename:   filename,
		Dirnames:   dirs,
		PrefixPath: prefixPath,
	}
}

//----------------------------------------------------------------------------------------------------------------------

func FileExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return !errors.Is(err, os.ErrNotExist)
}
