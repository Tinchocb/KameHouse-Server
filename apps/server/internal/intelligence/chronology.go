package intelligence

import (
	"sort"
	"strings"

	"kamehouse/internal/continuity"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
)

// ChronologySeriesTmdbIDs son las series de Dragon Ball cuyo avance por episodio
// alimenta la cronología (Clásico, Z, Daima, Super, GT). Los rangos de cada
// lapso viven solo en el frontend (dragonball_story_spans.json): el servidor
// informa qué episodios se vieron y el cliente los reparte entre lapsos.
var ChronologySeriesTmdbIDs = []int{12609, 12971, 236994, 62715, 12697}

// ChronologySeriesProgress es el avance real de una serie.
type ChronologySeriesProgress struct {
	TmdbID int `json:"tmdbId"`
	// Completed: la serie está marcada COMPLETED en la lista.
	Completed bool `json:"completed"`
	// WatchedEpisodes: episodios (numeración absoluta) vistos al menos al 90 %
	// o cubiertos por el progreso de la lista, ordenados.
	WatchedEpisodes []int `json:"watchedEpisodes"`
}

// ChronologyProgressResponse es el avance de la cronología para la cuenta actual.
type ChronologyProgressResponse struct {
	Series []*ChronologySeriesProgress `json:"series"`
	// Overrides: marcas manuales spanId -> visto, que pisan el avance calculado.
	Overrides map[string]bool `json:"overrides"`
}

// BuildChronologyProgress junta historial de reproducción, lista y marcas manuales.
func BuildChronologyProgress(database *db.Database, accountID uint) (*ChronologyProgressResponse, error) {
	resp := &ChronologyProgressResponse{
		Series:    make([]*ChronologySeriesProgress, 0, len(ChronologySeriesTmdbIDs)),
		Overrides: map[string]bool{},
	}
	if database == nil {
		return resp, nil
	}

	var libraryMedia []*models.LibraryMedia
	if err := database.Gorm().Where("tmdb_id IN ?", ChronologySeriesTmdbIDs).Find(&libraryMedia).Error; err != nil {
		return nil, err
	}

	// El historial guarda el id de media del reproductor, que según el origen es
	// el TMDB id o el id de biblioteca: se aceptan ambos para cada serie.
	tmdbByMediaID := make(map[int]int)
	tmdbByLibraryID := make(map[uint]int)
	libraryIDs := make([]uint, 0, len(libraryMedia))
	for _, tmdbID := range ChronologySeriesTmdbIDs {
		tmdbByMediaID[tmdbID] = tmdbID
	}
	for _, lm := range libraryMedia {
		tmdbByMediaID[int(lm.ID)] = lm.TmdbID
		tmdbByLibraryID[lm.ID] = lm.TmdbID
		libraryIDs = append(libraryIDs, lm.ID)
	}

	watched := make(map[int]map[int]bool, len(ChronologySeriesTmdbIDs))
	completed := make(map[int]bool)
	for _, tmdbID := range ChronologySeriesTmdbIDs {
		watched[tmdbID] = map[int]bool{}
	}

	if len(libraryIDs) > 0 {
		var listData []*models.MediaEntryListData
		if err := database.Gorm().Where("library_media_id IN ?", libraryIDs).Find(&listData).Error; err != nil {
			return nil, err
		}
		for _, ld := range listData {
			tmdbID := tmdbByLibraryID[ld.LibraryMediaID]
			if strings.EqualFold(ld.Status, "COMPLETED") {
				completed[tmdbID] = true
			}
			for ep := 1; ep <= ld.Progress; ep++ {
				watched[tmdbID][ep] = true
			}
		}
	}

	mediaIDs := make([]int, 0, len(tmdbByMediaID))
	for id := range tmdbByMediaID {
		mediaIDs = append(mediaIDs, id)
	}
	var history []*models.WatchHistory
	// account_id 0: filas anteriores a la separación por cuenta.
	if err := database.Gorm().
		Where("media_id IN ? AND account_id IN ?", mediaIDs, []uint{accountID, 0}).
		Find(&history).Error; err != nil {
		return nil, err
	}
	for _, wh := range history {
		if wh.EpisodeNumber <= 0 || wh.Duration <= 0 || wh.CurrentTime/wh.Duration < continuity.IgnoreRatioThreshold {
			continue
		}
		watched[tmdbByMediaID[wh.MediaID]][wh.EpisodeNumber] = true
	}

	for _, tmdbID := range ChronologySeriesTmdbIDs {
		eps := make([]int, 0, len(watched[tmdbID]))
		for ep := range watched[tmdbID] {
			eps = append(eps, ep)
		}
		sort.Ints(eps)
		resp.Series = append(resp.Series, &ChronologySeriesProgress{
			TmdbID:          tmdbID,
			Completed:       completed[tmdbID],
			WatchedEpisodes: eps,
		})
	}

	overrides, err := database.GetChronologySpanOverrides(accountID)
	if err != nil {
		return nil, err
	}
	resp.Overrides = overrides

	return resp, nil
}
