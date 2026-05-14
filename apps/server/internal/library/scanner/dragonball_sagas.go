package scanner

import (
	"context"
)

// GetDragonBallSagas returns the saga/volume grouping for a given Dragon Ball TMDB ID.
func GetDragonBallSagas(tmdbID int) []sagaResolution {
	switch tmdbID {
	case 12609: // Dragon Ball
		return []sagaResolution{
			{id: "pilaf", name: "Saga de Pilaf", startEp: 1, endEp: 13},
			{id: "torneo-21", name: "21º Torneo de Artes Marciales", startEp: 14, endEp: 28},
			{id: "red-ribbon", name: "Saga de la Patrulla Roja", startEp: 29, endEp: 68},
			{id: "uranai-baba", name: "Saga de la Abuela Baba", startEp: 69, endEp: 82},
			{id: "torneo-22", name: "22º Torneo de Artes Marciales", startEp: 83, endEp: 101},
			{id: "piccolo", name: "Saga de Piccolo Daimaoh", startEp: 102, endEp: 122},
			{id: "piccolo-jr", name: "Saga de Piccolo Jr.", startEp: 123, endEp: 153},
		}
	case 12971: // Dragon Ball Z
		return []sagaResolution{
			{id: "saiyajin", name: "Saga de los Saiyajin", startEp: 1, endEp: 35},
			{id: "freezer", name: "Saga de Freezer", startEp: 36, endEp: 107},
			{id: "garlic-jr", name: "Saga de Garlic Jr.", startEp: 108, endEp: 117},
			{id: "androides", name: "Saga de los Androides", startEp: 118, endEp: 139},
			{id: "cell", name: "Saga de Cell", startEp: 140, endEp: 194},
			{id: "torneo-otro-mundo", name: "Torneo del Otro Mundo", startEp: 195, endEp: 199},
			{id: "majin-buu", name: "Saga de Majin Buu", startEp: 200, endEp: 291},
		}
	case 12697: // Dragon Ball GT
		return []sagaResolution{
			{id: "black-star", name: "Saga de las Esferas del Dragón Definitivas", startEp: 1, endEp: 16},
			{id: "baby", name: "Saga de Baby", startEp: 17, endEp: 40},
			{id: "super-17", name: "Saga de Super-17", startEp: 41, endEp: 47},
			{id: "shadow-dragons", name: "Saga de los Dragones Malignos", startEp: 48, endEp: 64},
		}
	case 62715: // Dragon Ball Super
		return []sagaResolution{
			{id: "batalla-dioses", name: "Saga de la Batalla de los Dioses", startEp: 1, endEp: 14},
			{id: "resurreccion-f", name: "Saga de la Resurrección de 'F'", startEp: 15, endEp: 27},
			{id: "universo-6", name: "Saga del Torneo del Universo 6 (Champa)", startEp: 28, endEp: 46},
			{id: "trunks-futuro", name: "Saga de Trunks del Futuro (Goku Black)", startEp: 47, endEp: 76},
			{id: "supervivencia-universal", name: "Saga del Supervivencia Universal (Torneo del Poder)", startEp: 77, endEp: 131},
		}
	case 240411: // Dragon Ball Daima
		return []sagaResolution{
			{id: "daima-misterio", name: "El Misterio del Mundo Demonio", startEp: 1, endEp: 10},
			{id: "daima-travesia", name: "La Travesía en el Mundo Demonio", startEp: 11, endEp: 20},
		}
	}
	return nil
}

// InterceptSagas check if we should use local saga definitions instead of TMDB groups
func (scn *Scanner) InterceptSagas(ctx context.Context, tmdbID int) []sagaResolution {
	localSagas := GetDragonBallSagas(tmdbID)
	if len(localSagas) > 0 {
		return localSagas
	}
	// Fallback to TMDB groups
	return scn.resolveSagasForMediaSync(ctx, tmdbID)
}
