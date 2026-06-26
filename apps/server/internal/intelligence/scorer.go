package intelligence

import (
	"math"
	"strings"
)

// ScoreCandidate evalúa un archivo y retorna un puntaje de 0.0 a 1.0.
// Cada criterio es evaluado independientemente y ponderado por los weights.
func ScoreCandidate(c *MediaCandidate, preferredLangs []string, weights ScoringWeights) float64 {
	resScore := scoreResolution(c.Resolution)
	codecScore := scoreCodec(c.Codec)
	bitrateScore := scoreBitrate(c.Bitrate, c.Resolution)
	audioScore := scoreAudioMatch(c.AudioLangs, preferredLangs)

	total := resScore*weights.Resolution +
		codecScore*weights.Codec +
		bitrateScore*weights.Bitrate +
		audioScore*weights.AudioMatch

	return math.Round(total*1000) / 1000
}

// scoreResolution puntúa la resolución del video (0.0 - 1.0).
// Prioriza 4K sobre 1080p, etc.
func scoreResolution(height int) float64 {
	switch {
	case height >= 2160:
		return 1.0
	case height >= 1440:
		return 0.85
	case height >= 1080:
		return 0.75
	case height >= 720:
		return 0.55
	case height >= 480:
		return 0.35
	default:
		return 0.2
	}
}

// scoreCodec puntúa el códec de video (0.0 - 1.0).
// AV1 > HEVC > H264 por eficiencia de compresión.
func scoreCodec(codec string) float64 {
	switch strings.ToLower(codec) {
	case "av1":
		return 1.0
	case "hevc", "h265":
		return 0.85
	case "h264", "avc":
		return 0.7
	case "vp9":
		return 0.65
	case "vp8":
		return 0.5
	default:
		return 0.4
	}
}

// scoreBitrate puntúa el bitrate relativo a la resolución (0.0 - 1.0).
// Un bitrate alto para su resolución indica mejor calidad.
func scoreBitrate(bitrate uint32, resolution int) float64 {
	if bitrate == 0 {
		return 0.3
	}

	// Bitrate esperado por resolución (en bytes/s)
	var expectedBitrate float64
	switch {
	case resolution >= 2160:
		expectedBitrate = 16_000_000 // 16 Mbps para 4K
	case resolution >= 1080:
		expectedBitrate = 6_000_000 // 6 Mbps para 1080p
	case resolution >= 720:
		expectedBitrate = 3_000_000 // 3 Mbps para 720p
	default:
		expectedBitrate = 1_500_000 // 1.5 Mbps para 480p
	}

	ratio := float64(bitrate) / expectedBitrate

	// Score basado en la relación bitrate/esperado
	// Un ratio de 1.0 es ideal (bitrate esperado)
	// Un ratio > 1.0 puede indicar calidad superior
	// Un ratio < 1.0 puede indicar menor calidad
	switch {
	case ratio >= 1.5:
		return 1.0 // Bitrate muy alto = excelente calidad
	case ratio >= 1.0:
		return 0.9 // Bitrate en rango esperado
	case ratio >= 0.7:
		return 0.7 // Bitrate aceptable
	case ratio >= 0.5:
		return 0.5 // Bitrate bajo
	default:
		return 0.3 // Bitrate muy bajo
	}
}

// scoreAudioMatch puntúa la coincidencia de idiomas de audio (0.0 - 1.0).
func scoreAudioMatch(audioLangs []string, preferredLangs []string) float64 {
	if len(audioLangs) == 0 || len(preferredLangs) == 0 {
		return 0.5
	}

	// Buscar el mejor match
	bestScore := 0.0
	for _, preferred := range preferredLangs {
		for _, actual := range audioLangs {
			if normalizeLang(actual) == normalizeLang(preferred) {
				// Match exacto
				bestScore = 1.0
				break
			}
		}
		if bestScore == 1.0 {
			break
		}
	}

	// Si no hay match exacto, verificar si hay un match parcial
	if bestScore < 1.0 {
		for _, preferred := range preferredLangs {
			for _, actual := range audioLangs {
				if strings.HasPrefix(normalizeLang(actual), normalizeLang(preferred)) ||
					strings.HasPrefix(normalizeLang(preferred), normalizeLang(actual)) {
					bestScore = 0.7
					break
				}
			}
			if bestScore == 0.7 {
				break
			}
		}
	}

	return bestScore
}

// normalizeLang normaliza un código de idioma a formato ISO 639-1.
func normalizeLang(lang string) string {
	lang = strings.ToLower(strings.TrimSpace(lang))
	// Mapeos comunes
	langMap := map[string]string{
		"spa":    "es",
		"span":   "es",
		"spanish": "es",
		"español": "es",
		"es-la":  "es",
		"spa-lat": "es",
		"eng":    "en",
		"english": "en",
		"jpn":    "ja",
		"japanese": "ja",
		"jap":    "ja",
	}
	if mapped, ok := langMap[lang]; ok {
		return mapped
	}
	return lang
}
