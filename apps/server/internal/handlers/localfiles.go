package handlers

import (
	"strconv"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"

	"github.com/labstack/echo/v4"
)

// HandleGetLocalFiles returns all local files.
//
//	@summary returns all local files.
//	@desc Reminder that local files are scanned from the library path.
//	@route /api/v1/library/local-files [GET]
//	@returns []dto.LocalFile
func (h *Handler) HandleGetLocalFiles(c echo.Context) error {
	pageStr := c.QueryParam("page")
	perPageStr := c.QueryParam("perPage")

	// Paginado por defecto para no cargar toda la tabla en memoria (OOM).
	page := 1
	perPage := 50
	if pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p >= 1 {
			page = p
		}
	}
	if perPageStr != "" {
		if pp, err := strconv.Atoi(perPageStr); err == nil && pp >= 1 {
			perPage = pp
		}
	}
	if perPage > 200 {
		perPage = 200
	}

	{
		offset := (page - 1) * perPage

		var total int64
		if err := h.App.Database.Gorm().Model(&models.LocalFile{}).Count(&total).Error; err != nil {
			return h.RespondWithError(c, err)
		}

		var dbFiles []*models.LocalFile
		if err := h.App.Database.Gorm().
			Order("id asc").
			Offset(offset).
			Limit(perPage).
			Find(&dbFiles).Error; err != nil {
			return h.RespondWithError(c, err)
		}

		items := make([]*dto.LocalFile, len(dbFiles))
		for i, dbf := range dbFiles {
			conv, err := db.LocalFileModelToDto(dbf)
			if err != nil {
				h.App.Logger.Warn().Err(err).Str("path", dbf.Path).Msg("handlers: Skipping corrupt JSON fields in local file row")
				conv = &dto.LocalFile{Path: dbf.Path, Name: dbf.Name}
			}
			items[i] = conv
		}

		hasMore := int64(offset+len(items)) < total
		nextPage := 0
		if hasMore {
			nextPage = page + 1
		}

		// Compat: si el cliente pidió explícitamente sin paginar vía ?page=all, devolver todo.
		// Por defecto (y sin ?page) se devuelve la primera página paginada.
		if pageStr == "all" {
			lfs, _, err := db.GetLocalFiles(h.App.Database)
			if err != nil {
				return h.RespondWithError(c, err)
			}
			return h.RespondWithData(c, lfs)
		}

		return h.RespondWithData(c, map[string]interface{}{
			"items":    items,
			"hasMore":  hasMore,
			"nextPage": nextPage,
			"total":    total,
		})
	}
}
