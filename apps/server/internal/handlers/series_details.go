package handlers

import (
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/lore"
	"strconv"

	"github.com/labstack/echo/v4"
)

// HandleGetSeriesSagas returns fully enriched sagas for a given media entry,
// combining lore wiki data with saga display info (images, sub-sagas).
//
//	@summary returns enriched saga array for a media entry.
//	@route /api/v1/library/anime-entry/{id}/sagas [GET]
//	@param id - int - true - "Anime media ID"
//	@returns []dto.SagaDTO
func (h *Handler) HandleGetSeriesSagas(c echo.Context) error {
	idParam := c.Param("id")
	mID, err := strconv.Atoi(idParam)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	lfs, err := db.GetLocalFilesByMediaID(h.App.Database, mID)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	entry, err := h.getAnimeEntry(c, lfs, mID)
	if err != nil || entry == nil || entry.Media == nil {
		return h.RespondWithError(c, err)
	}

	tmdbID := entry.Media.TmdbID
	seriesID := lore.GetSeriesIDFromTMDB(tmdbID)
	if seriesID == "" || tmdbID == 0 {
		return h.RespondWithData(c, []dto.SagaDTO{})
	}

	l := lore.GetLore()

	var wikiSeries *lore.SeriesSagas
	if l != nil {
		for _, ws := range l.SagasWiki {
			if ws.SeriesID == seriesID {
				wikiSeries = &ws
				break
			}
		}
	}

	allChars := make([]dto.CharacterDTO, 0)
	if entry.Media.Characters != nil {
		for _, edge := range entry.Media.Characters.Edges {
			if edge != nil && edge.Node != nil && edge.Node.Image != nil && edge.Node.Image.Large != "" {
				roleTag := dto.RoleSupporting
				if edge.Role == "MAIN" {
					roleTag = dto.RoleProtagonist
				}
				allChars = append(allChars, dto.CharacterDTO{
					Name:      edge.Node.Name.Full,
					RoleTag:   roleTag,
					AvatarURL: edge.Node.Image.Large,
				})
			}
		}
	}
	if len(allChars) > 15 {
		allChars = allChars[:15]
	}

	sagaRanges := lore.GetSagaRanges(tmdbID)
	if sagaRanges == nil {
		return h.RespondWithData(c, []dto.SagaDTO{})
	}

	sagas := make([]dto.SagaDTO, 0, len(sagaRanges))
	for _, sr := range sagaRanges {
		isFiller := false
		canonStatus := "true"
		description := sr.Title
		var antagonists, keyEvents, newCharacters []string

		if wikiSeries != nil {
			for _, ws := range wikiSeries.Sagas {
				wsStart, wsEnd := lore.ParseEpRange(ws.Episodes)
				if wsStart == sr.StartEp && wsEnd == sr.EndEp {
					if ws.Description != "" {
						description = ws.Description
					}
					antagonists = ws.Antagonists
					keyEvents = ws.KeyEvents
					newCharacters = ws.NewCharacters
					canonStatus = formatCanonStatus(ws.Canon)
					isFiller = ws.IsFiller || canonStatus == "false" || canonStatus == "Relleno"
					break
				}
			}
		}

		dsp := lore.GetSagaDisplay(seriesID, sr.ID)
		var subSagas []dto.SubSagaDTO
		if dsp != nil && len(dsp.SubSagas) > 0 {
			subSagas = make([]dto.SubSagaDTO, 0, len(dsp.SubSagas))
			for _, ss := range dsp.SubSagas {
				subSagas = append(subSagas, dto.SubSagaDTO{
					ID:           ss.ID,
					Name:         ss.Title,
					EpisodeRange: strconv.Itoa(ss.StartEp) + "-" + strconv.Itoa(ss.EndEp),
					StartEp:      ss.StartEp,
					EndEp:        ss.EndEp,
				})
			}
		}

		sagas = append(sagas, dto.SagaDTO{
			ID:            sr.ID,
			Name:          sr.Title,
			EpisodeRange:  strconv.Itoa(sr.StartEp) + "-" + strconv.Itoa(sr.EndEp),
			StartEp:       sr.StartEp,
			EndEp:         sr.EndEp,
			Description:   description,
			IsFiller:      isFiller,
			CanonStatus:   canonStatus,
			Antagonists:   antagonists,
			KeyEvents:     keyEvents,
			NewCharacters: newCharacters,
			KeyCharacters: allChars,
			SubSagas:      subSagas,
		})
	}

	return h.RespondWithData(c, sagas)
}

func formatCanonStatus(canon interface{}) string {
	if canon == nil {
		return "true"
	}
	switch v := canon.(type) {
	case bool:
		if v {
			return "true"
		}
		return "false"
	case string:
		return v
	default:
		return "true"
	}
}
