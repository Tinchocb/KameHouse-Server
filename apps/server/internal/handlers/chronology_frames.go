package handlers

import (
	"errors"
	"net/http"
	"strconv"

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
			"path":        libEpisode.Image,
			"hasImage":    true,
			"absoluteEpisode": libEpisode.AbsoluteNumber,
			"title":       libEpisode.Title,
			"sagaName":    libEpisode.SagaName,
		})
	}

	// 4. Find LocalFile for this media + episode
	// Try ParsedData.Episode first, then Metadata.Episodes array.
	// Nota: local_files.media_id es el ID interno (LibraryMedia.ID), no el
	// TMDB externo; y se usa json_each (JSON1 de SQLite) porque JSON_CONTAINS
	// no existe en SQLite.
	var localFile models.LocalFile
	// Use raw SQL for flexible matching on parsed/metadata
	query := h.App.Database.Gorm().
		Table("local_files").
		Where("media_id = ?", libMedia.ID).
		Where(
			"(JSON_EXTRACT(parsed_data, '$.episode') = ? OR EXISTS (SELECT 1 FROM json_each(\"metadata\", '$.episodes') WHERE CAST(value AS INTEGER) = ?))",
			absoluteEpisode, absoluteEpisode,
		).
		Limit(1)

	if err := query.First(&localFile).Error; err != nil {
		return h.RespondWithCodeError(c, http.StatusNotFound, errors.New("local file not found for episode"))
	}

	// 5. Return path for video-thumbnail endpoint
	return h.RespondWithData(c, map[string]interface{}{
		"path":             localFile.Path,
		"hasImage":         false,
		"absoluteEpisode":  absoluteEpisode,
		"title":            libEpisode.Title,
		"sagaName":         libEpisode.SagaName,
	})
}