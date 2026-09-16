package filesystem

import (
	"errors"
	"os"
	"path/filepath"

	"github.com/rs/zerolog"
)

// RemoveEmptyDirectories deletes all empty directories in a given directory.
// It ignores errors.
func RemoveEmptyDirectories(root string, logger *zerolog.Logger) {

	var dirs []string
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || path == root || !d.IsDir() {
			return nil
		}
		dirs = append(dirs, path)
		return nil
	})

	// Process deepest directories first (bottom-up)
	for i := len(dirs) - 1; i >= 0; i-- {
		p := dirs[i]
		isEmpty, err := isDirectoryEmpty(p)
		if err != nil || !isEmpty {
			continue
		}
		if err := os.Remove(p); err != nil {
			logger.Warn().Err(err).Str("path", p).Msg("filesystem: Could not delete empty directory")
		} else {
			logger.Info().Str("path", p).Msg("filesystem: Deleted empty directory")
		}
	}
}


func isDirectoryEmpty(path string) (bool, error) {
	dir, err := os.Open(path)
	if err != nil {
		return false, err
	}
	defer dir.Close()

	_, err = dir.Readdir(1)
	if err == nil {
		// Directory is not empty
		return false, nil
	}

	if errors.Is(err, os.ErrNotExist) {
		// Directory does not exist
		return false, nil
	}

	// Directory is empty
	return true, nil
}
