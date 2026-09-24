package drive

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/parser"
	"kamehouse/internal/library/scanner"
	"kamehouse/internal/util"
)

var (
	kaiEpRegexes = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\b(?:s\d+)?e0*(\d{1,4})\b`),
		regexp.MustCompile(`(?i)(?:cap[ií]tulo|episodio|episode|ep|cap)\s*0*(\d{1,4})\b`),
		regexp.MustCompile(`(?i)\b-\s*0*(\d{1,4})\s*[-_\[\.]`),
		regexp.MustCompile(`(?i)\s0*(\d{1,4})\s`),
		regexp.MustCompile(`(?i)[_ -]0*(\d{1,4})\.[a-z0-9]{3,4}$`),
	}

	reLeadingYear = regexp.MustCompile(`^\s*[\(\[]\s*\d{4}(?:\s*-\s*\d{4})?\s*[\)\]]\s*`)
)

// ExtractEpisodeNumber attempts to parse an episode number from a filename.
func ExtractEpisodeNumber(filename string) (int, bool) {
	clean := filepath.Base(filename)
	for _, re := range kaiEpRegexes {
		matches := re.FindStringSubmatch(clean)
		if len(matches) >= 2 {
			if n, err := strconv.Atoi(matches[1]); err == nil && n > 0 && n <= 1000 {
				return n, true
			}
		}
	}
	return 0, false
}

// ResolveKaiSaga returns saga name and ID based on Kai episode number.
func ResolveKaiSaga(ep int) (sagaName string, sagaID string, season int) {
	switch {
	case ep >= 1 && ep <= 17:
		return "Saga de los Saiyajin", "saiyajin", 1
	case ep >= 18 && ep <= 54:
		return "Saga de Freezer", "namek-freezer", 2
	case ep >= 55 && ep <= 98:
		return "Saga de los Androides y Cell", "androides-cell", 3
	case ep >= 99 && ep <= 167:
		return "Saga de Majin Buu", "majin-buu", 4
	default:
		return "Dragon Ball Kai", "kai", 1
	}
}

// CleanSeriesName removes leading year prefixes like "(1989-1996) Dragon Ball Z" -> "Dragon Ball Z".
func CleanSeriesName(name string) string {
	cleaned := reLeadingYear.ReplaceAllString(name, "")
	return strings.TrimSpace(cleaned)
}

// ResolvedDriveFile contains parsed identity and metadata for an indexed Drive file.
type ResolvedDriveFile struct {
	TargetMediaID  int    // TMDB ID (or TMDB + 1,000,000 for movies)
	RawTmdbID      int    // Raw TMDB ID
	MediaType      string // "ANIME" or "MOVIE"
	Format         string // "TV", "MOVIE", "SPECIAL", "OVA"
	IsMovie        bool
	SeriesTitle    string
	EpisodeNumber  int
	AbsoluteNumber int
	SeasonNumber   int
	EpisodeTitle   string
	SagaName       string
	SagaID         string
	EpisodeType    string
}

// ResolveDriveFile inspects a DriveFile's path and filename to resolve its series, episode, and saga.
func ResolveDriveFile(df DriveFile, fallbackIdx int) ResolvedDriveFile {
	cleanPath := filepath.ToSlash(df.RelativePath)
	parts := strings.Split(cleanPath, "/")
	seriesFolder := ""
	if len(parts) > 1 {
		seriesFolder = strings.TrimSpace(parts[0])
	}
	filename := df.Name

	// 1. Dragon Ball Resolution: mismo resolver que el escáner local, para que un
	// archivo se clasifique igual esté en disco o en Drive.
	tmdbID, isMovie, found := scanner.ResolveDragonBallPath(cleanPath)

	// Parse filename using KameHouse's advanced anime name parser
	pm := parser.Parse(filename)
	epNum, _ := ExtractEpisodeNumber(filename)
	if epNum == 0 && len(pm.Episodes) > 0 {
		epNum = pm.Episodes[0]
	}
	if epNum == 0 {
		epNum = fallbackIdx
	}

	res := ResolvedDriveFile{
		EpisodeNumber:  epNum,
		AbsoluteNumber: epNum,
		SeasonNumber:   1,
		EpisodeType:    "REGULAR",
	}

	if found {
		res.RawTmdbID = tmdbID
		res.IsMovie = isMovie

		pre := scanner.CreatePrehydratedDragonBallMedia(tmdbID)
		title := ""
		if pre != nil && pre.Title != nil && pre.Title.Spanish != nil {
			title = *pre.Title.Spanish
		} else if seriesFolder != "" {
			title = CleanSeriesName(seriesFolder)
		} else {
			title = "Dragon Ball"
		}
		res.SeriesTitle = title

		if isMovie {
			res.TargetMediaID = tmdbID + 1000000
			res.MediaType = "MOVIE"
			res.Format = "MOVIE"
			if pre != nil && pre.Format != nil {
				res.Format = string(*pre.Format)
			}
			res.EpisodeType = "MOVIE"
			res.EpisodeNumber = 1
			res.AbsoluteNumber = 1
			res.SeasonNumber = 1
			res.EpisodeTitle = title
			res.SagaName = title
			res.SagaID = fmt.Sprintf("movie-%d", tmdbID)
			return res
		}

		// Series
		res.TargetMediaID = tmdbID
		res.MediaType = "SHOW"
		res.Format = "TV"

		if pm.EpisodeTitle != "" {
			res.EpisodeTitle = pm.EpisodeTitle
		} else {
			res.EpisodeTitle = fmt.Sprintf("Episodio %d", epNum)
		}

		// Dragon Ball sagas. La saga va en SagaName/SagaID; la temporada queda en 1 con
		// numeración absoluta, igual que el escáner local y TMDB. Si se usara el índice
		// de saga como temporada, el mismo episodio local y de Drive caerían en claves
		// distintas ("1-100" vs "2-100") y la serie mostraría cada episodio duplicado.
		dbSagas := scanner.GetDragonBallSagaInfo(tmdbID)
		if len(dbSagas) > 0 {
			res.SagaName = dbSagas[0].Name
			res.SagaID = dbSagas[0].ID
			for _, s := range dbSagas {
				if epNum >= s.StartEp && epNum <= s.EndEp {
					res.SagaName = s.Name
					res.SagaID = s.ID
					break
				}
			}
		} else {
			res.SagaName = title
			res.SagaID = "main"
		}

		if tmdbID == 61709 || tmdbID == 42705 {
			kSaga, kID, _ := ResolveKaiSaga(epNum)
			res.SagaName = kSaga
			res.SagaID = kID
		}

		return res
	}

	// 2. Non-Dragon Ball anime (future expansion)
	seriesTitle := CleanSeriesName(seriesFolder)
	if seriesTitle == "" && pm.Title != "" {
		seriesTitle = pm.Title
	}
	if seriesTitle == "" {
		seriesTitle = "Anime"
	}

	res.RawTmdbID = generateSyntheticTmdbID(seriesTitle)
	res.TargetMediaID = res.RawTmdbID
	res.MediaType = "SHOW"
	res.Format = "TV"
	res.SeriesTitle = seriesTitle
	res.IsMovie = false
	if pm.Season > 0 {
		res.SeasonNumber = pm.Season
	}
	if pm.EpisodeTitle != "" {
		res.EpisodeTitle = pm.EpisodeTitle
	} else {
		res.EpisodeTitle = fmt.Sprintf("Episodio %d", epNum)
	}
	res.SagaName = seriesTitle
	res.SagaID = "main"

	return res
}

func generateSyntheticTmdbID(title string) int {
	h := fnv.New32a()
	h.Write([]byte(strings.ToLower(strings.TrimSpace(title))))
	return 90000000 + int(h.Sum32()%9999999)
}

func ensureLibraryMedia(ctx context.Context, db *gorm.DB, resolved ResolvedDriveFile, mediaCache map[string]*models.LibraryMedia) (*models.LibraryMedia, error) {
	cacheKey := fmt.Sprintf("%s:%d:%s", resolved.MediaType, resolved.RawTmdbID, resolved.SeriesTitle)
	if m, ok := mediaCache[cacheKey]; ok {
		return m, nil
	}

	var media models.LibraryMedia
	err := db.WithContext(ctx).Where("tmdb_id = ? AND type = ?", resolved.RawTmdbID, resolved.MediaType).First(&media).Error
	if err != nil {
		err = db.WithContext(ctx).Where("tmdb_id = ?", resolved.RawTmdbID).First(&media).Error
	}
	if err != nil && resolved.RawTmdbID >= 90000000 {
		err = db.WithContext(ctx).Where("title_spanish = ? OR title_original = ? OR title_romaji = ?", resolved.SeriesTitle, resolved.SeriesTitle, resolved.SeriesTitle).First(&media).Error
	}
	if err == nil {
		mediaCache[cacheKey] = &media
		return &media, nil
	}

	// Create new LibraryMedia
	if resolved.RawTmdbID > 0 && resolved.RawTmdbID < 90000000 {
		lookupID := resolved.TargetMediaID
		pre := scanner.CreatePrehydratedDragonBallMedia(lookupID)
		media = models.LibraryMedia{
			Type:           resolved.MediaType,
			Format:         resolved.Format,
			Status:         "FINISHED",
			MetadataStatus: "COMPLETE",
			TmdbID:         resolved.RawTmdbID,
			TotalEpisodes:  1,
			Year:           2000,
		}
		if pre != nil {
			if pre.Title != nil {
				if pre.Title.Spanish != nil {
					media.TitleSpanish = *pre.Title.Spanish
				}
				if pre.Title.English != nil {
					media.TitleEnglish = *pre.Title.English
				}
				if pre.Title.Romaji != nil {
					media.TitleRomaji = *pre.Title.Romaji
				}
			}
			if pre.Description != nil {
				media.Description = *pre.Description
			}
			if pre.CoverImage != nil && pre.CoverImage.Large != nil {
				media.PosterImage = *pre.CoverImage.Large
			}
			if pre.BannerImage != nil {
				media.BannerImage = *pre.BannerImage
			}
			if pre.Year != nil {
				media.Year = *pre.Year
			}
			if pre.Episodes != nil {
				media.TotalEpisodes = *pre.Episodes
			}
			if pre.Format != nil {
				media.Format = string(*pre.Format)
			}
		}
		if media.TitleSpanish == "" {
			media.TitleSpanish = resolved.SeriesTitle
		}
		if media.TitleRomaji == "" {
			media.TitleRomaji = resolved.SeriesTitle
		}
	} else {
		// Non-Dragon Ball anime
		media = models.LibraryMedia{
			Type:           resolved.MediaType,
			Format:         resolved.Format,
			Status:         "FINISHED",
			MetadataStatus: "PENDING",
			TmdbID:         resolved.RawTmdbID,
			TitleRomaji:    resolved.SeriesTitle,
			TitleSpanish:   resolved.SeriesTitle,
			TitleEnglish:   resolved.SeriesTitle,
			TotalEpisodes:  1,
			Year:           time.Now().Year(),
		}
	}

	if err := db.WithContext(ctx).Create(&media).Error; err != nil {
		return nil, fmt.Errorf("failed to create LibraryMedia for %s: %w", resolved.SeriesTitle, err)
	}

	mediaCache[cacheKey] = &media
	return &media, nil
}

// IndexHooks lets callers observe IndexDriveFiles progress. Any field may be nil.
type IndexHooks struct {
	OnFile   func(done, total int, df DriveFile, resolved ResolvedDriveFile)
	OnSaving func(total int)
}

// IndexDriveFiles indexes video files discovered in Google Drive into KameHouse's database.
func IndexDriveFiles(ctx context.Context, db *gorm.DB, driveFiles []DriveFile, hooks IndexHooks) (int, error) {
	if len(driveFiles) == 0 {
		return 0, nil
	}

	mediaCache := make(map[string]*models.LibraryMedia)
	localFiles := make([]*models.LocalFile, 0, len(driveFiles))
	episodes := make([]*models.LibraryEpisode, 0, len(driveFiles))
	epDedup := make(map[string]bool)
	dbSeriesMediaIDs := make(map[uint]struct{})

	for idx, df := range driveFiles {
		resolved := ResolveDriveFile(df, idx+1)
		media, err := ensureLibraryMedia(ctx, db, resolved, mediaCache)
		if err != nil {
			return 0, err
		}
		if !resolved.IsMovie && resolved.RawTmdbID > 0 && resolved.RawTmdbID < 90000000 {
			dbSeriesMediaIDs[media.ID] = struct{}{}
		}
		if hooks.OnFile != nil {
			hooks.OnFile(idx+1, len(driveFiles), df, resolved)
		}

		path := DrivePath(df)

		fileHash := df.MD5Checksum
		if fileHash == "" {
			fileHash = util.CreateMD5(df.ID + ":" + df.Name)
		}

		meta := dto.LocalFileMetadata{
			Episodes: []int{resolved.EpisodeNumber},
			Episode:  resolved.EpisodeNumber,
			Type:     dto.LocalFileTypeMain,
		}
		metaBytes, _ := json.Marshal(meta)

		tech := &dto.FileTechnicalInfo{
			Size: df.Size,
		}
		if df.DurationMillis > 0 {
			tech.Duration = time.Duration(df.DurationMillis) * time.Millisecond
		}
		if df.Width > 0 && df.Height > 0 {
			tech.VideoStream = &dto.VideoStreamInfo{
				Codec:  "h264",
				Width:  df.Width,
				Height: df.Height,
			}
		}
		techBytes, _ := json.Marshal(tech)

		parsed := &dto.LocalFileParsedData{
			Original: df.Name,
			Title:    resolved.SeriesTitle,
			Episode:  strconv.Itoa(resolved.EpisodeNumber),
			Season:   strconv.Itoa(resolved.SeasonNumber),
		}
		parsedBytes, _ := json.Marshal(parsed)

		lf := &models.LocalFile{
			Path:           path,
			Name:           df.Name,
			FileHash:       fileHash,
			FileSize:       df.Size,
			FileModTime:    df.ModifiedTime.Unix(),
			MediaID:        resolved.TargetMediaID,
			LibraryMediaId: media.ID,
			DriveFileID:    df.ID,
			Metadata:       metaBytes,
			TechnicalInfo:  techBytes,
			ParsedData:     parsedBytes,
		}
		localFiles = append(localFiles, lf)

		epKey := fmt.Sprintf("%d:%d:%d", media.ID, resolved.SeasonNumber, resolved.EpisodeNumber)
		if !epDedup[epKey] {
			epDedup[epKey] = true
			ep := &models.LibraryEpisode{
				LibraryMediaID: media.ID,
				EpisodeNumber:  resolved.EpisodeNumber,
				AbsoluteNumber: resolved.AbsoluteNumber,
				SeasonNumber:   resolved.SeasonNumber,
				Type:           resolved.EpisodeType,
				Title:          resolved.EpisodeTitle,
				SagaName:       resolved.SagaName,
				SagaId:         resolved.SagaID,
			}
			episodes = append(episodes, ep)
		}
	}

	if hooks.OnSaving != nil {
		hooks.OnSaving(len(localFiles))
	}

	// Batch upsert LocalFiles
	if err := db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "path"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"name", "file_hash", "file_size", "file_mod_time", "media_id",
			"library_media_id", "drive_file_id", "metadata", "technical_info",
			"parsed_data", "updated_at",
		}),
	}).CreateInBatches(localFiles, 50).Error; err != nil {
		return 0, fmt.Errorf("failed to upsert local_file records for Drive files: %w", err)
	}

	// Batch upsert LibraryEpisodes
	if len(episodes) > 0 {
		if err := db.WithContext(ctx).Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "library_media_id"},
				{Name: "episode_number"},
				{Name: "season_number"},
			},
			DoUpdates: clause.AssignmentColumns([]string{
				"absolute_number", "title", "saga_name", "saga_id", "type", "updated_at",
			}),
		}).CreateInBatches(episodes, 50).Error; err != nil {
			return 0, fmt.Errorf("failed to upsert library_episode records for Drive files: %w", err)
		}
	}

	// Versiones anteriores guardaban las series de Dragon Ball con la saga como
	// temporada (2..N); esas filas duplican los episodios de la temporada 1.
	if len(dbSeriesMediaIDs) > 0 {
		ids := make([]uint, 0, len(dbSeriesMediaIDs))
		for id := range dbSeriesMediaIDs {
			ids = append(ids, id)
		}
		if err := db.WithContext(ctx).
			Where("library_media_id IN ? AND season_number > 1", ids).
			Delete(&models.LibraryEpisode{}).Error; err != nil {
			return 0, fmt.Errorf("failed to clean legacy saga-season episodes: %w", err)
		}
	}

	return len(localFiles), nil
}

// DrivePath builds the local_file path used for an indexed Drive file.
func DrivePath(df DriveFile) string {
	return fmt.Sprintf("gdrive://%s/%s", df.ID, df.RelativePath)
}

// PruneDriveFiles deletes indexed Drive files whose path is not in the current listing.
// Pruning by path (not file ID) also removes stale rows left behind when a file was
// renamed or moved inside Drive. Callers must only pass a complete listing.
func PruneDriveFiles(ctx context.Context, db *gorm.DB, current []DriveFile) (int, error) {
	keep := make(map[string]struct{}, len(current))
	for _, df := range current {
		keep[strings.ToLower(DrivePath(df))] = struct{}{} // path column is COLLATE NOCASE
	}

	var rows []struct {
		ID   uint
		Path string
	}
	if err := db.WithContext(ctx).Model(&models.LocalFile{}).
		Select("id", "path").
		Where("path LIKE 'gdrive://%'").
		Find(&rows).Error; err != nil {
		return 0, fmt.Errorf("failed to load indexed Drive files: %w", err)
	}

	stale := make([]uint, 0)
	for _, r := range rows {
		if _, ok := keep[strings.ToLower(r.Path)]; !ok {
			stale = append(stale, r.ID)
		}
	}

	for i := 0; i < len(stale); i += 500 {
		end := min(i+500, len(stale))
		if err := db.WithContext(ctx).Where("id IN ?", stale[i:end]).Delete(&models.LocalFile{}).Error; err != nil {
			return i, fmt.Errorf("failed to prune stale Drive files: %w", err)
		}
	}
	return len(stale), nil
}
