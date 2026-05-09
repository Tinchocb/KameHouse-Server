package videofile

import (
	"context"
	"fmt"
	"kamehouse/internal/util"
	"kamehouse/internal/util/crashlog"
	"os"
	"path/filepath"

	"github.com/rs/zerolog"
)

func GetFileSubsCacheDir(outDir string, hash string) string {
	return filepath.Join(outDir, "videofiles", hash, "/subs")
}

func GetFileAttCacheDir(outDir string, hash string) string {
	return filepath.Join(outDir, "videofiles", hash, "/att")
}

func ExtractAttachment(ffmpegPath string, path string, hash string, mediaInfo *MediaInfo, cacheDir string, logger *zerolog.Logger) (err error) {
	logger.Debug().Str("hash", hash).Msgf("videofile: Starting media attachment extraction")

	attachmentPath := GetFileAttCacheDir(cacheDir, hash)
	subsPath := GetFileSubsCacheDir(cacheDir, hash)
	_ = os.MkdirAll(attachmentPath, 0755)
	_ = os.MkdirAll(subsPath, 0755)

	subsDir, err := os.ReadDir(subsPath)
	if err == nil {
		if len(subsDir) == len(mediaInfo.Subtitles) {
			logger.Debug().Str("hash", hash).Msgf("videofile: Attachments already extracted")
			return
		}
	}

	for _, sub := range mediaInfo.Subtitles {
		if sub.Extension == nil || *sub.Extension == "" {
			logger.Error().Msgf("videofile: Subtitle format is not supported")
			return fmt.Errorf("videofile: Unsupported subtitle format")
		}
	}

	// If there are no fonts and no subtitles, there is nothing to extract
	if len(mediaInfo.Fonts) == 0 && len(mediaInfo.Subtitles) == 0 {
		logger.Debug().Str("hash", hash).Msgf("videofile: No attachments or subtitles to extract")
		return nil
	}

	// Instantiate a new crash logger
	crashLogger := crashlog.GlobalCrashLogger.InitArea("ffmpeg")
	defer crashLogger.Close()

	crashLogger.LogInfof("Extracting attachments from %s", path)

	// DEVNOTE: All paths fed into this command should be absolute
	args := []string{}
	
	// Only dump attachments if fonts exist
	if len(mediaInfo.Fonts) > 0 {
		args = append(args, "-dump_attachment:t", "")
	}
	
	args = append(args, "-y", "-i", path)

	cmd := util.NewCmdCtx(
		context.Background(),
		ffmpegPath,
		args...
	)
	// The working directory for the command is the attachment directory
	cmd.Dir = attachmentPath

	for _, sub := range mediaInfo.Subtitles {
		if ext := sub.Extension; ext != nil {
			cmd.Args = append(
				cmd.Args,
				"-map", fmt.Sprintf("0:s:%d", sub.Index),
				"-c:s", "copy",
				fmt.Sprintf("%s/%d.%s", subsPath, sub.Index, *ext),
			)
		}
	}

	// If we are only extracting fonts (no subtitles), we still need to provide an output format for ffmpeg to not complain
	if len(mediaInfo.Subtitles) == 0 {
		// Just copy video/audio to a null muxer to satisfy ffmpeg output requirement
		cmd.Args = append(cmd.Args, "-f", "null", "-")
	}

	cmd.Stdout = crashLogger.Stdout()
	cmd.Stderr = crashLogger.Stdout()
	err = cmd.Run()
	if err != nil {
		logger.Error().Err(err).Msgf("videofile: Error starting FFmpeg")
		crashlog.GlobalCrashLogger.WriteAreaLogToFile(crashLogger)
	}

	return err
}
