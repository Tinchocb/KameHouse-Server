package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"kamehouse/internal/database/models"

	"github.com/labstack/echo/v4"
)

// HandleGetLibraryEpisodeFile resolves the local file path for a given TMDB ID + absolute episode.
// Used by chronology UI to fetch local frame via /api/v1/video-thumbnail?path=.
//
//	@summary get local episode file for chronology thumbnail
//	@desc Resolves TMDB ID + absolute episode to a library media, then finds the matching episode file.
//	@route /api/v1/library/episode-file [GET]
func (h *Handler) HandleGetLibraryEpisodeFile(c echo.Context) error {
	tmdbIDStr := c.QueryParam("tmdbId")
	if tmdbIDStr == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("tmdbId is required"))
	}
	tmdbID, err := strconv.Atoi(tmdbIDStr)
	if err != nil || tmdbID <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive tmdbId is required"))
	}

	absoluteStr := c.QueryParam("absoluteEpisode")
	if absoluteStr == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("absoluteEpisode is required"))
	}
	absoluteEpisode, err := strconv.Atoi(absoluteStr)
	if err != nil || absoluteEpisode <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive absoluteEpisode is required"))
	}

	// 1. Find LibraryMedia by TMDB ID (type ANIME or SHOW)
	var libMedia models.LibraryMedia
	if err := h.App.Database.Gorm().
		Where("tmdb_id = ? AND type IN (?, ?)", tmdbID, "ANIME", "SHOW").
		First(&libMedia).Error; err != nil {
		return h.RespondWithCodeError(c, http.StatusNotFound, errors.New("series not found in library"))
	}

	// 2. Find LibraryEpisode by LibraryMediaID + AbsoluteNumber
	var libEpisode models.LibraryEpisode
	if err := h.App.Database.Gorm().
		Where("library_media_id = ? AND absolute_number = ?", libMedia.ID, absoluteEpisode).
		First(&libEpisode).Error; err != nil {
		return h.RespondWithCodeError(c, http.StatusNotFound, errors.New("episode not found in library"))
	}

	// 3. If LibraryEpisode has an extracted image, return it directly
	if libEpisode.Image != "" {
		return h.RespondWithData(c, map[string]interface{}{
			"path":            libEpisode.Image,
			"hasImage":        true,
			"absoluteEpisode": libEpisode.AbsoluteNumber,
			"title":           libEpisode.Title,
			"sagaName":        libEpisode.SagaName,
		})
	}

	// 4. Find LocalFile for this media + episode
	// Try ParsedData.Episode first, then Metadata.Episodes array.
	// Nota: la tabla es local_file (LocalFile.TableName) y el ID interno de la
	// serie va en library_media_id (media_id guarda el TMDB externo); se usa
	// json_each (JSON1 de SQLite) porque JSON_CONTAINS no existe en SQLite.
	var localFile models.LocalFile
	// Use raw SQL for flexible matching on parsed/metadata
	query := h.App.Database.Gorm().
		Table("local_file").
		Where("library_media_id = ?", libMedia.ID).
		Where(
			"(CAST(JSON_EXTRACT(parsed_data, '$.episode') AS INTEGER) = ? OR EXISTS (SELECT 1 FROM json_each(\"metadata\", '$.episodes') WHERE CAST(value AS INTEGER) = ?))",
			absoluteEpisode, absoluteEpisode,
		).
		Limit(1)

	if err := query.First(&localFile).Error; err != nil {
		return h.RespondWithCodeError(c, http.StatusNotFound, errors.New("local file not found for episode"))
	}

	// 5. Return path for video-thumbnail endpoint. fileModTime/fileSize let the client
	// build a versioned (?v=) URL that can be cached as immutable.
	return h.RespondWithData(c, map[string]interface{}{
		"path":            localFile.Path,
		"hasImage":        false,
		"absoluteEpisode": absoluteEpisode,
		"title":           libEpisode.Title,
		"sagaName":        libEpisode.SagaName,
		"fileModTime":     localFile.FileModTime,
		"fileSize":        localFile.FileSize,
	})
}

// ChronologyEpisodeFile is one episode of the batch response: the same fields as
// HandleGetLibraryEpisodeFile, plus the TMDB ID it belongs to.
type ChronologyEpisodeFile struct {
	TmdbID          int    `json:"tmdbId"`
	AbsoluteEpisode int    `json:"absoluteEpisode"`
	Path            string `json:"path"`
	HasImage        bool   `json:"hasImage"`
	Title           string `json:"title,omitempty"`
	SagaName        string `json:"sagaName,omitempty"`
	FileModTime     int64  `json:"fileModTime,omitempty"`
	FileSize        int64  `json:"fileSize,omitempty"`
}

// HandleGetChronologyEpisodeFiles resolves every library episode of the given TMDB series in one call.
// The chronology used to ask /library/episode-file once per moment thumbnail (hundreds of requests on open).
//
//	@summary get local episode files for all chronology thumbnails
//	@desc Same resolution as /library/episode-file, for every episode of the given TMDB IDs (comma separated). Episodes without image or local file are omitted.
//	@route /api/v1/library/chronology-episode-files [GET]
//	@returns []handlers.ChronologyEpisodeFile
func (h *Handler) HandleGetChronologyEpisodeFiles(c echo.Context) error {
	var tmdbIDs []int
	for _, raw := range strings.Split(c.QueryParam("tmdbIds"), ",") {
		id, err := strconv.Atoi(strings.TrimSpace(raw))
		if err == nil && id > 0 {
			tmdbIDs = append(tmdbIDs, id)
		}
	}
	if len(tmdbIDs) == 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("tmdbIds is required"))
	}

	db := h.App.Database.Gorm()
	var medias []models.LibraryMedia
	if err := db.Where("tmdb_id IN ? AND type IN (?, ?)", tmdbIDs, "ANIME", "SHOW").Order("id").Find(&medias).Error; err != nil {
		return h.RespondWithError(c, err)
	}

	out := make([]ChronologyEpisodeFile, 0, 512)
	seenTmdb := make(map[int]bool, len(medias))
	for _, media := range medias {
		// Como First() en el endpoint individual: la primera serie de cada TMDB ID.
		if seenTmdb[media.TmdbID] {
			continue
		}
		seenTmdb[media.TmdbID] = true

		var episodes []models.LibraryEpisode
		if err := db.Where("library_media_id = ? AND absolute_number > 0", media.ID).Find(&episodes).Error; err != nil {
			return h.RespondWithError(c, err)
		}
		if len(episodes) == 0 {
			continue
		}

		// Archivo por episodio absoluto: primero parsed_data.episode, después metadata.episodes.
		type fileRow struct {
			Path        string
			FileModTime int64
			FileSize    int64
			Episode     int
			Priority    int
		}
		var rows []fileRow
		if err := db.Raw(`
			SELECT path, file_mod_time, file_size, CAST(JSON_EXTRACT(parsed_data, '$.episode') AS INTEGER) AS episode, 0 AS priority
			FROM local_file WHERE library_media_id = ? AND JSON_EXTRACT(parsed_data, '$.episode') IS NOT NULL
			UNION ALL
			SELECT lf.path, lf.file_mod_time, lf.file_size, CAST(je.value AS INTEGER) AS episode, 1 AS priority
			FROM local_file lf, json_each(lf."metadata", '$.episodes') je
			WHERE lf.library_media_id = ? AND json_valid(lf."metadata")`,
			media.ID, media.ID,
		).Scan(&rows).Error; err != nil {
			return h.RespondWithError(c, err)
		}
		fileByEpisode := make(map[int]fileRow, len(rows))
		for _, r := range rows {
			if r.Episode <= 0 {
				continue
			}
			if prev, ok := fileByEpisode[r.Episode]; !ok || r.Priority < prev.Priority {
				fileByEpisode[r.Episode] = r
			}
		}

		for _, ep := range episodes {
			entry := ChronologyEpisodeFile{
				TmdbID:          media.TmdbID,
				AbsoluteEpisode: ep.AbsoluteNumber,
				Title:           ep.Title,
				SagaName:        ep.SagaName,
			}
			if ep.Image != "" {
				entry.Path = ep.Image
				entry.HasImage = true
			} else if f, ok := fileByEpisode[ep.AbsoluteNumber]; ok {
				entry.Path = f.Path
				entry.FileModTime = f.FileModTime
				entry.FileSize = f.FileSize
			} else {
				continue
			}
			out = append(out, entry)
		}
	}

	return h.RespondWithData(c, out)
}
