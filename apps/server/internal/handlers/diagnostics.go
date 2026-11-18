package handlers

import (
	"archive/zip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"

	"kamehouse/internal/constants"
)

type diagnosticsWriter struct {
	ctx context.Context
	out io.Writer
}

func (w diagnosticsWriter) Write(data []byte) (int, error) {
	if err := w.ctx.Err(); err != nil {
		return 0, err
	}
	return w.out.Write(data)
}

type diagnosticsReader struct {
	ctx context.Context
	in  io.Reader
}

func (r diagnosticsReader) Read(data []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	return r.in.Read(data)
}

// All archive work belongs to the requesting handler. A failed write or a
// cancelled request stops subsequent snapshots and directory walks immediately.
func (h *Handler) writeDiagnosticsArchive(ctx context.Context, out io.Writer) (err error) {
	defer func() {
		if rec := recover(); rec != nil {
			err = fmt.Errorf("diagnostics: archive panic: %v", rec)
		}
	}()
	if err := ctx.Err(); err != nil {
		return err
	}
	w := zip.NewWriter(diagnosticsWriter{ctx: ctx, out: out})
	writeJSON := func(name string, value interface{}) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		entry, err := w.Create(name)
		if err != nil {
			return err
		}
		enc := json.NewEncoder(entry)
		enc.SetIndent("", "  ")
		if err := enc.Encode(value); err != nil {
			return err
		}
		return w.Flush()
	}
	if h.App.OnFlushLogs != nil {
		h.App.OnFlushLogs()
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if logPath, err := h.latestServerLogPath(); err == nil {
		if logFile, err := os.Open(logPath); err == nil {
			if err := copyDiagnosticsLog(ctx, w, logFile); err != nil {
				return err
			}
			if err := w.Flush(); err != nil {
				return err
			}
		}
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if settings, err := h.App.Database.GetSettings(); err == nil && settings != nil {
		view := *settings // cached settings belong to the repository
		redact := func(s string) string {
			if s != "" {
				return "<redacted>"
			}
			return s
		}
		view.Library.TmdbApiKey = redact(view.Library.TmdbApiKey)
		view.GoogleDrive.ClientSecret = redact(view.GoogleDrive.ClientSecret)
		view.GoogleDrive.RefreshToken = redact(view.GoogleDrive.RefreshToken)
		if err := writeJSON("settings.json", &view); err != nil {
			return err
		}
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	if err := writeJSON("runtime.json", map[string]interface{}{
		"version": constants.Version, "versionName": constants.VersionName,
		"goVersion": runtime.Version(), "goOS": runtime.GOOS, "goArch": runtime.GOARCH,
		"numCPU": runtime.NumCPU(), "numGoroutine": runtime.NumGoroutine(), "memStats": mapMemStats(m),
	}); err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	var fileSize, videoSize int64
	if h.App.FileCacher != nil {
		fileSize, _ = h.App.FileCacher.GetTotalSizeContext(ctx)
		if ctx.Err() != nil {
			return ctx.Err()
		}
		// Disk statistics are best effort, matching the existing report contract.
		videoSize, _ = h.App.FileCacher.GetMediastreamVideoFilesTotalSizeContext(ctx)
		if ctx.Err() != nil {
			return ctx.Err()
		}
	}
	var dbSize int64
	if info, statErr := os.Stat(filepath.Join(h.App.Config.Data.AppDataDir, h.App.Config.Database.Name+".db")); statErr == nil {
		dbSize = info.Size()
	}
	transcodeSize, err := dirSizeBytesContext(ctx, h.App.Config.Cache.TranscodeDir)
	if err != nil {
		return err
	}
	logsSize, err := dirSizeBytesContext(ctx, h.App.Config.Logs.Dir)
	if err != nil {
		return err
	}
	if err := writeJSON("disk-usage.json", map[string]interface{}{
		"fileCacheBytes": fileSize, "videoFilesBytes": videoSize, "databaseBytes": dbSize,
		"transcodeDirBytes": transcodeSize, "logsDirBytes": logsSize,
	}); err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	return w.Close()
}

func copyDiagnosticsLog(ctx context.Context, w *zip.Writer, file *os.File) (err error) {
	defer func() {
		if closeErr := file.Close(); err == nil {
			err = closeErr
		}
	}()
	entry, err := w.Create("logs/latest.log")
	if err != nil {
		return err
	}
	_, err = io.Copy(entry, diagnosticsReader{ctx: ctx, in: file})
	return err
}

func dirSizeBytesContext(ctx context.Context, root string) (int64, error) {
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	if root == "" {
		return 0, nil
	}
	var total int64
	err := filepath.WalkDir(root, func(_ string, d fs.DirEntry, err error) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err != nil || d.IsDir() {
			return nil
		}
		if info, err := d.Info(); err == nil {
			total += info.Size()
		}
		return nil
	})
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return total, err
	}
	return total, ctx.Err()
}
