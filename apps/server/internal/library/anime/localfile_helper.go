package anime

import (
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util"
	"os"
	"slices"
	"strings"

	"github.com/samber/lo"
	lop "github.com/samber/lo/parallel"
)

// GetMediaIdsFromLocalFiles returns all media ids from a slice of LocalFile's.
func GetMediaIdsFromLocalFiles(lfs []*dto.LocalFile) []int {

	// Group local files by media id
	groupedLfs := GroupLocalFilesByMediaID(lfs)

	// Get slice of media ids from local files (avoid pre-allocating with len which adds leading zeros)
	mIds := make([]int, 0, len(groupedLfs))
	for key := range groupedLfs {
		if !slices.Contains(mIds, key) {
			mIds = append(mIds, key)
		}
	}

	return mIds

}

// GetLocalFilesFromMediaId returns all local files with the given media id.
func GetLocalFilesFromMediaId(lfs []*dto.LocalFile, mID int) []*dto.LocalFile {

	return lo.Filter(lfs, func(item *dto.LocalFile, _ int) bool {
		return item.MediaID == mID
	})

}

// SortLocalFilesByPlayability ordena (estable) los archivos para que la copia
// reproducible quede primera: el primer archivo de cada episodio es el que se
// reproduce y el resto va a AdditionalFiles. Orden: local existente dentro de una
// carpeta de biblioteca > Google Drive > local inaccesible (borrado, o fuera de las
// carpetas configuradas, que el stream rechaza con "library not available").
func SortLocalFilesByPlayability(lfs []*dto.LocalFile, libraryPaths []string) {
	rank := func(lf *dto.LocalFile) int {
		if strings.HasPrefix(lf.Path, "gdrive://") {
			return 1
		}
		if _, err := os.Stat(lf.Path); err != nil {
			return 2
		}
		for _, dir := range libraryPaths {
			if util.IsFileUnderDir(dir, lf.Path) {
				return 0
			}
		}
		return 2
	}
	ranks := make(map[*dto.LocalFile]int, len(lfs))
	for _, lf := range lfs {
		ranks[lf] = rank(lf)
	}
	slices.SortStableFunc(lfs, func(a, b *dto.LocalFile) int {
		return ranks[a] - ranks[b]
	})
}

// GroupLocalFilesByMediaID returns a map of media id to local files.
func GroupLocalFilesByMediaID(lfs []*dto.LocalFile) (groupedLfs map[int][]*dto.LocalFile) {
	groupedLfs = lop.GroupBy(lfs, func(item *dto.LocalFile) int {
		return item.MediaID
	})

	return
}

