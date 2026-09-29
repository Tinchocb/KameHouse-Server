package summary

import (
	"fmt"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/platforms/platform"

	"github.com/google/uuid"
)

const (
	LogFileNotMatched LogType = iota
	LogComparison
	LogSuccessfullyMatched
	LogFailedMatch
	LogMatchValidated
	LogUnmatched
	LogMetadataMediaTreeFetched
	LogMetadataMediaTreeFetchFailed
	LogMetadataEpisodeNormalized
	LogMetadataEpisodeNormalizationFailed
	LogMetadataEpisodeZero
	LogMetadataNC
	LogMetadataSpecial
	LogMetadataMain
	LogMetadataHydrated
	LogPanic
	LogDebug
)

type (
	LogType int

	ScanSummaryLogger struct {
		Logs            []*dto.ScanSummaryLog
		LocalFiles      []*dto.LocalFile
		AllMedia        []*dto.NormalizedMedia
		AnimeCollection *platform.UnifiedCollection
	}
)

func NewScanSummaryLogger() *ScanSummaryLogger {
	return &ScanSummaryLogger{
		Logs: make([]*dto.ScanSummaryLog, 0),
	}
}

// HydrateData will hydrate the data needed to generate the summary.
func (l *ScanSummaryLogger) HydrateData(lfs []*dto.LocalFile, media []*dto.NormalizedMedia, animeCollection *platform.UnifiedCollection) {
	l.LocalFiles = lfs
	l.AllMedia = media
	l.AnimeCollection = animeCollection
}

func (l *ScanSummaryLogger) GenerateSummary() *dto.ScanSummary {
	if l == nil || l.LocalFiles == nil {
		return nil
	}

	// AllMedia is optional — when nil, groups will have no title/image
	if l.AllMedia == nil {
		l.AllMedia = make([]*dto.NormalizedMedia, 0)
	}

	summary := &dto.ScanSummary{
		ID:             uuid.NewString(),
		Groups:         make([]*dto.ScanSummaryGroup, 0),
		UnmatchedFiles: make([]*dto.ScanSummaryFile, 0),
	}

	groupsMap := make(map[int][]*dto.ScanSummaryFile)

	// Generate summary files
	for _, lf := range l.LocalFiles {

		if lf.MediaID == 0 {
			summary.UnmatchedFiles = append(summary.UnmatchedFiles, &dto.ScanSummaryFile{
				ID:        uuid.NewString(),
				LocalFile: lf,
				Logs:      l.getFileLogs(lf),
			})
			continue
		}

		summaryFile := &dto.ScanSummaryFile{
			ID:        uuid.NewString(),
			LocalFile: lf,
			Logs:      l.getFileLogs(lf),
		}

		//summary.Files = append(summary.Files, summaryFile)

		// Add to group
		if _, ok := groupsMap[lf.MediaID]; !ok {
			groupsMap[lf.MediaID] = make([]*dto.ScanSummaryFile, 0)
			groupsMap[lf.MediaID] = append(groupsMap[lf.MediaID], summaryFile)
		} else {
			groupsMap[lf.MediaID] = append(groupsMap[lf.MediaID], summaryFile)
		}
	}

	// Generate summary groups
	for mediaID, files := range groupsMap {
		mediaTitle := ""
		mediaImage := ""
		mediaIsInCollection := false
		for _, m := range l.AllMedia {
			if m.ID == mediaID {
				mediaTitle = dto.GetTitleSafe(m)
				mediaImage = ""
				if m.CoverImage != nil && m.CoverImage.Large != nil {
					mediaImage = *m.CoverImage.Large
				}
				break
			}
		}
		if l.AnimeCollection != nil {
			if _, found := l.AnimeCollection.GetListEntryFromMediaId(mediaID); found {
				mediaIsInCollection = true
			}
		}

		summary.Groups = append(summary.Groups, &dto.ScanSummaryGroup{
			ID:                  uuid.NewString(),
			Files:               files,
			MediaID:             mediaID,
			MediaTitle:          mediaTitle,
			MediaImage:          mediaImage,
			MediaIsInCollection: mediaIsInCollection,
		})
	}

	return summary
}

func (l *ScanSummaryLogger) LogPanic(lf *dto.LocalFile, stackTrace string) {
	if l == nil {
		return
	}
	//msg := fmt.Sprintf("Panic occurred, please report this issue on the GitHub repository with the stack trace printed in the terminal")
	l.logType(LogPanic, lf, "PANIC! "+stackTrace)
}

func (l *ScanSummaryLogger) LogMetadataEpisodeNormalizationFailed(lf *dto.LocalFile, err error, episode int, aniDBEpisode string) {
	if l == nil {
		return
	}
	msg := fmt.Sprintf("Episode normalization failed. Reason \"%s\". Episode %d. AniDB episode %s", err.Error(), episode, aniDBEpisode)
	l.logType(LogMetadataEpisodeNormalizationFailed, lf, msg)
}

func (l *ScanSummaryLogger) LogMetadataNC(lf *dto.LocalFile) {
	if l == nil {
		return
	}
	msg := "Marked as NC file"
	l.logType(LogMetadataNC, lf, msg)
}

func (l *ScanSummaryLogger) LogMetadataSpecial(lf *dto.LocalFile, episode int, aniDBEpisode string) {
	if l == nil {
		return
	}
	msg := fmt.Sprintf("Marked as Special episode. Episode %d. AniDB episode: %s", episode, aniDBEpisode)
	l.logType(LogMetadataSpecial, lf, msg)
}

func (l *ScanSummaryLogger) LogMetadataMain(lf *dto.LocalFile, episode int, aniDBEpisode string) {
	if l == nil {
		return
	}
	msg := fmt.Sprintf("Marked as main episode. Episode %d. AniDB episode: %s", episode, aniDBEpisode)
	l.logType(LogMetadataMain, lf, msg)
}

func (l *ScanSummaryLogger) LogMetadataEpisodeZero(lf *dto.LocalFile, episode int, aniDBEpisode string) {
	if l == nil {
		return
	}
	msg := fmt.Sprintf("Marked as main episode. Episode %d. AniDB episode set to %s assuming AniDB does not include episode 0 in the episode count.", episode, aniDBEpisode)
	l.logType(LogMetadataEpisodeZero, lf, msg)
}

func (l *ScanSummaryLogger) logType(logType LogType, lf *dto.LocalFile, message string) {
	if l == nil {
		return
	}
	switch logType {
	case LogComparison:
		l.log(lf, "info", message)
	case LogSuccessfullyMatched:
		l.log(lf, "info", message)
	case LogFailedMatch:
		l.log(lf, "warning", message)
	case LogMatchValidated:
		l.log(lf, "info", message)
	case LogUnmatched:
		l.log(lf, "warning", message)
	case LogMetadataMediaTreeFetched:
		l.log(lf, "info", message)
	case LogMetadataMediaTreeFetchFailed:
		l.log(lf, "error", message)
	case LogMetadataEpisodeNormalized:
		l.log(lf, "info", message)
	case LogMetadataEpisodeNormalizationFailed:
		l.log(lf, "error", message)
	case LogMetadataHydrated:
		l.log(lf, "info", message)
	case LogMetadataNC:
		l.log(lf, "info", message)
	case LogMetadataSpecial:
		l.log(lf, "info", message)
	case LogMetadataMain:
		l.log(lf, "info", message)
	case LogMetadataEpisodeZero:
		l.log(lf, "warning", message)
	case LogFileNotMatched:
		l.log(lf, "warning", message)
	case LogPanic:
		l.log(lf, "error", message)
	case LogDebug:
		l.log(lf, "info", message)
	}
}

func (l *ScanSummaryLogger) log(lf *dto.LocalFile, level string, message string) {
	if l == nil {
		return
	}
	l.Logs = append(l.Logs, &dto.ScanSummaryLog{
		ID:       uuid.NewString(),
		FilePath: lf.Path,
		Level:    level,
		Message:  message,
	})
}

func (l *ScanSummaryLogger) getFileLogs(lf *dto.LocalFile) []*dto.ScanSummaryLog {
	logs := make([]*dto.ScanSummaryLog, 0)
	if l == nil {
		return logs
	}
	for _, log := range l.Logs {
		if log == nil || lf == nil {
			continue
		}
		if lf.HasSamePath(log.FilePath) {
			logs = append(logs, log)
		}
	}
	return logs
}
