package intelligence

import (
	"context"
	"fmt"
	"kamehouse/internal/database/db"
	"kamehouse/internal/jellyfin"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

// Selector es el motor de selección inteligente de archivos.
type Selector struct {
	db        *db.Database
	jellyfin  *jellyfin.Client
	cache     *ResultCache
	logger    *zerolog.Logger
	weights   ScoringWeights
}

// NewSelector crea un nuevo selector inteligente.
func NewSelector(database *db.Database, jellyfinClient *jellyfin.Client, logger *zerolog.Logger) *Selector {
	return &Selector{
		db:       database,
		jellyfin: jellyfinClient,
		cache:    NewResultCache(10*time.Minute, 500),
		logger:   logger,
		weights:  DefaultWeights(),
	}
}

// GetWeights retorna los pesos actuales de puntuación.
func (s *Selector) GetWeights() ScoringWeights {
	return s.weights
}

// GetCacheStats retorna estadísticas de la caché.
func (s *Selector) GetCacheStats() CacheStats {
	return s.cache.Stats()
}

// SelectBestSource retorna el archivo ganador para un título/episodio.
func (s *Selector) SelectBestSource(
	ctx context.Context,
	tmdbID int,
	episodeNumber int,
	preferredLangs []string,
) (*SelectionResult, error) {
	// 1. Buscar en caché
	cacheKey := fmt.Sprintf("%d-%d", tmdbID, episodeNumber)
	if cached, ok := s.cache.Get(cacheKey); ok {
		s.logger.Debug().Int("tmdbId", tmdbID).Msg("intelligence: cache hit")
		return cached, nil
	}

	// 2. Buscar fuentes en DB local
	localSources := s.getLocalSources(tmdbID, episodeNumber)
	s.logger.Debug().
		Int("tmdbId", tmdbID).
		Int("episode", episodeNumber).
		Int("localSources", len(localSources)).
		Msg("intelligence: found local sources")

	// 3. Si hay menos de 2 fuentes locales, consultar Jellyfin
	if len(localSources) < 2 && s.jellyfin != nil && s.jellyfin.IsConfigured() {
		jellyfinSources, err := s.getJellyfinSources(ctx, tmdbID, episodeNumber)
		if err != nil {
			s.logger.Warn().Err(err).Int("tmdbId", tmdbID).Msg("intelligence: failed to get Jellyfin sources")
		} else {
			s.logger.Debug().
				Int("tmdbId", tmdbID).
				Int("jellyfinSources", len(jellyfinSources)).
				Msg("intelligence: found Jellyfin sources")
			localSources = mergeSources(localSources, jellyfinSources)
		}
	}

	if len(localSources) == 0 {
		return nil, fmt.Errorf("intelligence: no sources found for TMDB ID %d, episode %d", tmdbID, episodeNumber)
	}

	// 4. Puntuar y ordenar
	result := s.scoreAndRank(localSources, preferredLangs)

	// 5. Guardar en caché
	s.cache.Set(cacheKey, result)

	s.logger.Info().
		Int("tmdbId", tmdbID).
		Int("episode", episodeNumber).
		Float64("score", result.TotalScore).
		Str("winner", result.Winner.FilePath).
		Msg("intelligence: selected best source")

	return result, nil
}

// getLocalSources obtiene fuentes de archivos locales desde la DB.
func (s *Selector) getLocalSources(tmdbID int, episodeNumber int) []*MediaCandidate {
	// Buscar el LibraryMedia por TMDB ID
	var media struct {
		ID uint
	}
	if err := s.db.Gorm().
		Table("library_media").
		Where("tmdb_id = ?", tmdbID).
		Select("id").
		Scan(&media).Error; err != nil {
		return nil
	}

	// Buscar archivos locales asociados
	var localFiles []struct {
		Path string
	}
	s.db.Gorm().
		Table("local_files").
		Where("media_id = ? AND library_media_id = ?", tmdbID, media.ID).
		Select("path").
		Scan(&localFiles)

	var candidates []*MediaCandidate
	for _, lf := range localFiles {
		candidate := parseFilePathToCandidate(lf.Path, episodeNumber)
		if candidate != nil {
			candidates = append(candidates, candidate)
		}
	}

	return candidates
}

// getJellyfinSources obtiene fuentes desde la API de Jellyfin.
func (s *Selector) getJellyfinSources(ctx context.Context, tmdbID int, episodeNumber int) ([]*MediaCandidate, error) {
	// Buscar el item en Jellyfin
	item, err := s.jellyfin.SearchByTMDB(ctx, tmdbID)
	if err != nil {
		return nil, err
	}

	// Obtener las fuentes de medios
	sources, err := s.jellyfin.GetMediaSources(ctx, item.ID)
	if err != nil {
		return nil, err
	}

	var candidates []*MediaCandidate
	for _, source := range sources {
		candidate := jellyfinSourceToCandidate(source, episodeNumber)
		if candidate != nil {
			candidates = append(candidates, candidate)
		}
	}

	return candidates, nil
}

// scoreAndRank evalúa y ordena los candidatos.
func (s *Selector) scoreAndRank(candidates []*MediaCandidate, preferredLangs []string) *SelectionResult {
	type scoredCandidate struct {
		candidate *MediaCandidate
		score     float64
	}

	scored := make([]scoredCandidate, len(candidates))
	for i, c := range candidates {
		scored[i] = scoredCandidate{
			candidate: c,
			score:     ScoreCandidate(c, preferredLangs, s.weights),
		}
	}

	// Ordenar por puntaje descendente
	sort.Slice(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})

	winner := scored[0].candidate
	totalScore := scored[0].score

	// Generar razón de la selección
	reason := generateReason(winner, preferredLangs)

	allCandidates := make([]*MediaCandidate, len(scored))
	for i, s := range scored {
		allCandidates[i] = s.candidate
	}

	return &SelectionResult{
		Winner:        winner,
		AllCandidates: allCandidates,
		TotalScore:    totalScore,
		Reason:        reason,
	}
}

// generateReason genera una descripción legible de por qué se seleccionó un archivo.
func generateReason(winner *MediaCandidate, preferredLangs []string) string {
	parts := []string{}

	// Resolución
	switch {
	case winner.Resolution >= 2160:
		parts = append(parts, "4K Ultra HD")
	case winner.Resolution >= 1080:
		parts = append(parts, "1080p Full HD")
	case winner.Resolution >= 720:
		parts = append(parts, "720p HD")
	default:
		parts = append(parts, fmt.Sprintf("%dp", winner.Resolution))
	}

	// Códec
	if winner.Codec != "" {
		parts = append(parts, strings.ToUpper(winner.Codec))
	}

	// Idioma de audio
	if len(winner.AudioLangs) > 0 && len(preferredLangs) > 0 {
		for _, lang := range winner.AudioLangs {
			for _, pref := range preferredLangs {
				if normalizeLang(lang) == normalizeLang(pref) {
					parts = append(parts, fmt.Sprintf("Audio %s", strings.ToUpper(lang)))
				}
			}
		}
	}

	return strings.Join(parts, " | ")
}

// parseFilePathToCandidate analiza un nombre de archivo para extraer información del video.
func parseFilePathToCandidate(path string, episodeNumber int) *MediaCandidate {
	if path == "" {
		return nil
	}

	candidate := &MediaCandidate{
		FilePath: path,
	}

	// Extraer extensión
	ext := strings.ToLower(filepath.Ext(path))
	candidate.Container = strings.TrimPrefix(ext, ".")

	// Extraer información del nombre de archivo
	filename := strings.ToLower(filepath.Base(path))

	// Resolución
	candidate.Resolution = inferResolutionFromFilename(filename)

	// Códec
	candidate.Codec = inferCodecFromFilename(filename)

	// Idioma de audio
	candidate.AudioLangs = inferAudioLangsFromFilename(filename)

	// Tamaño del archivo (si está disponible)
	// Nota: Esto requeriría acceso al filesystem, que puede no estar disponible

	return candidate
}

// inferResolutionFromFilename infiere la resolución del nombre de archivo.
func inferResolutionFromFilename(filename string) int {
	if strings.Contains(filename, "2160p") || strings.Contains(filename, "4k") || strings.Contains(filename, "uhd") {
		return 2160
	}
	if strings.Contains(filename, "1080p") || strings.Contains(filename, "1080") {
		return 1080
	}
	if strings.Contains(filename, "720p") || strings.Contains(filename, "720") {
		return 720
	}
	if strings.Contains(filename, "480p") || strings.Contains(filename, "480") {
		return 480
	}
	return 1080 // Default a 1080p
}

// inferCodecFromFilename infiere el códec del nombre de archivo.
func inferCodecFromFilename(filename string) string {
	if strings.Contains(filename, "av1") || strings.Contains(filename, "av01") {
		return "av1"
	}
	if strings.Contains(filename, "hevc") || strings.Contains(filename, "h265") || strings.Contains(filename, "x265") {
		return "hevc"
	}
	if strings.Contains(filename, "h264") || strings.Contains(filename, "x264") || strings.Contains(filename, "avc") {
		return "h264"
	}
	if strings.Contains(filename, "vp9") {
		return "vp9"
	}
	if strings.Contains(filename, "vp8") {
		return "vp8"
	}
	return "h264" // Default a H264
}

// inferAudioLangsFromFilename infiere los idiomas de audio del nombre de archivo.
func inferAudioLangsFromFilename(filename string) []string {
	var langs []string

	if strings.Contains(filename, "spa") || strings.Contains(filename, "es-spanish") || strings.Contains(filename, "latino") {
		langs = append(langs, "spa")
	}
	if strings.Contains(filename, "eng") || strings.Contains(filename, "english") {
		langs = append(langs, "eng")
	}
	if strings.Contains(filename, "jpn") || strings.Contains(filename, "japanese") || strings.Contains(filename, "jap") {
		langs = append(langs, "jpn")
	}

	if len(langs) == 0 {
		langs = append(langs, "unk")
	}

	return langs
}

// jellyfinSourceToCandidate convierte una fuente de Jellyfin a un MediaCandidate.
func jellyfinSourceToCandidate(source jellyfin.JellyfinMediaSource, episodeNumber int) *MediaCandidate {
	candidate := &MediaCandidate{
		FilePath:  source.Path,
		Container: source.Container,
		Bitrate:   uint32(source.Bitrate),
		FileSize:  uint64(source.Size),
	}

	// Extraer streams
	for _, stream := range source.MediaStreams {
		switch stream.Type {
		case "Video":
			candidate.Resolution = stream.Height
			candidate.Codec = stream.Codec
			if stream.BitRate > 0 {
				candidate.Bitrate = uint32(stream.BitRate)
			}
		case "Audio":
			if stream.Language != "" {
				candidate.AudioLangs = append(candidate.AudioLangs, stream.Language)
			}
			candidate.AudioCodec = stream.Codec
		}
	}

	// Si no se detectó resolución, intentar del nombre
	if candidate.Resolution == 0 {
		candidate.Resolution = inferResolutionFromFilename(strings.ToLower(source.Name))
	}

	return candidate
}

// mergeSources combina fuentes locales y de Jellyfin, priorizando locales.
func mergeSources(local, jellyfin []*MediaCandidate) []*MediaCandidate {
	seen := make(map[string]bool)
	var merged []*MediaCandidate

	// Agregar fuentes locales primero (mayor prioridad)
	for _, c := range local {
		if !seen[c.FilePath] {
			seen[c.FilePath] = true
			merged = append(merged, c)
		}
	}

	// Agregar fuentes de Jellyfin que no estén duplicadas
	for _, c := range jellyfin {
		if !seen[c.FilePath] {
			seen[c.FilePath] = true
			merged = append(merged, c)
		}
	}

	return merged
}

// inferResolutionFromHeight convierte altura en píxeles a resolución legible.
func inferResolutionFromHeight(height int) string {
	switch {
	case height >= 2160:
		return "4K"
	case height >= 1440:
		return "1440p"
	case height >= 1080:
		return "1080p"
	case height >= 720:
		return "720p"
	case height >= 480:
		return "480p"
	default:
		return fmt.Sprintf("%dp", height)
	}
}

// ParseHeightFromResolution convierte una cadena de resolución a altura en píxeles.
func ParseHeightFromResolution(res string) int {
	res = strings.TrimSuffix(res, "p")
	res = strings.TrimSuffix(res, "P")
	height, _ := strconv.Atoi(res)
	return height
}
