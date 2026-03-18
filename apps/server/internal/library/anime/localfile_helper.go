package anime

import (
	"kamehouse/internal/database/models/dto"
	"slices"
	"strings"

	"github.com/samber/lo"
	lop "github.com/samber/lo/parallel"
)

// GetUniqueAnimeTitlesFromLocalFiles returns all parsed anime titles without duplicates, from a slice of LocalFile's.
func GetUniqueAnimeTitlesFromLocalFiles(lfs []*dto.LocalFile) []string {
	// Concurrently get title from each local file
	titles := lop.Map(lfs, func(file *dto.LocalFile, index int) string {
		title := file.GetParsedTitle()
		// Some rudimentary exclusions
		for _, i := range []string{"SPECIALS", "SPECIAL", "EXTRA", "NC", "OP", "MOVIE", "MOVIES"} {
			if strings.ToUpper(title) == i {
				return ""
			}
		}
		return title
	})
	// Keep unique title and filter out empty ones
	titles = lo.Filter(lo.Uniq(titles), func(item string, index int) bool {
		return len(item) > 0
	})
	return titles
}

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
func GetLocalFilesFromMediaId(lfs []*dto.LocalFile, mId int) []*dto.LocalFile {

	return lo.Filter(lfs, func(item *dto.LocalFile, _ int) bool {
		return item.MediaId == mId
	})

}

// GroupLocalFilesByMediaID returns a map of media id to local files.
func GroupLocalFilesByMediaID(lfs []*dto.LocalFile) (groupedLfs map[int][]*dto.LocalFile) {
	groupedLfs = lop.GroupBy(lfs, func(item *dto.LocalFile) int {
		return item.MediaId
	})

	return
}

// IsLocalFileGroupValidEntry checks if there are any main episodes with valid episodes
func IsLocalFileGroupValidEntry(lfs []*dto.LocalFile) bool {
	// Check if there are any main episodes with valid parsed data
	flag := false
	for _, lf := range lfs {
		if lf.GetType() == dto.LocalFileTypeMain && lf.IsParsedEpisodeValid() {
			flag = true
			break
		}
	}
	return flag
}

// FindLatestLocalFileFromGroup returns the "main" episode with the highest episode number.
// Returns false if there are no episodes.
func FindLatestLocalFileFromGroup(lfs []*dto.LocalFile) (*dto.LocalFile, bool) {
	// Check if there are any main episodes with valid parsed data
	if !IsLocalFileGroupValidEntry(lfs) {
		return nil, false
	}
	if lfs == nil || len(lfs) == 0 {
		return nil, false
	}
	// Get the episode with the highest progress number
	latest, found := lo.Find(lfs, func(lf *dto.LocalFile) bool {
		return lf.GetType() == dto.LocalFileTypeMain && lf.IsParsedEpisodeValid()
	})
	if !found {
		return nil, false
	}
	for _, lf := range lfs {
		if lf.GetType() == dto.LocalFileTypeMain && lf.GetEpisodeNumber() > latest.GetEpisodeNumber() {
			latest = lf
		}
	}
	if latest == nil || latest.GetType() != dto.LocalFileTypeMain {
		return nil, false
	}
	return latest, true
}
