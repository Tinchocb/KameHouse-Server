package handlers

import (
	"errors"
	"kamehouse/internal/util"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/labstack/echo/v4"
)

// HandleOpenInExplorer opens the given directory in the file explorer.
//
//	@summary opens the given directory in the file explorer.
//	@desc It returns 'true' whether the operation was successful or not.
//	@route /api/v1/open-in-explorer [POST]
//	@returns bool
func (h *Handler) HandleOpenInExplorer(c echo.Context) error {

	type body struct {
		Path string `json:"path"`
	}

	p := new(body)
	if err := c.Bind(p); err != nil {
		return h.RespondWithCodeError(c, http.StatusBadRequest, err)
	}

	if strings.TrimSpace(p.Path) == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("empty path"))
	}
	lowered := strings.ToLower(p.Path)
	if strings.Contains(lowered, "%2e") || strings.Contains(p.Path, "\x00") {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("path traversal not allowed"))
	}
	cleaned := filepath.Clean(p.Path)
	if strings.HasPrefix(cleaned, `\\`) || strings.HasPrefix(cleaned, `//`) {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("remote network paths not allowed"))
	}
	if util.IsBlockedSystemDir(cleaned) {
		return h.RespondWithCodeError(c, http.StatusForbidden, errors.New("access to system directory forbidden"))
	}

	stat, err := os.Stat(cleaned)
	if err != nil {
		if os.IsNotExist(err) {
			return h.RespondWithCodeError(c, http.StatusNotFound, errors.New("path not found"))
		}
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("cannot access path"))
	}
	if !stat.IsDir() {
		cleaned = filepath.Dir(cleaned)
	}

	// Confinamiento: solo permitir carpetas dentro de las librerías configuradas o AppData / Logs
	isAllowed := false
	if h.App.Config != nil {
		if util.IsFileUnderDir(h.App.Config.Data.AppDataDir, cleaned) || util.IsSameDir(h.App.Config.Data.AppDataDir, cleaned) {
			isAllowed = true
		}
		if !isAllowed && h.App.Config.Logs.Dir != "" {
			if util.IsFileUnderDir(h.App.Config.Logs.Dir, cleaned) || util.IsSameDir(h.App.Config.Logs.Dir, cleaned) {
				isAllowed = true
			}
		}
	}

	if !isAllowed && h.App.Database != nil {
		libraryPaths, err := h.App.Database.GetAllLibraryPathsFromSettings()
		if err == nil {
			for _, libPath := range libraryPaths {
				if util.IsFileUnderDir(libPath, cleaned) || util.IsSameDir(libPath, cleaned) {
					isAllowed = true
					break
				}
			}
		}
	}

	if !isAllowed {
		return h.RespondWithCodeError(c, http.StatusForbidden, errors.New("access denied to path outside library or application data"))
	}

	OpenDirInExplorer(cleaned)

	return h.RespondWithData(c, true)
}

func OpenDirInExplorer(dir string) {
	if dir == "" {
		return
	}

	cmd := ""
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "explorer"
		args = []string{strings.ReplaceAll(dir, "/", "\\")}
	case "darwin":
		cmd = "open"
		args = []string{dir}
	case "linux":
		cmd = "xdg-open"
		args = []string{dir}
	default:
		return
	}
	cmdObj := util.NewCmd(cmd, args...)
	cmdObj.Stdout = os.Stdout
	cmdObj.Stderr = os.Stderr
	_ = cmdObj.Run()
}
