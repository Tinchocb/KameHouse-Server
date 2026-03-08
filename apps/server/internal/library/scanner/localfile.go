package scanner

import (
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/filesystem"

	"github.com/rs/zerolog"
	lop "github.com/samber/lo/parallel"
)

// GetLocalFilesFromDir creates a new LocalFile for each video file
func GetLocalFilesFromDir(dirPath string, logger *zerolog.Logger) ([]*dto.LocalFile, error) {
	paths, err := filesystem.GetMediaFilePathsFromDirS(dirPath)

	if logger != nil {
		logger.Trace().
			Any("dirPath", dirPath).
			Msg("localfile: Retrieving and creating local files")
	}

	// Concurrently populate localFiles
	localFiles := lop.Map(paths, func(path string, index int) *dto.LocalFile {
		return dto.NewLocalFile(path, dirPath)
	})

	if logger != nil {
		logger.Trace().
			Any("count", len(localFiles)).
			Msg("localfile: Retrieved local files")
	}

	return localFiles, err
}
