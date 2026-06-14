package metadata_provider

import (
	apiMetadata "kamehouse/internal/api/metadata"
	"kamehouse/internal/lore"
)

// ResolveSaga returns the saga ID and name for a given media and episode number.
func ResolveSaga(tmdbID int, epNum int) (string, string) {
	sagas := lore.GetSagaRanges(tmdbID)
	if len(sagas) == 0 {
		return "", ""
	}

	for _, saga := range sagas {
		if epNum >= saga.StartEp && epNum <= saga.EndEp {
			return saga.ID, saga.Title
		}
	}

	return "", ""
}

// EnrichWithSagas populates saga metadata for Dragon Ball episodes.
func EnrichWithSagas(mediaID int, metadata *apiMetadata.AnimeMetadata) {
	if metadata == nil || metadata.Episodes == nil {
		return
	}

	sagas := lore.GetSagaRanges(mediaID)
	if len(sagas) == 0 {
		return
	}


	for _, ep := range metadata.Episodes {
		epNum := ep.EpisodeNumber
		if ep.SeasonNumber == 0 {
			continue // Skip specials for now
		}

		// Handle absolute episode number for Dragon Ball Z (12971)
		if mediaID == 12971 {
			switch ep.SeasonNumber {
			case 2:
				epNum += 39
			case 3:
				epNum += 74
			case 4:
				epNum += 107
			case 5:
				epNum += 139
			case 6:
				epNum += 165
			case 7:
				epNum += 194
			case 8:
				epNum += 219
			case 9:
				epNum += 253
			}
		}

		// Handle absolute episode number for Dragon Ball Super (62715)
		if mediaID == 62715 {
			switch ep.SeasonNumber {
			case 2:
				epNum += 14
			case 3:
				epNum += 27
			case 4:
				epNum += 46
			case 5:
				epNum += 76
			}
		}

		for _, saga := range sagas {
			if epNum >= saga.StartEp && epNum <= saga.EndEp {
				ep.SagaId = saga.ID
				ep.SagaName = saga.Title
				ep.AbsoluteEpisodeNumber = epNum
				break
			}
		}
	}
}

