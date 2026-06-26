package intelligence

// MediaCandidate representa un archivo de video candidato para selección.
type MediaCandidate struct {
	FilePath   string   `json:"filePath"`
	Resolution int      `json:"resolution"` // 2160, 1080, 720, 480
	Codec      string   `json:"codec"`      // "h264", "hevc", "av1"
	Bitrate    uint32   `json:"bitrate"`    // bytes/s
	AudioLangs []string `json:"audioLangs"` // ["spa", "eng"]
	AudioCodec string   `json:"audioCodec"` // "aac", "flac", "dts"
	FileSize   uint64   `json:"fileSize"`
	IsHDR      bool     `json:"isHDR"`
	Container  string   `json:"container"` // "mkv", "mp4", "webm"
}

// ScoringWeights define los pesos para cada criterio de evaluación.
// Todos los pesos deben sumar 1.0 para obtener un puntaje normalizado.
type ScoringWeights struct {
	Resolution float64 `json:"resolution"` // Default: 0.35
	Codec      float64 `json:"codec"`      // Default: 0.25
	Bitrate    float64 `json:"bitrate"`    // Default: 0.20
	AudioMatch float64 `json:"audioMatch"` // Default: 0.20
}

// DefaultWeights retorna los pesos por defecto para la puntuación.
func DefaultWeights() ScoringWeights {
	return ScoringWeights{
		Resolution: 0.35,
		Codec:      0.25,
		Bitrate:    0.20,
		AudioMatch: 0.20,
	}
}

// SelectionResult resultado de la selección inteligente.
type SelectionResult struct {
	Winner        *MediaCandidate  `json:"winner"`
	AllCandidates []*MediaCandidate `json:"allCandidates"`
	TotalScore    float64          `json:"totalScore"`
	Reason        string           `json:"reason"`
}

// SelectionRequest solicitud de selección desde el frontend.
type SelectionRequest struct {
	TMDBID         int      `json:"tmdbId"`
	EpisodeNumber  int      `json:"episodeNumber"`
	PreferredLangs []string `json:"preferredLangs"` // ["spa", "eng"]
}
