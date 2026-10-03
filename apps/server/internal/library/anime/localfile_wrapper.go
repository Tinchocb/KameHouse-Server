package anime

type (
	// LocalFileWrapper takes a slice of LocalFiles and provides helper methods.
	LocalFileWrapper struct {
		LocalFiles          []*LocalFile             `json:"localFiles"`
		LocalEntries        []*LocalFileWrapperEntry `json:"localEntries"`
		UnmatchedLocalFiles []*LocalFile             `json:"unmatchedLocalFiles"`
	}

	LocalFileWrapperEntry struct {
		MediaID    int          `json:"mediaId"`
		LocalFiles []*LocalFile `json:"localFiles"`
	}
)

// NewLocalFileWrapper creates and returns a reference to a new LocalFileWrapper
func NewLocalFileWrapper(lfs []*LocalFile) *LocalFileWrapper {
	lfw := &LocalFileWrapper{
		LocalFiles:          lfs,
		LocalEntries:        make([]*LocalFileWrapperEntry, 0),
		UnmatchedLocalFiles: make([]*LocalFile, 0),
	}

	// Group local files by media id
	groupedLfs := GroupLocalFilesByMediaID(lfs)
	for mID, gLfs := range groupedLfs {
		if mID == 0 {
			lfw.UnmatchedLocalFiles = gLfs
			continue
		}
		lfw.LocalEntries = append(lfw.LocalEntries, &LocalFileWrapperEntry{
			MediaID:    mID,
			LocalFiles: gLfs,
		})
	}

	return lfw
}

func (lfw *LocalFileWrapper) GetLocalEntryById(mID int) (*LocalFileWrapperEntry, bool) {
	for _, me := range lfw.LocalEntries {
		if me.MediaID == mID {
			return me, true
		}
	}
	return nil, false
}

// GetMainLocalFiles returns the *main* local files.
func (e *LocalFileWrapperEntry) GetMainLocalFiles() ([]*LocalFile, bool) {
	lfs := make([]*LocalFile, 0)
	for _, lf := range e.LocalFiles {
		if lf.IsMain() {
			lfs = append(lfs, lf)
		}
	}
	if len(lfs) == 0 {
		return nil, false
	}
	return lfs, true
}

// GetUnwatchedLocalFiles returns the *main* local files that have not been watched.
// It returns an empty slice if all local files have been watched.
//
// /!\ IF Episode 0 is present, progress will be decremented by 1. This is because we assume the metadata provider includes the episode 0 in the total count.
func (e *LocalFileWrapperEntry) GetUnwatchedLocalFiles(progress int) []*LocalFile {
	ret := make([]*LocalFile, 0)
	lfs, ok := e.GetMainLocalFiles()
	if !ok {
		return ret
	}

	for _, lf := range lfs {
		if lf.GetEpisodeNumber() == 0 {
			progress = progress - 1
			break
		}
	}

	for _, lf := range lfs {
		if lf.GetEpisodeNumber() > progress {
			ret = append(ret, lf)
		}
	}

	return ret
}

