package metadata_provider

import (
	apiMetadata "kamehouse/internal/api/metadata"
)

type SagaRange struct {
	Id      string
	Title   string
	StartEp int
	EndEp   int
}

var dragonBallSagaDefinitions = map[int][]SagaRange{
	12609: { // Original
		{Id: "pilaf", Title: "Saga de Pilaf", StartEp: 1, EndEp: 13},
		{Id: "torneo-21", Title: "21° Torneo de Artes Marciales", StartEp: 14, EndEp: 28},
		{Id: "red-ribbon", Title: "Saga de la Patrulla Roja", StartEp: 29, EndEp: 68},
		{Id: "uranai-baba", Title: "Saga de Uranai Baba", StartEp: 69, EndEp: 82},
		{Id: "torneo-22", Title: "22° Torneo de Artes Marciales", StartEp: 83, EndEp: 101},
		{Id: "piccolo", Title: "Saga de Piccolo Daimaku", StartEp: 102, EndEp: 122},
		{Id: "piccolo-jr", Title: "Saga de Piccolo Jr.", StartEp: 123, EndEp: 153},
	},
	12971: { // Z
		{Id: "saiyajin", Title: "Saga Saiyajin", StartEp: 1, EndEp: 35},
		{Id: "freezer", Title: "Saga de Freezer", StartEp: 36, EndEp: 107},
		{Id: "garlic-jr", Title: "Saga de Garlic Jr.", StartEp: 108, EndEp: 117},
		{Id: "androides", Title: "Saga de los Androides", StartEp: 118, EndEp: 139},
		{Id: "cell", Title: "Saga de Cell", StartEp: 140, EndEp: 194},
		{Id: "torneo-otro-mundo", Title: "Saga del Torneo del Otro Mundo", StartEp: 195, EndEp: 199},
		{Id: "gran-saiyaman", Title: "Saga del Gran Saiyaman", StartEp: 200, EndEp: 209},
		{Id: "majin-buu", Title: "Saga de Majin Buu", StartEp: 210, EndEp: 291},
	},
	12697: { // GT
		{Id: "black-star", Title: "Saga de las Esferas del Dragón Definitivas", StartEp: 1, EndEp: 16},
		{Id: "baby", Title: "Saga de Baby", StartEp: 17, EndEp: 40},
		{Id: "super-17", Title: "Saga de Súper N°17", StartEp: 41, EndEp: 47},
		{Id: "shadow-dragons", Title: "Saga de los Dragones Oscuros", StartEp: 48, EndEp: 64},
	},
	62715: { // Super
		{Id: "batalla-dioses", Title: "Saga de la Batalla de los Dioses", StartEp: 1, EndEp: 14},
		{Id: "resurreccion-f", Title: "Saga de la Resurrección de F", StartEp: 15, EndEp: 27},
		{Id: "universo-6", Title: "Saga del Universo 6", StartEp: 28, EndEp: 46},
		{Id: "trunks-futuro", Title: "Saga de Trunks del Futuro", StartEp: 47, EndEp: 76},
		{Id: "supervivencia-universal", Title: "Saga de la Supervivencia Universal", StartEp: 77, EndEp: 131},
	},
	61709: { // Kai
		{Id: "saiyajin", Title: "Saga Saiyajin", StartEp: 1, EndEp: 18},
		{Id: "freezer", Title: "Saga de Freezer", StartEp: 19, EndEp: 54},
		{Id: "cell", Title: "Saga de Cell", StartEp: 55, EndEp: 98},
		{Id: "majin_buu", Title: "Saga de Majin Buu", StartEp: 99, EndEp: 167},
	},
	240411: { // Daima
		{Id: "daima-misterio", Title: "El Misterio del Mundo Demonio", StartEp: 1, EndEp: 10},
		{Id: "daima-travesia", Title: "La Travesía en el Mundo Demonio", StartEp: 11, EndEp: 20},
	},
}

// ResolveSaga returns the saga ID and name for a given media and episode number.
func ResolveSaga(tmdbId int, epNum int) (string, string) {
	sagas, ok := dragonBallSagaDefinitions[tmdbId]
	if !ok {
		return "", ""
	}

	for _, saga := range sagas {
		if epNum >= saga.StartEp && epNum <= saga.EndEp {
			return saga.Id, saga.Title
		}
	}

	return "", ""
}

// EnrichWithSagas populates saga metadata for Dragon Ball episodes.
func EnrichWithSagas(mediaId int, metadata *apiMetadata.AnimeMetadata) {
	if metadata == nil || metadata.Episodes == nil {
		return
	}

	sagas, ok := dragonBallSagaDefinitions[mediaId]
	if !ok {
		return
	}

	for _, ep := range metadata.Episodes {
		epNum := ep.EpisodeNumber
		if ep.SeasonNumber == 0 {
			continue // Skip specials for now
		}

		// Handle absolute episode number for DBZ Kai if it's Season 2
		// Season 1: 1-98, Season 2: 1-69 (starts at 99)
		if mediaId == 61709 && ep.SeasonNumber == 2 {
			epNum += 98
		}

		for _, saga := range sagas {
			if epNum >= saga.StartEp && epNum <= saga.EndEp {
				ep.SagaId = saga.Id
				ep.SagaName = saga.Title
				ep.AbsoluteEpisodeNumber = epNum
				break
			}
		}
	}
}
