package videofile

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"kamehouse/internal/util"
	"kamehouse/internal/util/crashlog"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

func GetFileSubsCacheDir(outDir string, hash string) string {
	return filepath.Join(outDir, "videofiles", hash, "/subs")
}

func GetFileAttCacheDir(outDir string, hash string) string {
	return filepath.Join(outDir, "videofiles", hash, "/att")
}

// ExtractOptions ajusta una extracción para fuentes lentas (Google Drive vía loopback).
type ExtractOptions struct {
	// Timeout acota la corrida de ffmpeg; 0 usa el valor por defecto (2 min, pensado
	// para archivos locales).
	Timeout time.Duration
	// OnProgress recibe cuántos segundos de media ffmpeg ya procesó (out_time). Si es
	// nil, ffmpeg no emite progreso.
	OnProgress func(outTimeSeconds float64)
}

func ExtractAttachment(ctx context.Context, ffmpegPath string, path string, hash string, mediaInfo *MediaInfo, cacheDir string, logger *zerolog.Logger) (err error) {
	return ExtractAttachmentOpts(ctx, ffmpegPath, path, hash, mediaInfo, cacheDir, logger, ExtractOptions{})
}

// progressWriter interpreta el `-progress pipe:1` de ffmpeg (líneas clave=valor) y
// llama a onProgress con el tiempo de salida en segundos.
type progressWriter struct {
	pw *io.PipeWriter
}

func newProgressWriter(onProgress func(float64)) *progressWriter {
	pr, pw := io.Pipe()
	go func() {
		sc := bufio.NewScanner(pr)
		for sc.Scan() {
			line := sc.Text()
			// out_time_us (y el confuso out_time_ms, que también está en µs).
			if v, ok := strings.CutPrefix(line, "out_time_us="); ok {
				if us, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64); err == nil && us >= 0 {
					onProgress(float64(us) / 1e6)
				}
			}
		}
		_, _ = io.Copy(io.Discard, pr)
	}()
	return &progressWriter{pw: pw}
}

func (w *progressWriter) Write(p []byte) (int, error) { return w.pw.Write(p) }
func (w *progressWriter) Close() error                { return w.pw.Close() }

const attachmentManifest = "attachments.complete.json"

type attachmentCompletion struct {
	Signature string           `json:"signature"`
	Files     map[string]int64 `json:"files"`
}

func attachmentSignature(info *MediaInfo) string {
	raw, _ := json.Marshal(struct {
		Fonts     []string
		Subtitles []Subtitle
	}{info.Fonts, info.Subtitles})
	return string(raw)
}

func attachmentsComplete(root string, info *MediaInfo) bool {
	raw, err := os.ReadFile(filepath.Join(root, attachmentManifest))
	if err != nil {
		return false
	}
	var completion attachmentCompletion
	if json.Unmarshal(raw, &completion) != nil || completion.Signature == "" || (info != nil && completion.Signature != attachmentSignature(info)) {
		return false
	}
	for name, size := range completion.Files {
		if !filepath.IsLocal(name) {
			return false
		}
		fi, err := os.Stat(filepath.Join(root, name))
		if err != nil || !fi.Mode().IsRegular() || fi.Size() != size {
			return false
		}
	}
	return true
}

// AttachmentsComplete verifies the success manifest and all committed files.
func AttachmentsComplete(cacheDir, hash string) bool {
	return attachmentsComplete(filepath.Join(cacheDir, "videofiles", hash), nil)
}

// CommitWindowAttachments records files atomically written by the MKV window
// reader after it has read every cluster. It never makes partial windows complete.
func CommitWindowAttachments(cacheDir, hash string) error {
	root := filepath.Join(cacheDir, "videofiles", hash)
	completion := attachmentCompletion{Signature: "mkv-window-v1", Files: make(map[string]int64)}
	for _, dir := range []string{"att", "subs"} {
		entries, err := os.ReadDir(filepath.Join(root, dir))
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			return err
		}
		for _, entry := range entries {
			fi, err := entry.Info()
			if err != nil {
				return err
			}
			completion.Files[filepath.Join(dir, entry.Name())] = fi.Size()
		}
	}
	raw, err := json.Marshal(completion)
	if err != nil {
		return err
	}
	return util.WriteFileAtomic(filepath.Join(root, attachmentManifest), raw)
}

// ExtractAttachmentOpts es ExtractAttachment con tope de tiempo y progreso configurables.
func ExtractAttachmentOpts(ctx context.Context, ffmpegPath string, path string, hash string, mediaInfo *MediaInfo, cacheDir string, logger *zerolog.Logger, opts ExtractOptions) (err error) {
	logger.Debug().Str("hash", hash).Msgf("videofile: Starting media attachment extraction")

	root := filepath.Join(cacheDir, "videofiles", hash)
	if attachmentsComplete(root, mediaInfo) {
		return nil
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := os.MkdirAll(root, 0755); err != nil {
		return err
	}
	staging, err := os.MkdirTemp(root, ".extract-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(staging)
	attachmentPath := filepath.Join(staging, "att")
	subsPath := filepath.Join(staging, "subs")
	if err := os.MkdirAll(attachmentPath, 0755); err != nil {
		return err
	}
	if err := os.MkdirAll(subsPath, 0755); err != nil {
		return err
	}
	for _, sub := range mediaInfo.Subtitles {
		// Check if it's PGS
		if sub.IsImageBased {
			if ext := sub.Extension; ext != nil && *ext != "" {
				// We'll extract them as .sup or whatever extension is provided.
				continue
			}
			continue
		}
		if sub.Extension == nil || *sub.Extension == "" {
			logger.Error().Msgf("videofile: Subtitle format is not supported")
			return fmt.Errorf("videofile: Unsupported subtitle format")
		}
	}

	// If there are no fonts and no text subtitles, there is nothing to extract
	textSubCount := 0
	for _, sub := range mediaInfo.Subtitles {
		if !sub.IsImageBased && sub.Extension != nil && *sub.Extension != "" {
			textSubCount++
		}
	}
	if len(mediaInfo.Fonts) == 0 && len(mediaInfo.Subtitles) == 0 {
		logger.Debug().Str("hash", hash).Msgf("videofile: No attachments or subtitles to extract")
		return nil
	}

	// Instantiate a new crash logger
	crashLogger := crashlog.GlobalCrashLogger.InitArea("ffmpeg")
	defer crashLogger.Close()

	crashLogger.LogInfof("Extracting attachments from %s", path)

	// DEVNOTE: All paths fed into this command should be absolute
	args := []string{"-y"}
	if opts.OnProgress != nil {
		args = append(args, "-nostats", "-progress", "pipe:1")
	}

	// Fonts are dumped individually to avoid empty string / directory path issues on Windows.
	for i, fontName := range mediaInfo.Fonts {
		safeFontName := filepath.Base(filepath.Clean(fontName))
		if safeFontName == "" || safeFontName == "." || safeFontName == ".." {
			safeFontName = fmt.Sprintf("font_%d.ttf", i)
		}
		args = append(args, fmt.Sprintf("-dump_attachment:t:%d", i), filepath.Join(attachmentPath, safeFontName))
	}

	args = append(args, "-i", path)

	// Cap the run even if the caller's ctx has no deadline.
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = 2 * time.Minute
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := util.NewCmdCtx(
		ctx,
		ffmpegPath,
		args...,
	)
	// The working directory for the command is the attachment directory
	cmd.Dir = attachmentPath

	for _, sub := range mediaInfo.Subtitles {
		// Skip image-based subs that are not PGS or have no extension.
		if sub.IsImageBased {
			if ext := sub.Extension; ext != nil && *ext == "sup" {
				cmd.Args = append(
					cmd.Args,
					"-map", fmt.Sprintf("0:s:%d", sub.Index),
					"-c:s", "copy",
					filepath.Join(subsPath, fmt.Sprintf("%d.sup", sub.Index)),
				)
			}
			continue
		}
		if ext := sub.Extension; ext != nil {
			cmd.Args = append(
				cmd.Args,
				"-map", fmt.Sprintf("0:s:%d", sub.Index),
				"-c:s", "copy",
				filepath.Join(subsPath, fmt.Sprintf("%d.%s", sub.Index, *ext)),
			)
		}
	}

	// If we are only extracting fonts (no text subtitles), we still need to provide
	// an output format for ffmpeg to not complain
	if textSubCount == 0 && len(mediaInfo.Fonts) > 0 {
		// Solo fuentes: se mapean sólo los adjuntos (copiados tal cual) a un muxer nulo. Sin -map,
		// ffmpeg elige video y audio por defecto y los decodifica enteros en cada reproducción.
		// Medido con ffmpeg real: decodificaba 480 cuadros de un clip de 20 s; con esto, cero.
		cmd.Args = append(cmd.Args, "-map", "0:t?", "-c", "copy", "-f", "null", "-")
	}

	cmd.Stdout = crashLogger.Stdout()
	cmd.Stderr = crashLogger.Stdout()
	if opts.OnProgress != nil {
		pwr := newProgressWriter(opts.OnProgress)
		defer pwr.Close()
		cmd.Stdout = io.MultiWriter(crashLogger.Stdout(), pwr)
	}
	err = cmd.Run()
	if err != nil {
		logger.Error().Err(err).Msgf("videofile: Error starting FFmpeg")
		crashlog.GlobalCrashLogger.WriteAreaLogToFile(crashLogger)
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	completion := attachmentCompletion{Signature: attachmentSignature(mediaInfo), Files: make(map[string]int64)}
	for _, dir := range []string{"att", "subs"} {
		entries, err := os.ReadDir(filepath.Join(staging, dir))
		if err != nil {
			return err
		}
		for _, entry := range entries {
			fi, err := entry.Info()
			if err != nil {
				return err
			}
			completion.Files[filepath.Join(dir, entry.Name())] = fi.Size()
		}
	}
	// Publish only successful output. The manifest is the commit record: a crash
	// between directory renames leaves an uncommitted cache that is rebuilt.
	if err := os.Remove(filepath.Join(root, attachmentManifest)); err != nil && !os.IsNotExist(err) {
		return err
	}
	for _, dir := range []string{"att", "subs"} {
		if err := os.RemoveAll(filepath.Join(root, dir)); err != nil {
			return err
		}
		if err := os.Rename(filepath.Join(staging, dir), filepath.Join(root, dir)); err != nil {
			return err
		}
	}
	raw, err := json.Marshal(completion)
	if err != nil {
		return err
	}
	return util.WriteFileAtomic(filepath.Join(root, attachmentManifest), raw)
}
