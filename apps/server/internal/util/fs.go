package util

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// SafeJoinPath safely joins baseDir and filename, returning an error if the
// resulting path would escape baseDir (path traversal prevention).
// filename must be a plain filename — no sub-directory components.
func SafeJoinPath(baseDir, filename string) (string, error) {
	// Reject any path that contains a parent-directory reference.
	if strings.Contains(filename, "..") {
		return "", fmt.Errorf("invalid path: parent directory reference not allowed")
	}
	fullPath := filepath.Join(baseDir, filename)
	// Double-check at the OS level that the resolved path is still inside baseDir.
	cleanBase := filepath.Clean(baseDir)
	if !strings.HasPrefix(filepath.Clean(fullPath), cleanBase+string(os.PathSeparator)) {
		return "", fmt.Errorf("invalid path: resolved path escapes base directory")
	}
	return fullPath, nil
}

func DirSize(path string) (uint64, error) {
	var size int64
	err := filepath.WalkDir(path, func(_ string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			info, err := d.Info()
			if err != nil {
				return err
			}
			size += info.Size()
		}
		return nil
	})
	return uint64(size), err
}

func IsValidMediaFile(path string) bool {
	return !strings.HasPrefix(path, "._")
}
func IsValidVideoExtension(ext string) bool {
	validExtensions := map[string]struct{}{
		".mp4": {}, ".avi": {}, ".mkv": {}, ".mov": {}, ".flv": {}, ".wmv": {}, ".webm": {},
		".mpeg": {}, ".mpg": {}, ".m4v": {}, ".3gp": {}, ".3g2": {}, ".ogg": {}, ".ogv": {},
		".vob": {}, ".mts": {}, ".m2ts": {}, ".ts": {}, ".f4v": {}, ".ogm": {}, ".rm": {},
		".rmvb": {}, ".drc": {}, ".yuv": {}, ".asf": {}, ".amv": {}, ".m2v": {}, ".mpe": {},
		".mpv": {}, ".mp2": {}, ".svi": {}, ".mxf": {}, ".roq": {}, ".nsv": {}, ".f4p": {},
		".f4a": {}, ".f4b": {},
	}
	ext = strings.ToLower(ext)
	_, exists := validExtensions[ext]
	return exists
}

func IsSubdirectory(parent, child string) bool {
	if runtime.GOOS == "windows" {
		parent = strings.ToLower(parent)
		child = strings.ToLower(child)
	}
	rel, err := filepath.Rel(filepath.Clean(parent), filepath.Clean(child))
	if err != nil {
		return false
	}
	return rel != "." && rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))
}

func IsSubdirectoryOfAny(dirs []string, child string) bool {
	for _, dir := range dirs {
		if IsSubdirectory(dir, child) {
			return true
		}
	}
	return false
}

func IsSameDir(dir1, dir2 string) bool {
	realDir1, err := filepath.EvalSymlinks(dir1)
	if err != nil {
		realDir1 = dir1
	}
	realDir2, err := filepath.EvalSymlinks(dir2)
	if err != nil {
		realDir2 = dir2
	}
	if runtime.GOOS == "windows" {
		realDir1 = strings.ToLower(realDir1)
		realDir2 = strings.ToLower(realDir2)
	}

	absDir1, err := filepath.Abs(realDir1)
	if err != nil {
		return false
	}
	absDir2, err := filepath.Abs(realDir2)
	if err != nil {
		return false
	}
	return absDir1 == absDir2
}

func IsFileUnderDir(dir, filePath string) bool {
	cleanDir := filepath.Clean(dir)
	cleanPath := filepath.Clean(filePath)

	realDir, err := filepath.EvalSymlinks(cleanDir)
	if err != nil {
		realDir, err = filepath.Abs(cleanDir)
		if err != nil {
			return false
		}
	} else {
		realDir, err = filepath.Abs(realDir)
		if err != nil {
			return false
		}
	}

	realPath, err := filepath.EvalSymlinks(cleanPath)
	if err != nil {
		realPath, err = filepath.Abs(cleanPath)
		if err != nil {
			return false
		}
	} else {
		realPath, err = filepath.Abs(realPath)
		if err != nil {
			return false
		}
	}

	if runtime.GOOS == "windows" {
		realDir = strings.ToLower(realDir)
		realPath = strings.ToLower(realPath)
	}

	rel, err := filepath.Rel(realDir, realPath)
	if err != nil {
		return false
	}
	return rel != "." && rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))
}

// IsBlockedSystemDir checks if a directory path points to a sensitive or system-critical location
// that should not be indexed, browsed, or scanned.
func IsBlockedSystemDir(p string) bool {
	cleanLower := strings.ToLower(filepath.Clean(p))
	if cleanLower == "/" || cleanLower == "c:\\" || cleanLower == "c:/" ||
		cleanLower == "c:\\windows" || strings.HasPrefix(cleanLower, "c:\\windows\\") || strings.HasPrefix(cleanLower, "c:/windows/") ||
		cleanLower == "c:\\program files" || strings.HasPrefix(cleanLower, "c:\\program files\\") || strings.HasPrefix(cleanLower, "c:/program files/") ||
		cleanLower == "c:\\program files (x86)" || strings.HasPrefix(cleanLower, "c:\\program files (x86)\\") || strings.HasPrefix(cleanLower, "c:/program files (x86)/") ||
		cleanLower == "c:\\programdata" || strings.HasPrefix(cleanLower, "c:\\programdata\\") || strings.HasPrefix(cleanLower, "c:/programdata/") ||
		cleanLower == "/etc" || strings.HasPrefix(cleanLower, "/etc/") ||
		cleanLower == "/proc" || strings.HasPrefix(cleanLower, "/proc/") ||
		cleanLower == "/sys" || strings.HasPrefix(cleanLower, "/sys/") ||
		cleanLower == "/dev" || strings.HasPrefix(cleanLower, "/dev/") ||
		cleanLower == "/boot" || strings.HasPrefix(cleanLower, "/boot/") ||
		cleanLower == "/root" || strings.HasPrefix(cleanLower, "/root/") ||
		cleanLower == "/bin" || strings.HasPrefix(cleanLower, "/bin/") ||
		cleanLower == "/sbin" || strings.HasPrefix(cleanLower, "/sbin/") ||
		cleanLower == "/usr" || strings.HasPrefix(cleanLower, "/usr/") ||
		cleanLower == "/var" || strings.HasPrefix(cleanLower, "/var/") ||
		strings.Contains(cleanLower, ".ssh") || strings.Contains(cleanLower, ".aws") ||
		strings.Contains(cleanLower, ".kube") || strings.Contains(cleanLower, ".gnupg") ||
		strings.Contains(cleanLower, "appdata\\local\\microsoft") || strings.Contains(cleanLower, "appdata/local/microsoft") {
		return true
	}
	return false
}
