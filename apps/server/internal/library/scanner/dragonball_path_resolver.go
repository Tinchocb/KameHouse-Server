package scanner

import (
	"regexp"
	"strings"
)

// reExplicitEpisode matches explicit episode markers in a filename ("E024", "S01E05").
var reExplicitEpisode = regexp.MustCompile(`(?i)\b(?:s\d+)?e\d{1,4}\b`)

// reFolderWord splits a folder name into lowercase words.
var reFolderWord = regexp.MustCompile(`[\p{L}\p{N}]+`)

// HasExplicitEpisode reports whether a filename carries an explicit episode marker.
func HasExplicitEpisode(filename string) bool {
	return reExplicitEpisode.MatchString(filename)
}

// IsMovieFolderName reports whether a folder holds movies, specials or OVAs
// ("Películas de Dragon Ball Z", "Especiales", "OVAs", "Movies").
func IsMovieFolderName(name string) bool {
	for _, w := range reFolderWord.FindAllString(strings.ToLower(name), -1) {
		switch {
		case strings.HasPrefix(w, "pelicula"), strings.HasPrefix(w, "película"),
			strings.HasPrefix(w, "movie"), strings.HasPrefix(w, "film"),
			strings.HasPrefix(w, "especial"), strings.HasPrefix(w, "special"),
			w == "ova", w == "ovas", w == "oad", w == "oads":
			return true
		}
	}
	return false
}

// ResolveDragonBallPath resolves a Dragon Ball file from its full or relative path.
// It is the single resolver shared by the local scanner and the Google Drive indexer,
// so the same file is classified identically regardless of where it is stored.
//
// Folder context wins over the filename: a file inside a series folder is an episode
// of that series unless the filename itself names a movie and carries no explicit
// episode marker. Episode titles are never fed to the movie resolver on their own —
// "E024 - El frenético ataque de Krilin" must not become "El Ataque del Dragón".
//
// Returns (rawTmdbID, isMovie, found); callers apply the movie ID offset themselves.
func ResolveDragonBallPath(filePath string) (int, bool, bool) {
	parts := strings.Split(strings.ReplaceAll(filePath, `\`, "/"), "/")
	filename := parts[len(parts)-1]
	dirs := parts[:len(parts)-1]
	explicitEp := HasExplicitEpisode(filename)

	parentFolder := ""
	if len(dirs) > 0 {
		parentFolder = strings.TrimSpace(dirs[len(dirs)-1])
	}

	// 1. Movie/special folders: the filename names the movie.
	for _, d := range dirs {
		if !IsMovieFolderName(d) {
			continue
		}
		if id, movie, ok := ResolveDragonBallID(filename); ok {
			return id, movie, true
		}
		if parentFolder != "" {
			if id, movie, ok := ResolveDragonBallID(parentFolder + " " + filename); ok {
				return id, movie, true
			}
		}
		break
	}

	// 2. Nearest series folder. Walking up from the file keeps library roots such as
	// "COLECCION_DB" from outranking the real series folder below them.
	for i := len(dirs) - 1; i >= 0; i-- {
		d := strings.TrimSpace(dirs[i])
		if d == "" || IsMovieFolderName(d) {
			continue
		}
		id, movie, ok := ResolveDragonBallID(d)
		if !ok || movie {
			continue
		}
		if !explicitEp {
			if mID, mMovie, mOk := ResolveDragonBallID(filename); mOk && mMovie {
				return mID, true, true
			}
		}
		return id, false, true
	}

	// 3. No folder context: the filename alone, but an explicitly numbered episode
	// is never a movie.
	if id, movie, ok := ResolveDragonBallID(filename); ok && !(movie && explicitEp) {
		return id, movie, true
	}
	return 0, false, false
}
