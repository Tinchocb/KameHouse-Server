package handlers

import (
	"errors"
	"kamehouse/internal/util"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/labstack/echo/v4"
)

type DirectoryInfo struct {
	FullPath   string `json:"Path"`
	FolderName string `json:"Name"`
}

type DirectorySelectorResponse struct {
	FullPath    string          `json:"fullPath"`
	Exists      bool            `json:"exists"`
	BasePath    string          `json:"basePath"`
	Suggestions []DirectoryInfo `json:"suggestions"`
	Directories []DirectoryInfo `json:"Directories"`
}

func isBlockedSystemDirectory(p string) bool {
	return util.IsBlockedSystemDir(p)
}

// validateBrowserPath canonicaliza y rechaza traversal codificado, UNC y dirs de sistema.
// Se usa en endpoints que navegan FS arbitrario (selector). No sustituye el jail
// a librerías que sí hacen explorer/mediastream.
func validateBrowserPath(input string) (string, error) {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" || trimmed == "." {
		return "", errors.New("empty path")
	}
	lowered := strings.ToLower(trimmed)
	if strings.Contains(lowered, "%2e") || strings.Contains(lowered, "%2f") || strings.Contains(lowered, "%5c") || strings.Contains(trimmed, "\x00") {
		return "", errors.New("path traversal not allowed")
	}
	cleaned := filepath.Clean(trimmed)
	if cleaned == "." || strings.HasPrefix(cleaned, `\\`) || strings.HasPrefix(cleaned, `//`) {
		return "", errors.New("path not allowed")
	}
	// Rechazar segmentos ".." supervivientes y paths que escapan vía Clean.
	for _, seg := range strings.Split(filepath.ToSlash(cleaned), "/") {
		if seg == ".." {
			return "", errors.New("path traversal not allowed")
		}
	}
	if isBlockedSystemDirectory(cleaned) {
		return "", errors.New("access to system directory forbidden")
	}
	// Resolver symlinks si el path existe para no enumerar fuera vía enlace.
	if real, err := filepath.EvalSymlinks(cleaned); err == nil {
		if isBlockedSystemDirectory(real) {
			return "", errors.New("access to system directory forbidden")
		}
		return filepath.ToSlash(real), nil
	}
	return filepath.ToSlash(cleaned), nil
}

// HandleDirectorySelector returns directory content based on the input path.
//
//	@summary returns directory content based on the input path.
//	@desc This used by the directory selector component to get directory validation and suggestions.
//	@desc It returns subdirectories based on the input path.
//	@desc It returns 500 error if the directory does not exist (or cannot be accessed).
//	@route /api/v1/directory-selector [POST]
//	@returns handlers.DirectorySelectorResponse
func (h *Handler) HandleDirectorySelector(c echo.Context) error {

	type body struct {
		Input string `json:"input"`
	}
	var request body

	if err := c.Bind(&request); err != nil {
		return h.RespondWithError(c, err)
	}

	trimmed := strings.TrimSpace(request.Input)
	if trimmed == "" || trimmed == "." {
		return h.RespondWithData(c, DirectorySelectorResponse{
			FullPath:    "",
			BasePath:    "",
			Exists:      false,
			Suggestions: []DirectoryInfo{},
			Directories: []DirectoryInfo{},
		})
	}

	input, verr := validateBrowserPath(trimmed)
	if verr != nil {
		msg := verr.Error()
		if strings.Contains(msg, "system directory") {
			return h.RespondWithCodeError(c, http.StatusForbidden, verr)
		}
		return h.RespondWithCodeError(c, http.StatusBadRequest, verr)
	}
	if isBlockedSystemDirectory(input) {
		return h.RespondWithCodeError(c, http.StatusForbidden, errors.New("access to system directory forbidden"))
	}
	directoryExists, err := checkDirectoryExists(input)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	if directoryExists {
		suggestions, err := getAutocompletionSuggestions(input)
		if err != nil {
			return h.RespondWithError(c, err)
		}

		content, err := getDirectoryContent(input)
		if err != nil {
			return h.RespondWithError(c, err)
		}

		return h.RespondWithData(c, DirectorySelectorResponse{
			FullPath:    input,
			BasePath:    filepath.ToSlash(filepath.Dir(input)),
			Exists:      true,
			Suggestions: suggestions,
			Directories: content,
		})
	}

	suggestions, err := getAutocompletionSuggestions(input)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, DirectorySelectorResponse{
		FullPath:    input,
		BasePath:    filepath.ToSlash(filepath.Dir(input)),
		Exists:      false,
		Suggestions: suggestions,
	})
}

func checkDirectoryExists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

func getAutocompletionSuggestions(input string) ([]DirectoryInfo, error) {
	suggestions := []DirectoryInfo{}
	baseDir := filepath.Dir(input)
	prefix := filepath.Base(input)

	entries, err := os.ReadDir(baseDir)
	if err != nil {
		return suggestions, nil
	}

	for _, entry := range entries {
		if strings.HasPrefix(strings.ToLower(entry.Name()), strings.ToLower(prefix)) {
			suggestions = append(suggestions, DirectoryInfo{
				FullPath:   filepath.Join(baseDir, entry.Name()),
				FolderName: entry.Name(),
			})
			if len(suggestions) >= 100 {
				break
			}
		}
	}

	return suggestions, nil
}

func getDirectoryContent(path string) ([]DirectoryInfo, error) {
	var content []DirectoryInfo

	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			content = append(content, DirectoryInfo{
				FullPath:   filepath.Join(path, entry.Name()),
				FolderName: entry.Name(),
			})
		}
	}

	return content, nil
}
