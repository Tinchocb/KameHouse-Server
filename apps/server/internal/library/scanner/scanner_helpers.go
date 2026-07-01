package scanner

import (
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util"
	"os"
	"strings"
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

func (scn *Scanner) addRemainingShelvedFiles(skippedLfs map[string]*dto.LocalFile, sortedLibraryPaths []string) {
	// If a shelved file was not unshelved, it should either:
	// be kept shelved or
	// removed (if its library path exists)

	libraryPathExistsCache := make(map[string]bool)

	for _, shelvedLf := range scn.ExistingShelvedFiles {
		if shelvedLf == nil {
			continue
		}
		// If not in skippedLfs (meaning it wasn't unshelved), keep it shelved or remove it
		if _, ok := skippedLfs[shelvedLf.GetNormalizedPath()]; !ok {

			// Check if we should really keep it shelved
			keepShelved := false

			// Find which library path this file belongs to
			var matchedLibPath string
			for _, libPath := range sortedLibraryPaths {
				if strings.HasPrefix(shelvedLf.GetNormalizedPath(), util.NormalizePath(libPath)) {
					matchedLibPath = libPath
					break
				}
			}

			if matchedLibPath != "" {
				exists, checked := libraryPathExistsCache[matchedLibPath]
				if !checked {
					_, err := os.Stat(matchedLibPath)
					exists = err == nil || !os.IsNotExist(err)
					libraryPathExistsCache[matchedLibPath] = exists
				}

				if !exists {
					// Library path doesn't exist (e.g. drive disconnected), so keep shelved
					keepShelved = true
				} else {
					// Library path exists, but file was not found, we assume it was deleted
					keepShelved = false
				}
			} else {
				// File doesn't belong to any known library path.
				// Meaning the library path was explicitly removed from settings
				keepShelved = false
			}

			if keepShelved {
				scn.shelvedLocalFiles = append(scn.shelvedLocalFiles, shelvedLf)
			}
		}
	}
}

type subSagaResolution struct {
	id      string
	name    string
	startEp int
	endEp   int
}

type sagaResolution struct {
	id       string
	name     string
	startEp  int
	endEp    int
	subSagas []subSagaResolution
}
