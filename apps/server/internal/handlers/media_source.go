package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"

	"github.com/labstack/echo/v4"
)

// Orígenes de reproducción
//
// Dos niveles, en este orden de prioridad:
//  1. Global (Ajustes > Biblioteca): disco local desconectado
//     (library.disableLocalScanning) y Google Drive pausado
//     (library.disableCloudSource). Un origen apagado se oculta en toda la app.
//  2. Por serie (MediaSourcePreference): "local" o "cloud" muestran solo ese
//     origen para la serie. Si el origen elegido está apagado globalmente, la
//     serie vuelve a automático en vez de quedar vacía.
//
// Todo es filtro de vista: las filas siguen en la base y vuelven al cambiar la
// preferencia.

func isCloudFile(lf *dto.LocalFile) bool {
	return strings.HasPrefix(lf.Path, "gdrive://")
}

// sourceRules es la configuración de orígenes vigente.
type sourceRules struct {
	localEnabled bool
	cloudEnabled bool
	prefs        map[int]string // mediaID -> "local" | "cloud"
}

func (h *Handler) currentSourceRules() sourceRules {
	r := sourceRules{localEnabled: true, cloudEnabled: true}
	if s, err := h.App.Database.GetSettings(); err == nil && s != nil {
		r.localEnabled = !s.Library.DisableLocalScanning
		r.cloudEnabled = !s.Library.DisableCloudSource
	}
	r.prefs, _ = h.App.Database.GetMediaSourcePreferences()
	return r
}

// effective devuelve el origen que realmente aplica a la serie.
func (r sourceRules) effective(mediaID int) string {
	switch r.prefs[mediaID] {
	case db.MediaSourceLocal:
		if r.localEnabled {
			return db.MediaSourceLocal
		}
	case db.MediaSourceCloud:
		if r.cloudEnabled {
			return db.MediaSourceCloud
		}
	}
	return db.MediaSourceAuto
}

func (r sourceRules) allows(lf *dto.LocalFile) bool {
	cloud := isCloudFile(lf)
	if cloud && !r.cloudEnabled || !cloud && !r.localEnabled {
		return false
	}
	switch r.effective(lf.MediaID) {
	case db.MediaSourceLocal:
		return !cloud
	case db.MediaSourceCloud:
		return cloud
	}
	return true
}

func (r sourceRules) filter(lfs []*dto.LocalFile) []*dto.LocalFile {
	if r.localEnabled && r.cloudEnabled && len(r.prefs) == 0 {
		return lfs
	}
	out := make([]*dto.LocalFile, 0, len(lfs))
	for _, lf := range lfs {
		if lf != nil && r.allows(lf) {
			out = append(out, lf)
		}
	}
	return out
}

// localDiskDisconnected indica si el usuario desconectó el disco local
// (library.disableLocalScanning): no se escanea ni se vigila el disco.
func (h *Handler) localDiskDisconnected() bool {
	s, err := h.App.Database.GetSettings()
	return err == nil && s != nil && s.Library.DisableLocalScanning
}

// visibleLocalFiles aplica los orígenes globales y por serie a una lista de
// archivos. Solo filtra la vista: no usar el resultado para escribir con
// InsertLocalFiles, que borra lo que no recibe.
func (h *Handler) visibleLocalFiles(lfs []*dto.LocalFile) []*dto.LocalFile {
	return h.currentSourceRules().filter(lfs)
}

// MediaSourceInfo describe los orígenes disponibles de una serie y cuál aplica.
type MediaSourceInfo struct {
	MediaID int `json:"mediaId"`
	// Preference es lo que eligió el usuario: "auto" | "local" | "cloud".
	Preference string `json:"preference"`
	// Effective es lo que aplica tras los interruptores globales.
	Effective    string `json:"effective"`
	LocalFiles   int    `json:"localFiles"`
	CloudFiles   int    `json:"cloudFiles"`
	LocalEnabled bool   `json:"localEnabled"`
	CloudEnabled bool   `json:"cloudEnabled"`
}

func (h *Handler) mediaSourceInfo(mediaID int) (*MediaSourceInfo, error) {
	lfs, err := db.GetLocalFilesByMediaID(h.App.Database, mediaID)
	if err != nil {
		return nil, err
	}
	r := h.currentSourceRules()
	info := &MediaSourceInfo{
		MediaID:      mediaID,
		Preference:   db.MediaSourceAuto,
		Effective:    r.effective(mediaID),
		LocalEnabled: r.localEnabled,
		CloudEnabled: r.cloudEnabled,
	}
	if p, ok := r.prefs[mediaID]; ok {
		info.Preference = p
	}
	for _, lf := range lfs {
		if lf == nil {
			continue
		}
		if isCloudFile(lf) {
			info.CloudFiles++
		} else {
			info.LocalFiles++
		}
	}
	return info, nil
}

// HandleGetAnimeEntrySource returns the playback source settings of a series.
//
//	@summary returns the playback source of a series.
//	@desc Includes how many files the series has in each source and which one applies.
//	@route /api/v1/library/anime-entry/{id}/source [GET]
//	@param id - int - true - "Anime media ID"
//	@returns handlers.MediaSourceInfo
func (h *Handler) HandleGetAnimeEntrySource(c echo.Context) error {
	mID, err := strconv.Atoi(c.Param("id"))
	if err != nil || mID <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive anime media id is required"))
	}
	info, err := h.mediaSourceInfo(mID)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, info)
}

// HandleSetAnimeEntrySource sets the playback source of a series.
//
//	@summary sets the playback source of a series.
//	@desc "auto" plays local first and falls back to the cloud; "local" and "cloud" show only that source.
//	@route /api/v1/library/anime-entry/source [POST]
//	@returns handlers.MediaSourceInfo
func (h *Handler) HandleSetAnimeEntrySource(c echo.Context) error {
	type body struct {
		MediaID int    `json:"mediaId"`
		Source  string `json:"source"`
	}
	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}
	if b.MediaID <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive anime media id is required"))
	}
	if !db.IsValidMediaSource(b.Source) {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("source must be 'auto', 'local' or 'cloud'"))
	}
	if err := h.App.Database.SetMediaSourcePreference(b.MediaID, b.Source); err != nil {
		return h.RespondWithError(c, err)
	}
	info, err := h.mediaSourceInfo(b.MediaID)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, info)
}
