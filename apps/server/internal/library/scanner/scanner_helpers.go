package scanner

import (
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util"
)

// InLibrariesOnly filters a list of local files to only include those that are within the provided library paths.
func InLibrariesOnly(lfs []*dto.LocalFile, libraryPaths []string) []*dto.LocalFile {
	ret := make([]*dto.LocalFile, 0, len(lfs))
	for _, lf := range lfs {
		normPath := util.NormalizePath(lf.Path)
		for _, lp := range libraryPaths {
			normLp := util.NormalizePath(lp)
			if normPath == normLp || (len(normPath) > len(normLp) && normPath[len(normLp)] == '/' && normPath[:len(normLp)] == normLp) {
				ret = append(ret, lf)
				break
			}
		}
	}
	return ret
}

// GetShelvedLocalFiles returns the list of shelved files from the scanner.
func (scn *Scanner) GetShelvedLocalFiles() []*dto.LocalFile {
	return scn.shelvedLocalFiles
}

func (scn *Scanner) addRemainingShelvedFiles(skippedLfs map[string]*dto.LocalFile) {
	// Add shelved files that were not unshelved during the scan
	for _, lf := range scn.ExistingShelvedFiles {
		found := false
		normPath := lf.GetNormalizedPath()
		if _, ok := skippedLfs[normPath]; ok {
			found = true
		}
		if !found {
			scn.shelvedLocalFiles = append(scn.shelvedLocalFiles, lf)
		}
	}
}

type sagaResolution struct {
	id      string
	name    string
	startEp int
	endEp   int
}
