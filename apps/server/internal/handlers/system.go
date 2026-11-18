package handlers

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/labstack/echo/v4"
)

// HandleBackupDatabase ...
//
//	@summary triggers a real SQLite DB backup.
//	@route /api/v1/db/backup [POST]
//	@returns db.BackupResult
func (h *Handler) HandleBackupDatabase(c echo.Context) error {
	backupDir := filepath.Join(h.App.Config.Data.AppDataDir, "backups")
	res, err := h.App.Database.BackupContext(c.Request().Context(), backupDir, 5) // Keep last 5 backups
	if err != nil {
		h.App.Logger.Error().Err(err).Msg("handlers: Failed to backup database")
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, res)
}

// HandleDownloadDatabaseBackup ...
//
//	@summary downloads the latest SQLite DB backup file.
//	@route /api/v1/db/backup/download [GET]
//	@returns file
func (h *Handler) HandleDownloadDatabaseBackup(c echo.Context) error {
	backupDir := filepath.Join(h.App.Config.Data.AppDataDir, "backups")
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return h.RespondWithCodeError(c, 404, errors.New("no backup files found"))
		}
		return h.RespondWithError(c, err)
	}

	// El nombre lleva timestamp (kamehouse-backup-YYYY-MM-DD_HH-MM-SS.db):
	// orden lexicográfico descendente = más reciente primero.
	latest := ""
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || len(name) < 4 || name[len(name)-3:] != ".db" {
			continue
		}
		if len(name) < 17 || name[:17] != "kamehouse-backup-" {
			continue
		}
		if name > latest {
			latest = name
		}
	}
	if latest == "" {
		return h.RespondWithError(c, fmt.Errorf("no backup files found"))
	}

	fullPath := filepath.Join(backupDir, latest)
	// Defensa en profundidad: aunque el nombre sale del listado, anclar al dir.
	if filepath.Dir(fullPath) != backupDir {
		return h.RespondWithError(c, fmt.Errorf("invalid backup path"))
	}
	return c.Attachment(fullPath, latest)
}

// HandleGetDiagnosticsReport ...
//
//	@summary streams a zip archive with diagnostics data.
//	@route /api/v1/report [GET]
func (h *Handler) HandleGetDiagnosticsReport(c echo.Context) error {
	timestamp := time.Now().Format("2006-01-02_15-04-05")
	filename := fmt.Sprintf("kamehouse-diagnostics-%s.zip", timestamp)

	c.Response().Header().Set("Content-Type", "application/zip")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	return h.writeDiagnosticsArchive(c.Request().Context(), c.Response())
}
