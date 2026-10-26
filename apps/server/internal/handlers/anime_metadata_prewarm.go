package handlers

import (
	"errors"
	"time"

	"kamehouse/internal/api/jikan"
	"kamehouse/internal/database/models"
)

// prewarmAnimeMetadata pide a Jikan la ficha de cada título de la biblioteca, de a uno y con
// una pausa, para que quede en la caché persistente (7 días). Sin esto, abrir una ficha que
// todavía no se consultó esperaba hasta jikanInlineWait (1,5 s) y, al reiniciar el servidor,
// volvía a esperar: la ficha tardaba 1,5–3,5 s en frío y ~15 ms en caliente.
//
// Corre de fondo, después de `delay`, igual que prewarmShelfImages, y deja libre el limitador
// de Jikan entre consultas para que las aperturas del usuario no queden detrás.
func (h *Handler) prewarmAnimeMetadata(delay time.Duration) {
	if h.App == nil || h.App.Database == nil || h.App.Metadata.Provider == nil {
		return
	}
	go func() {
		defer func() {
			if r := recover(); r != nil {
				h.App.Logger.Error().Interface("panic", r).Msg("anime: panic prewarming anime metadata")
			}
		}()
		if delay > 0 {
			time.Sleep(delay)
		}

		var media []models.LibraryMedia
		if err := h.App.Database.Gorm().Select("tmdb_id", "type").Where("tmdb_id > 0").Find(&media).Error; err != nil {
			return
		}

		start := time.Now()
		done := 0
		for _, m := range media {
			mediaID := canonicalAnimeMediaID(m)
			if mediaID <= 0 {
				continue
			}
			// El error (título sin ficha en Jikan) se ignora: los fallos se reintentan cuando la
			// ficha se abre. Si Jikan no es alcanzable, no tiene sentido seguir con la lista.
			_, err := h.App.Metadata.Provider.GetAnimeMetadata(mediaID)
			if err == nil {
				done++
			} else if errors.Is(err, jikan.ErrUnavailable) {
				h.App.Logger.Warn().Err(err).Msg("anime: Jikan no responde, se suspende la precarga de fichas")
				break
			}
			time.Sleep(animeMetadataPrewarmPause)
		}
		h.App.Logger.Info().
			Int("titles", len(media)).
			Int("fetched", done).
			Dur("elapsed", time.Since(start)).
			Msg("anime: Metadata de fichas precargada")
	}()
}

// animeMetadataPrewarmPause separa cada consulta a Jikan (su limitador permite ~1 por segundo).
const animeMetadataPrewarmPause = 1100 * time.Millisecond

// canonicalAnimeMediaID es el mediaId con el que la biblioteca identifica cada título: el TMDB
// para series y TMDB+1.000.000 para películas (mismo criterio que collection_hydrate.go).
func canonicalAnimeMediaID(m models.LibraryMedia) int {
	if m.TmdbID <= 0 {
		return 0
	}
	if m.Type == "MOVIE" {
		return m.TmdbID + 1_000_000
	}
	return m.TmdbID
}
