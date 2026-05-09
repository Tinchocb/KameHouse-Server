package scanner

import (
	"path/filepath"
	"regexp"
	"strings"

	"kamehouse/internal/library/parser"
)

var (
	hexLikeFolderName  = regexp.MustCompile(`(?i)^[a-f0-9]{8,}$`)
	uuidLikeFolderName = regexp.MustCompile(`(?i)^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`)
)

var genericFolderTitles = map[string]struct{}{
	"anime":           {},
	"batch":           {},
	"complete":        {},
	"downloads":       {},
	"films":           {},
	"folder":          {},
	"movies":          {},
	"new folder":      {},
	"nueva carpeta":   {},
	"otros":           {},
	"peliculas":       {},
	"series":          {},
	"specials":        {},
	"subtitles":       {},
	"subs":            {},
	"temp":            {},
	"temporada":       {},
	"tmp":             {},
	"torrents":        {},
	"tv":              {},
	"tv shows":        {},
	"untitled":        {},
	"untitled folder": {},
	"varios":          {},
	"video":           {},
	"videos":          {},
}

func meaningfulImmediateFolderTitle(path string) string {
	folderName := filepath.Base(filepath.Dir(path))
	if folderName == "." || folderName == string(filepath.Separator) {
		return ""
	}

	parsed := parser.Parse(folderName)
	title := parsed.Title
	if title == "" {
		title = folderName
	}
	title = parser.SanitizeSubGroupTags(title)
	if !isMeaningfulFolderTitle(title) {
		return ""
	}
	return title
}

func isMeaningfulFolderTitle(title string) bool {
	normalized := normalizeFolderSignal(title)
	if normalized == "" {
		return false
	}
	if _, ok := genericFolderTitles[normalized]; ok {
		return false
	}
	if isRandomLikeFolderName(normalized) {
		return false
	}
	return true
}

func normalizeFolderSignal(title string) string {
	title = strings.ToLower(strings.TrimSpace(title))
	title = strings.NewReplacer("_", " ", "-", " ", ".", " ").Replace(title)
	return strings.Join(strings.Fields(title), " ")
}

func isRandomLikeFolderName(normalized string) bool {
	compact := strings.ReplaceAll(normalized, " ", "")
	if len(compact) < 8 {
		return false
	}
	if uuidLikeFolderName.MatchString(compact) || hexLikeFolderName.MatchString(compact) {
		return true
	}

	digits := 0
	letters := 0
	vowels := 0
	for _, r := range compact {
		switch {
		case r >= '0' && r <= '9':
			digits++
		case r >= 'a' && r <= 'z':
			letters++
			if strings.ContainsRune("aeiou", r) {
				vowels++
			}
		}
	}

	if digits > 0 && float64(digits)/float64(len(compact)) >= 0.35 {
		return true
	}
	return letters >= 8 && vowels == 0
}
