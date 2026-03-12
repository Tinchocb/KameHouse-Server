package scanner

import (
	"kamehouse/internal/database/models/dto"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// FolderInfo contains metadata extracted from the folder structure (Jellyfin/Kodi style).
type FolderInfo struct {
	SeriesName       string // e.g. "Dragon Ball Z"
	Year             int    // e.g. 1989 (0 if not found)
	Season           int    // e.g. 2 (0 if not in a Season folder)
	IsMovie          bool   // true if detected as a movie
	ExplicitProvider string // e.g. "anilist", "tmdb", "imdb"
	ExplicitID       string // e.g. "12345", "tt12345"
}

var (
	// Matches "Show Name (2023)" or "Show Name (2023) [tags]"
	reYearInFolder = regexp.MustCompile(`^(.+?)\s*\((\d{4})\)`)
	// Matches "Season 01", "Season 1", "S01", "S1", "Temp 01"
	reSeasonFolder = regexp.MustCompile(`(?i)^(?:season|s|temp|temporada)\s*(\d+)$`)
	// Matches Specials, Extras, OVA folders which resolve to Season 0
	reSpecialsFolder = regexp.MustCompile(`(?i)^(?:season\s*0+|s0+|specials|extras|ovas?|nc|sp)$`)
	// Matches saga/arc subfolders like "1 - Saga El Gran Viaje", "02 - Saga Baby"
	reSagaFolder = regexp.MustCompile(`(?i)^\d+\s*[-–]\s*(?:saga|arco?|part)\s+`)
	// Extracts the leading number from saga folders
	reSagaNumber = regexp.MustCompile(`^(\d+)\s*[-–]`)
	// Matches movie filename like "Dragon Ball Z - La batalla (2013).mkv"
	reMovieFilename = regexp.MustCompile(`^(.+?)\s*\((\d{4})\)\.[a-zA-Z0-9]+$`)
	// Matches movie filename without year like "Dragon Ball GT- 100 Años Después.mkv"
	reMovieFilenameNoYear = regexp.MustCompile(`^(.+?)\.[a-zA-Z0-9]+$`)
	// Precompiled regexes for cleanMovieTitle
	reLeadingBracketTag  = regexp.MustCompile(`^\[[^\]]+\]\s*`)
	reCodecQualityTag    = regexp.MustCompile(`\s*[\[\(][^\]\)]*(?:x264|x265|h264|h265|hevc|aac|flac|bluray|bdrip|webrip|dvdrip|1080p|720p|480p|960p|4k|2160p|\d+[-:]\d+)[^\]\)]*[\]\)]\s*`)
	reTrailingResolution = regexp.MustCompile(`\s*\[\d+p\]\s*$`)
)

// ParseFolderStructure extracts series name, year, and season from a file path
// using Jellyfin/Kodi folder conventions.
//
// Supported structures:
//   - Library/Show Name (Year)/Season XX/episode.mkv
//   - Library/Show Name/Season XX/episode.mkv
//   - Library/Show Name (Year)/episode.mkv
//   - Library/Movies/Movie Name (Year)/movie.mkv
func ParseFolderStructure(filePath string, libraryPaths []string) *FolderInfo {
	info := &FolderInfo{}

	// Normalize the path
	absPath := filepath.Clean(filePath)
	filename := filepath.Base(absPath)
	dir := filepath.Dir(absPath)

	// Split the path into components
	parts := splitPath(dir)
	if len(parts) == 0 {
		return info
	}

	// Find the library root to determine the relative structure
	relParts := parts
	for _, libPath := range libraryPaths {
		cleanLib := filepath.Clean(libPath)
		libParts := splitPath(cleanLib)
		if len(libParts) > 0 && len(parts) > len(libParts) {
			// Check if the file path starts with this library path
			match := true
			for i, lp := range libParts {
				if !strings.EqualFold(parts[i], lp) {
					match = false
					break
				}
			}
			if match {
				relParts = parts[len(libParts):]
				break
			}
		}
	}

	if len(relParts) == 0 {
		return info
	}

	// Extract explicit provider ID if present anywhere in the path
	var tempMedia dto.NormalizedMedia
	ExtractExplicitProvider(filename, &tempMedia)
	if tempMedia.ExplicitProvider != "" {
		info.ExplicitProvider = tempMedia.ExplicitProvider
		info.ExplicitID = tempMedia.ExplicitID
	} else {
		for _, part := range relParts {
			ExtractExplicitProvider(part, &tempMedia)
			if tempMedia.ExplicitProvider != "" {
				info.ExplicitProvider = tempMedia.ExplicitProvider
				info.ExplicitID = tempMedia.ExplicitID
				break
			}
		}
	}

	// Detect movie based on folder name
	isInMovieCategory := false
	for _, part := range relParts {
		lower := strings.ToLower(part)
		if lower == "movies" || lower == "peliculas" || lower == "películas" || lower == "films" {
			info.IsMovie = true
			isInMovieCategory = true
		}
	}

	// Count non-category folders to detect if file is directly in a category folder
	nonCategoryParts := 0
	for _, part := range relParts {
		lower := strings.ToLower(part)
		if lower != "anime" && lower != "movies" && lower != "peliculas" && lower != "películas" &&
			lower != "films" && lower != "series" && lower != "tv" && lower != "tv shows" {
			nonCategoryParts++
		}
	}

	// If movie file sits directly in a category folder (e.g., Peliculas/movie.mkv),
	// extract the title from the filename instead
	if isInMovieCategory && nonCategoryParts == 0 {
		info.IsMovie = true
		if m := reMovieFilename.FindStringSubmatch(filename); m != nil {
			info.SeriesName = cleanMovieTitle(m[1])
			info.Year, _ = strconv.Atoi(m[2])
		} else if m := reMovieFilenameNoYear.FindStringSubmatch(filename); m != nil {
			info.SeriesName = cleanMovieTitle(m[1])
		}
		return info
	}

	// Parse the relative path components
	// Expected: [SeriesName (Year)] or [SeriesName (Year), Season XX]
	for i, part := range relParts {
		// Check if this is a season folder
		if m := reSeasonFolder.FindStringSubmatch(part); m != nil {
			info.Season, _ = strconv.Atoi(m[1])
			continue
		}

		// Check if this is a specials/extras folder
		if reSpecialsFolder.MatchString(part) {
			info.Season = 0
			continue
		}

		// Check if this is a saga/arc subfolder — extract leading number as season
		if reSagaFolder.MatchString(part) {
			if sm := reSagaNumber.FindStringSubmatch(part); sm != nil {
				if num, err := strconv.Atoi(sm[1]); err == nil {
					info.Season = num
				}
			}
			continue
		}

		// Check if this is a series/movie folder with year
		if m := reYearInFolder.FindStringSubmatch(part); m != nil {
			// Only use the first non-category folder as the series name
			if info.SeriesName == "" {
				info.SeriesName = strings.TrimSpace(m[1])
				info.Year, _ = strconv.Atoi(m[2])
			}
			continue
		}

		// Skip known category folders
		lower := strings.ToLower(part)
		if lower == "anime" || lower == "movies" || lower == "peliculas" || lower == "películas" ||
			lower == "films" || lower == "series" || lower == "tv" || lower == "tv shows" {
			continue
		}

		// First non-category, non-season, non-saga folder is the series name
		if info.SeriesName == "" && (i < len(relParts)-1 || len(relParts) == 1) {
			info.SeriesName = strings.TrimSpace(part)
		}
	}

	// Fallback: if no series name was found, use the immediate parent folder
	if info.SeriesName == "" && len(relParts) > 0 {
		name := relParts[0]
		if m := reYearInFolder.FindStringSubmatch(name); m != nil {
			info.SeriesName = strings.TrimSpace(m[1])
			info.Year, _ = strconv.Atoi(m[2])
		} else {
			info.SeriesName = strings.TrimSpace(name)
		}
	}

	if info.SeriesName != "" {
		info.SeriesName = cleanMovieTitle(info.SeriesName)
	}

	return info
}

// cleanMovieTitle cleans up a movie title extracted from a filename.
// Removes trailing hyphens/dashes, codec info, resolution tags, etc.
func cleanMovieTitle(title string) string {
	title = strings.TrimSpace(title)
	// Remove trailing dash or hyphen with optional whitespace
	title = strings.TrimRight(title, " -–")
	// Remove explicit provider tags
	title = ReExplicitProvider.ReplaceAllString(title, "")
	// Remove leading bracket tags (e.g., [Fansub])
	title = reLeadingBracketTag.ReplaceAllString(title, "")
	// Remove common codec/quality tags in brackets
	title = reCodecQualityTag.ReplaceAllString(title, "")
	// Remove resolution patterns like "[960p]" at the end
	title = reTrailingResolution.ReplaceAllString(title, "")
	title = strings.TrimSpace(title)
	title = strings.TrimRight(title, " -–")
	return title
}

// splitPath splits a file path into its individual directory components.
func splitPath(p string) []string {
	var parts []string
	for {
		dir, file := filepath.Split(filepath.Clean(p))
		if file == "" {
			if dir != "" {
				parts = append([]string{filepath.Clean(dir)}, parts...)
			}
			break
		}
		parts = append([]string{file}, parts...)
		if dir == p { // root
			break
		}
		p = dir
	}
	return parts
}
