package handlers

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"kamehouse/internal/constants"
	"os"
	"path/filepath"
	"runtime"
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
	res, err := h.App.Database.Backup(backupDir, 5) // Keep last 5 backups
	if err != nil {
		h.App.Logger.Error().Err(err).Msg("handlers: Failed to backup database")
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, res)
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

	pr, pw := io.Pipe()
	go func() {
		zipWriter := zip.NewWriter(pw)
		var writeErr error
		defer func() {
			if writeErr != nil {
				_ = pw.CloseWithError(writeErr)
			} else {
				_ = pw.Close()
			}
		}()

		// 1. Logs
		if h.App.OnFlushLogs != nil {
			h.App.OnFlushLogs()
			time.Sleep(100 * time.Millisecond)
		}
		logPath, err := h.latestServerLogPath()
		if err == nil {
			if logFile, err := os.Open(logPath); err == nil {
				if f, err := zipWriter.Create("logs/latest.log"); err == nil && f != nil {
					_, writeErr = io.Copy(f, logFile)
				}
				_ = logFile.Close()
			}
		}

		// 2. Settings (Redacted)
		settings, err := h.App.Database.GetSettings()
		if err == nil && settings != nil {
			// GetSettings returns the shared cached pointer (db.CurrSettings); copy
			// before redacting so the live in-memory API keys are not destroyed.
			settingsCopy := *settings
			redact := func(s string) string {
				if s != "" {
					return "<redacted>"
				}
				return s
			}
			settingsCopy.Library.TmdbApiKey = redact(settingsCopy.Library.TmdbApiKey)

			if settingsJSON, err := json.MarshalIndent(&settingsCopy, "", "  "); err == nil {
				if f, err := zipWriter.Create("settings.json"); err == nil && f != nil {
					_, _ = f.Write(settingsJSON)
				}
			}
		}

		// 3. Runtime
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		runtimeInfo := map[string]interface{}{
			"version":      constants.Version,
			"versionName":  constants.VersionName,
			"goVersion":    runtime.Version(),
			"goOS":         runtime.GOOS,
			"goArch":       runtime.GOARCH,
			"numCPU":       runtime.NumCPU(),
			"numGoroutine": runtime.NumGoroutine(),
			"memStats":     mapMemStats(m),
		}
		if runtimeJSON, err := json.MarshalIndent(runtimeInfo, "", "  "); err == nil {
			if f, err := zipWriter.Create("runtime.json"); err == nil && f != nil {
				_, _ = f.Write(runtimeJSON)
			}
		}

		// 4. Disk Usage
		fileCacheSize, _ := h.App.FileCacher.GetTotalSize()
		videoFilesSize, _ := h.App.FileCacher.GetMediastreamVideoFilesTotalSize()

		// Get DB size
		var dbSize int64
		dbInfo, err := os.Stat(filepath.Join(h.App.Config.Data.AppDataDir, h.App.Config.Database.Name+".db"))
		if err == nil {
			dbSize = dbInfo.Size()
		}

		diskUsage := map[string]interface{}{
			"fileCacheBytes":    fileCacheSize,
			"videoFilesBytes":   videoFilesSize,
			"databaseBytes":     dbSize,
			"transcodeDirBytes": dirSizeBytes(h.App.Config.Cache.TranscodeDir),
			"logsDirBytes":      dirSizeBytes(h.App.Config.Logs.Dir),
		}
		if diskUsageJSON, err := json.MarshalIndent(diskUsage, "", "  "); err == nil {
			if f2, err := zipWriter.Create("disk-usage.json"); err == nil && f2 != nil {
				_, _ = f2.Write(diskUsageJSON)
			}
		}

		_ = zipWriter.Close()
	}()

	return c.Stream(200, "application/zip", pr)
}

func dirSizeBytes(root string) int64 {
	var total int64
	_ = filepath.WalkDir(root, func(_ string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if info, e := d.Info(); e == nil {
			total += info.Size()
		}
		return nil
	})
	return total
}
