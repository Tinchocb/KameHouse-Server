package metadata_provider

import (
	"strconv"
	apiMetadata "kamehouse/internal/api/metadata"
)

// dragonBallFillerEpisodes maps TMDB IDs to their filler episode numbers.
// Filler episodes are episodes that don't appear in the manga source material.
// Source: animefillerlist.com
var dragonBallFillerEpisodes = map[int]map[int]bool{
	12609: { // Dragon Ball (Original) - Filler episodes
		29: true, 30: true, 31: true, 32: true, 33: true,
		42: true, 43: true, 44: true, 45: true, 46: true, 47: true, 48: true, 49: true,
		69: true, 70: true, 71: true, 72: true, 73: true, 74: true, 75: true, 76: true,
		79: true, 80: true, 81: true, 82: true,
		127: true, 128: true, 129: true, 130: true, 131: true, 132: true,
	},
	12971: { // Dragon Ball Z - Filler episodes
		10: true, 11: true, 12: true, 13: true, 14: true, 15: true, 16: true, 17: true,
		40: true, 41: true, 42: true, 43: true, 44: true,
		50: true, 51: true, 52: true, 53: true,
		100: true, 101: true, 102: true, 103: true, 104: true, 105: true, 106: true, 107: true,
		108: true, 109: true, 110: true, 111: true, 112: true, 113: true, 114: true, 115: true,
		116: true, 117: true,
		125: true,
		170: true, 171: true, 172: true, 173: true, 174: true,
		195: true, 196: true, 197: true, 198: true, 199: true,
		202: true, 203: true, 204: true, 205: true, 206: true, 207: true, 208: true, 209: true,
		210: true, 211: true, 212: true, 213: true, 214: true, 215: true, 216: true, 217: true, 218: true, 219: true,
		220: true, 221: true, 222: true, 223: true, 224: true, 225: true, 226: true, 227: true, 228: true, 229: true,
		230: true, 231: true, 232: true, 233: true, 234: true, 235: true,
		270: true, 271: true, 272: true, 273: true, 274: true, 275: true, 276: true, 277: true, 278: true, 279: true,
		280: true, 281: true, 282: true, 283: true, 284: true, 285: true, 286: true, 287: true,
	},
	12697: { // Dragon Ball GT - Almost entirely anime-original, mark no filler
	},
	62715: { // Dragon Ball Super - Filler episodes
		// Very few fillers since Super was its own source material
	},
}

// dragonBallSeriesTitles provides the canonical Latin Spanish titles for each series.
// Used to override the TMDB title with the Lat-Am dub names.
var dragonBallSeriesTitles = map[int]map[string]string{
	12609: {
		"en": "Dragon Ball",
		"es": "Dragon Ball",
		"ja": "ドラゴンボール",
	},
	12971: {
		"en": "Dragon Ball Z",
		"es": "Dragon Ball Z",
		"ja": "ドラゴンボールZ",
	},
	12697: {
		"en": "Dragon Ball GT",
		"es": "Dragon Ball GT",
		"ja": "ドラゴンボールGT",
	},
	62715: {
		"en": "Dragon Ball Super",
		"es": "Dragon Ball Super",
		"ja": "ドラゴンボール超",
	},
	61709: {
		"en": "Dragon Ball Z Kai",
		"es": "Dragon Ball Kai",
		"ja": "ドラゴンボール改",
	},
	240411: {
		"en": "Dragon Ball Daima",
		"es": "Dragon Ball Daima",
		"ja": "ドラゴンボールDAIMA",
	},
}

// EnrichWithFiller marks Dragon Ball episodes as filler when applicable.
func EnrichWithFiller(mediaId int, md *apiMetadata.AnimeMetadata) {
	if md == nil || md.Episodes == nil {
		return
	}

	fillerEps, ok := dragonBallFillerEpisodes[mediaId]
	if !ok {
		return
	}

	for key, ep := range md.Episodes {
		epNum, err := strconv.Atoi(key)
		if err != nil {
			continue
		}
		if fillerEps[epNum] {
			ep.IsFiller = true
		}
	}
}

// EnrichWithSeriesTitles overrides the AnimeMetadata title map with canonical
// Latin Spanish and Japanese titles for Dragon Ball series.
func EnrichWithSeriesTitles(mediaId int, md *apiMetadata.AnimeMetadata) {
	if md == nil {
		return
	}

	titles, ok := dragonBallSeriesTitles[mediaId]
	if !ok {
		return
	}

	if md.Titles == nil {
		md.Titles = make(map[string]string)
	}

	for lang, title := range titles {
		md.Titles[lang] = title
	}
}
