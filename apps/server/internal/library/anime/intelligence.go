package anime

import (
	"context"
	"encoding/json"
	"fmt"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"strings"
	"sync"
	"time"

	"kamehouse/internal/util/cache"

	"github.com/rs/zerolog"
)

// ─────────────────────────────────────────────────────────────────────────────
// Content tagging types
// ─────────────────────────────────────────────────────────────────────────────

// ContentTag classifies an episode's narrative role.
type ContentTag string

const (
	TagFiller  ContentTag = "FILLER"  // Non-canon padding content
	TagEpic    ContentTag = "EPIC"    // Outstanding episode (score > 8.5 / 85 on 0-100 scale)
	TagCanon   ContentTag = "CANON"   // Default canon episode
	TagSpecial ContentTag = "SPECIAL" // OVA / special / movie
)

// ArcName is the narrative saga an episode belongs to.
type ArcName = string

// EpisodeIntelligence carries computed intelligence about a single episode.
type EpisodeIntelligence struct {
	Rating   float64    `json:"rating"` // 0–10 (derived from LibraryMedia.Score ÷ 10)
	IsFiller bool       `json:"isFiller"`
	ArcName  ArcName    `json:"arcName"` // Empty string when unknown
	Tag      ContentTag `json:"tag"`
	Vibes    []string   `json:"vibes"` // Emotional or thematic tags (e.g., "EPIC", "CHILL", "TEARS")
}

// SmartMetadataResult wraps episode metadata enriched with intelligence data.
type SmartMetadataResult struct {
	*EpisodeMetadata
	Intelligence *EpisodeIntelligence `json:"intelligence"`
}

// ─────────────────────────────────────────────────────────────────────────────
// FillerChecker — local interface to avoid circular import (fillermanager→anime)
// ─────────────────────────────────────────────────────────────────────────────

// FillerChecker is satisfied by *fillermanager.FillerManager.
type FillerChecker interface {
	IsEpisodeFiller(mediaID int, episodeNumber int) bool
}

// ─────────────────────────────────────────────────────────────────────────────
// Dragon Ball arc map — static episode ranges keyed by TMDB media ID
// Range: [from, to] inclusive episode numbers.
// ─────────────────────────────────────────────────────────────────────────────

type arcRange struct {
	from int
	to   int
	name ArcName
}

// dragonBallArcs maps TMDB media IDs to their ordered arc slices.
// IDs: Dragon Ball (12609), Dragon Ball Z (12971), Dragon Ball GT (12695)
// Dragon Ball Super (62715), Dragon Ball Z Kai (61709), Dragon Ball Daima (236825)
var dragonBallArcs = map[int][]arcRange{
	// ─── Dragon Ball (12609) ─────────────────────────────────────────
	12609: {
		{1, 13, "Saga de la Búsqueda de las Dragon Balls"},
		{14, 28, "Saga del Torneo de Artes Malciales"},
		{29, 45, "Saga del Ejercito del General Blue (Red Ribbon)"},
		{46, 68, "Saga de la Búsqueda del Mar Rojo"},
		{69, 83, "Saga del 22° Torneo"},
		{84, 101, "Saga de Piccolo Daimao"},
		{102, 123, "Saga del 23° Torneo"},
		{124, 153, "Saga de Garlic Jr. (Relleno)"},
	},
	// ─── Dragon Ball Z (12971) ───────────────────────────────────────
	12971: {
		{1, 35, "Saga de los Saiyajin"},
		{36, 74, "Saga de Namek"},
		{75, 107, "Saga de Freezer"},
		{108, 139, "Saga de Garlic Jr. (Relleno)"},
		{140, 165, "Saga de los Androides"},
		{166, 194, "Saga de Imperfect Cell"},
		{195, 221, "Saga de Cell Perfect"},
		{222, 253, "Saga de Cell Games"},
		{254, 288, "Saga de los Kioshin (Relleno)"},
		{289, 291, "Saga del Torneo de los 25°"},
		{292, 330, "Saga del Mundo de Babidi"},
		{331, 373, "Saga de Majin Buu"},
		{374, 391, "Saga de Fusión"},
		{392, 421, "Saga de Kid Buu"},
	},
	// ─── Dragon Ball Z Kai (61709) ───────────────────────────────────
	61709: {
		{1, 26, "Saga de los Saiyajin"},
		{27, 54, "Saga de Frieza"},
		{55, 77, "Saga de Cell"},
		{78, 98, "Saga de Majin Buu"},
	},
	// ─── Dragon Ball Super (62715) ───────────────────────────────────
	62715: {
		{1, 14, "Saga del Dios de la Destrucción Beerus"},
		{15, 27, "Saga de la Resurrección F"},
		{28, 46, "Saga de Universe 6"},
		{47, 76, "Saga de Future Trunks"},
		{77, 96, "Saga del Torneo de la Fuerza"},
		{97, 131, "Saga del Torneo del Poder"},
	},
	// ─── Dragon Ball GT (12695) ──────────────────────────────────────
	12695: {
		{1, 16, "Saga de Baby"},
		{17, 40, "Saga de Super 17"},
		{41, 64, "Saga de los Dragon Balls de la Sombra"},
	},
	// ─── Dragon Ball Daima (236825) ──────────────────────────────────
	236825: {
		{1, 20, "Saga de la Conspiración del Reino Demoniaco"},
	},
}

// resolveArc returns the narrative arc name for a given media ID and episode number.
// Returns an empty string when no arc data is available.
func resolveArc(mediaID, episodeNum int) ArcName {
	arcs, ok := dragonBallArcs[mediaID]
	if !ok {
		return ""
	}
	for _, a := range arcs {
		if episodeNum >= a.from && episodeNum <= a.to {
			return a.name
		}
	}
	return ""
}

// epicScoreThreshold: LibraryMedia.Score is 0–100; ÷10 maps to 0–10. 85 → 8.5.
const epicScoreThreshold = 85

// ─────────────────────────────────────────────────────────────────────────────
// IntelligenceService
// ─────────────────────────────────────────────────────────────────────────────

// IntelligenceService computes and caches episode-level content intelligence.
type IntelligenceService struct {
	db     *db.Database
	fm     FillerChecker // may be nil when filler data is not yet loaded
	logger *zerolog.Logger
	// cache stores *EpisodeIntelligence keyed by "mediaID:episodeNum".
	// sync.Map gives lock-free reads — critical for the < 10 ms SLA.
	cache sync.Map
}

// NewIntelligenceService constructs the service.
// fm may be nil; when nil, filler detection is skipped gracefully.
func NewIntelligenceService(database *db.Database, fm FillerChecker, logger *zerolog.Logger) *IntelligenceService {
	return &IntelligenceService{
		db:     database,
		fm:     fm,
		logger: logger,
	}
}

// cacheKey produces a deterministic string key for the in-memory cache.
func cacheKey(mediaID, episodeNum int) string { return fmt.Sprintf("%d:%d", mediaID, episodeNum) }

// GetSmartMetadata returns episode metadata enriched with intelligence data.
// Cache hit path is a single sync.Map.Load — O(1) and well under 10 ms.
// On any external data failure, it falls back to TagCanon without panicking.
func (s *IntelligenceService) GetSmartMetadata(
	_ context.Context,
	mediaID int,
	episodeNum int,
	base *EpisodeMetadata,
) (*SmartMetadataResult, error) {
	key := cacheKey(mediaID, episodeNum)

	// ── Fast path: cache hit ──────────────────────────────────────────
	if v, ok := s.cache.Load(key); ok {
		return &SmartMetadataResult{
			EpisodeMetadata: base,
			Intelligence:    v.(*EpisodeIntelligence),
		}, nil
	}

	// ── Slow path: compute, always succeeds ──────────────────────────
	intel := s.computeIntelligence(mediaID, episodeNum, base)
	s.cache.Store(key, intel)

	return &SmartMetadataResult{
		EpisodeMetadata: base,
		Intelligence:    intel,
	}, nil
}

// computeIntelligence derives EpisodeIntelligence from available data.
// It is guaranteed to never panic: each sub-step is wrapped in a defer recover.
func (s *IntelligenceService) computeIntelligence(mediaID, episodeNum int, base *EpisodeMetadata) (intel *EpisodeIntelligence) {
	// Safe default — Canon, unrated, no filler, no arc.
	intel = &EpisodeIntelligence{
		Rating:   0,
		IsFiller: false,
		ArcName:  "",
		Tag:      TagCanon,
		Vibes:    make([]string, 0),
	}

	// ── Filler detection ─────────────────────────────────────────────
	if s.fm != nil {
		func() {
			defer func() { recover() }() //nolint:errcheck
			isFiller := s.fm.IsEpisodeFiller(mediaID, episodeNum)
			if isFiller {
				intel.IsFiller = true
				intel.Tag = TagFiller
			}
		}()
	}

	// Propagate IsFiller from base EpisodeMetadata when fillermanager is absent.
	if base != nil && base.IsFiller && !intel.IsFiller {
		intel.IsFiller = true
		intel.Tag = TagFiller
	}

	// ── Rating + Epic detection ───────────────────────────────────────
	func() {
		defer func() { recover() }() //nolint:errcheck
		var media models.LibraryMedia
		if err := s.db.Gorm().Where("id = ?", mediaID).First(&media).Error; err != nil {
			return
		}
		if media.Score > 0 {
			intel.Rating = float64(media.Score) / 10.0
		}
		// Override to Epic only when not already classified as Filler.
		if media.Score >= epicScoreThreshold && intel.Tag != TagFiller {
			intel.Tag = TagEpic
		}
	}()

	// ── Arc grouping ─────────────────────────────────────────────────
	intel.ArcName = resolveArc(mediaID, episodeNum)

	// ── Vibe derivation ──────────────────────────────────────────────
	intel.Vibes = s.deriveVibes(mediaID, episodeNum, base, intel)

	return intel
}

// DeriveSeriesVibes categorizes the "feel" of a series based on genres and score.
func (s *IntelligenceService) DeriveSeriesVibes(media *models.LibraryMedia) []string {
	vibes := make([]string, 0)
	if media == nil {
		return vibes
	}

	hasGenre := func(g string) bool {
		return strings.Contains(strings.ToLower(string(media.Genres)), strings.ToLower(g))
	}

	score := float64(media.Score)
	rating := score / 10.0

	if score >= epicScoreThreshold {
		vibes = append(vibes, "EPIC")
	}

	if hasGenre("Drama") || hasGenre("Romance") {
		if rating > 7.5 {
			vibes = append(vibes, "EMOTIONAL")
		}
	}

	if hasGenre("Action") || hasGenre("Adventure") {
		if rating > 8.0 {
			vibes = append(vibes, "HYPED")
		}
	}

	if hasGenre("Comedy") || hasGenre("Slice of Life") {
		vibes = append(vibes, "CHILL")
	}

	if hasGenre("Horror") || hasGenre("Psychological") || hasGenre("Thriller") {
		vibes = append(vibes, "INTENSE")
	}

	return vibes
}

// deriveVibes categorizes the "feel" of an episode based on genres, score, and tags.
func (s *IntelligenceService) deriveVibes(mediaID, _ int, _ *EpisodeMetadata, _ *EpisodeIntelligence) []string {
	var media models.LibraryMedia
	if err := s.db.Gorm().Where("id = ?", mediaID).First(&media).Error; err != nil {
		return make([]string, 0)
	}
	return s.DeriveSeriesVibes(&media)
}

// InvalidateCache removes all cached intelligence for a given media.
// Call this after filler data is refreshed for that media entry.
func (s *IntelligenceService) InvalidateCache(mediaID int) {
	s.cache.Range(func(k, _ any) bool {
		if key, ok := k.(string); ok {
			prefix := fmt.Sprintf("%d:", mediaID)
			if len(key) >= len(prefix) && key[:len(prefix)] == prefix {
				s.cache.Delete(k)
			}
		}
		return true
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// Curated swimlane types & response
// ─────────────────────────────────────────────────────────────────────────────

// CuratedSwimlane represents a single content row on the home screen.
type CuratedSwimlane struct {
	ID      string                    `json:"id"`
	Title   string                    `json:"title"`
	Type    string                    `json:"type"` // "local_library"|"epic_moments"|"trending"|"essential_cinema"
	Entries []*LibraryCollectionEntry `json:"entries"`
}

// CuratedHomeResponse is returned by GetCuratedSwimlanes.
type CuratedHomeResponse struct {
	Swimlanes []*CuratedSwimlane `json:"swimlanes"`
}

// GetContinueWatching returns a list of media the user is currently watching,
// suggesting the next episode if the current one is almost finished.
func (s *IntelligenceService) GetContinueWatching(ctx context.Context, userID uint) ([]dto.ContinueWatchingItem, error) {
	var history []models.WatchHistory

	subQuery := s.db.Gorm().
		Select("media_id, MAX(updated_at) as latest").
		Table("watch_histories").
		Where("account_id = ?", userID).
		Group("media_id")

	if err := s.db.Gorm().
		Table("watch_histories").
		Joins("JOIN (?) as latest_history ON watch_histories.media_id = latest_history.media_id AND watch_histories.updated_at = latest_history.latest", subQuery).
		Where("account_id = ?", userID).
		Order("updated_at DESC").
		Limit(20).
		Find(&history).Error; err != nil {
		return nil, err
	}

	if len(history) == 0 {
		return []dto.ContinueWatchingItem{}, nil
	}

	allLocalFiles, _, err := db.GetLocalFiles(s.db)
	if err != nil {
		return nil, err
	}

	fileMap := make(map[int]map[int]bool)
	for _, lf := range allLocalFiles {
		if lf.MediaID == 0 {
			continue
		}
		if _, ok := fileMap[lf.MediaID]; !ok {
			fileMap[lf.MediaID] = make(map[int]bool)
		}
		fileMap[lf.MediaID][lf.Metadata.Episode] = true
	}

	// Extract unique media IDs
	mediaIDs := make([]uint, 0, len(history))
	for _, h := range history {
		mediaIDs = append(mediaIDs, uint(h.MediaID))
	}

	// 1. Batch-fetch all parent LibraryMedia
	var mediaList []models.LibraryMedia
	if err := s.db.Gorm().Where("id IN (?)", mediaIDs).Find(&mediaList).Error; err != nil {
		return nil, err
	}
	mediaMap := make(map[uint]*models.LibraryMedia)
	for i := range mediaList {
		mediaMap[mediaList[i].ID] = &mediaList[i]
	}

	// 2. Batch-fetch all episodes for these media
	var episodeList []models.LibraryEpisode
	if err := s.db.Gorm().Where("library_media_id IN (?)", mediaIDs).Find(&episodeList).Error; err != nil {
		return nil, err
	}

	// Map episodes by media_id -> season_id -> episode_num for high performance lookups
	episodeMap := make(map[string]*models.LibraryEpisode)
	for i := range episodeList {
		key := fmt.Sprintf("%d_%d_%d", episodeList[i].LibraryMediaID, episodeList[i].SeasonNumber, episodeList[i].EpisodeNumber)
		episodeMap[key] = &episodeList[i]
	}

	items := make([]dto.ContinueWatchingItem, 0, len(history))

	for _, h := range history {
		progress := 0.0
		if h.Duration > 0 {
			progress = h.CurrentTime / h.Duration
		}

		media, ok := mediaMap[uint(h.MediaID)]
		if !ok {
			continue
		}

		// Find current episode in memory
		var currentEpisode *models.LibraryEpisode
		for i := range episodeList {
			if episodeList[i].LibraryMediaID == uint(h.MediaID) && episodeList[i].EpisodeNumber == h.EpisodeNumber {
				currentEpisode = &episodeList[i]
				break
			}
		}
		if currentEpisode == nil {
			continue
		}

		item := dto.ContinueWatchingItem{
			Media:           media,
			Episode:         currentEpisode,
			Progress:        progress,
			LastPlaybackPos: h.CurrentTime,
			IsNextEpisode:   false,
		}

		if progress >= 0.9 {
			// Find next episode in the same season: currentEpisode.EpisodeNumber + 1
			nextKey := fmt.Sprintf("%d_%d_%d", uint(h.MediaID), currentEpisode.SeasonNumber, currentEpisode.EpisodeNumber+1)
			nextEpisode, found := episodeMap[nextKey]
			if !found {
				// Try season + 1, episode 1
				nextKey = fmt.Sprintf("%d_%d_%d", uint(h.MediaID), currentEpisode.SeasonNumber+1, 1)
				nextEpisode, found = episodeMap[nextKey]
			}

			if found {
				if hasFile := fileMap[int(h.MediaID)][nextEpisode.EpisodeNumber]; hasFile {
					item.Episode = nextEpisode
					item.Progress = 0
					item.IsNextEpisode = true
				} else {
					continue
				}
			} else {
				continue
			}
		}

		items = append(items, item)
	}

	return items, nil
}

// GetCuratedSwimlanes returns the curated home swimlanes, including DB Intelligence lanes.
func (s *IntelligenceService) GetCuratedSwimlanes(_ context.Context) (*CuratedHomeResponse, error) {
	resp := &CuratedHomeResponse{
		Swimlanes: make([]*CuratedSwimlane, 0, 45),
	}

	// 1. Standard Collection Entry Points (Top priority)
	if lane := s.buildLocalLibraryLane(); lane != nil {
		resp.Swimlanes = append(resp.Swimlanes, lane)
	}

	if lane := s.buildEpicMomentsLane(); lane != nil {
		resp.Swimlanes = append(resp.Swimlanes, lane)
	}

	if lane := s.buildTrendingLane(); lane != nil {
		resp.Swimlanes = append(resp.Swimlanes, lane)
	}

	// 2. Curated Episode-level lanes by LibraryEpisode.suggested_swimlane
	// These values exactly match the output of IntelligenceTagger.suggestSwimlane().
	// Using LIKE '%substring%' queries so small encoding differences don't block results.
	epNameLanes := []struct {
		ID   string
		Name string // exact match with the suggestSwimlane() output
	}{
		// ── Combate y Transformaciones ──────────────────────────────────────────
		{"capitulos_imperdibles", "Capítulos Imperdibles: Las Batallas Más Épicas"},
		{"eleva_tu_ki_ep", "¡Eleva tu Ki!: Batallas que rompieron los límites"},
		{"transformaciones_saiyajin", "Más Allá del Límite: Transformaciones Saiyajin"},
		{"forma_final_villano", "Cuando el Villano Alcanza su Forma Final"},
		{"tecnicas_sacrificio", "El Último Recurso: Técnicas de Sacrificio"},
		{"tecnicas_letales", "Técnicas Letales: Sin Vuelta Atrás"},
		{"fusion_ha", "¡Fusión HA!: Las Uniones Más Poderosas"},
		{"espadachines", "Espadachines y Guerreros con Armas"},
		// ── Torneos ─────────────────────────────────────────────────────────────
		{"torneos_artes_marciales", "¡Fuera del Ring!: Los Grandes Torneos"},
		{"torneo_uranai_baba", "El Misterioso Torneo de Uranai Baba"},
		{"juegos_cell", "Los Juegos de Cell: El Torneo del Terror"},
		{"torneo_mas_alla", "Torneo del Más Allá: Combates en el Otro Mundo"},
		{"torneo_poder", "Torneo del Poder: Supervivencia Universal"},
		// ── Sagas y Facciones ───────────────────────────────────────────────────
		{"imperio_freezer", "El Imperio de Freezer: El Tirano del Universo"},
		{"patrulla_roja", "La Patrulla Roja: Androides y Cell"},
		{"saiyajins_legendarios", "Saiyajins Legendarios: El Poder Berserker"},
		{"los_saiyajins", "Los Saiyajins: La Raza Guerrera Más Poderosa"},
		{"los_tsufurujin", "Los Tsufurujin: La Venganza de Baby"},
		{"dragones_malignos", "Los Dragones Malignos: La Amenaza Final de GT"},
		{"dioses_destruccion", "Dioses y Entidades Supremas del Universo"},
		{"patrulla_galactica", "La Patrulla Galáctica: Policías del Cosmos"},
		{"guerreras_poderosas", "Guerreras Indomables del Universo"},
		{"nuevas_generaciones", "El Futuro: Las Nuevas Generaciones de Guerreros"},
		{"los_namekuseijin", "Los Namekuseijin: Guardianes de las Esferas"},
		// ── Sci-Fi y Aventura ───────────────────────────────────────────────────
		{"guardianes_tiempo", "Guardianes del Tiempo: Crónicas del Futuro"},
		{"cronicas_supervivencia", "Crónicas de Supervivencia: El Futuro en Llamas"},
		{"cruce_universos", "Multiverso: El Cruce de Universos"},
		{"invasion_tierra", "¡La Tierra Bajo Ataque! Invasiones Alienígenas"},
		{"viajes_espacio", "Más Allá de las Estrellas: Aventura Espacial"},
		{"busqueda_esferas", "Deseos Prohibidos y Dragones Sagrados"},
		// ── Magia y Sobrenatural ────────────────────────────────────────────────
		{"artes_oscuras_ep", "Artes Oscuras: Magia y Demonios"},
		{"maldicion_mini", "¡Encogidos! La Maldición Mini de Daima"},
		// ── Drama y Emociones ───────────────────────────────────────────────────
		{"sacrificio_heroico", "Cuando los Héroes lo Dan Todo: Sacrificios"},
		{"tension_absoluta", "Tensión Absoluta: Al Borde del Abismo"},
		{"romance_boda", "Amor en el Universo Dragon Ball"},
		{"gran_saiyaman", "Gran Saiyaman: El Héroe Enmascarado"},
		{"humor_relleno", "Momentos para Reír: El Lado Cómico del Universo"},
		// ── Entrenamiento ───────────────────────────────────────────────────────
		{"entrenamiento_divino", "Entrenamiento Divino: El Camino de los Dioses"},
		{"entrenamiento_extremo", "El Camino del Guerrero: Entrenamientos"},
		// ── Películas ───────────────────────────────────────────────────────────
		{"esencia_cinema_ep", "Esencia de Cinema: Películas Legendarias"},
	}

	for _, l := range epNameLanes {
		if lane := s.buildEpisodeSwimlaneByName(l.ID, l.Name); lane != nil {
			resp.Swimlanes = append(resp.Swimlanes, lane)
		}
	}

	// 2.2 Dynamic Tag-based swimlanes (Tags with >= 50 episodes)
	if tagLanes := s.BuildDynamicTagLanes(); len(tagLanes) > 0 {
		resp.Swimlanes = append(resp.Swimlanes, tagLanes...)
	}

	// 3. Essential Cinema (Beautiful closing row focusing on Movies and OVAs)
	if lane := s.buildEssentialCinemaLane(); lane != nil {
		resp.Swimlanes = append(resp.Swimlanes, lane)
	}

	return resp, nil
}

func (s *IntelligenceService) buildIntelligenceLane(id, title string) *CuratedSwimlane {
	var media []*models.LibraryMedia
	hasFiles := s.db.Gorm().Model(&models.LocalFile{}).Select("1").
		Where("library_media_id = library_media.id AND library_media_id > 0").Limit(1)
	// Search by SuggestedSwimlane matching the title, only for media with local files
	if err := s.db.Gorm().
		Omit("description", "synonyms", "audio_tracks", "subtitle_tracks").
		Where("EXISTS (?) AND suggested_swimlane = ?", hasFiles, title).
		Order("score DESC").
		Limit(20).
		Find(&media).Error; err != nil || len(media) == 0 {
		return nil
	}

	lane := &CuratedSwimlane{
		ID:      id,
		Title:   title,
		Type:    "intelligence",
		Entries: make([]*LibraryCollectionEntry, 0, len(media)),
	}
	for _, m := range media {
		// Skip media stubs: must have a real poster image and a resolved title
		if m.PosterImage == "" || m.GetPreferredTitle() == "" {
			continue
		}
		lane.Entries = append(lane.Entries, &LibraryCollectionEntry{
			Media:            m,
			MediaID:          int(m.ID),
			AvailabilityType: "HYBRID",
		})
	}
	if len(lane.Entries) == 0 {
		return nil
	}
	return lane
}

func (s *IntelligenceService) buildEpisodeTagLane(id, title, tag string) *CuratedSwimlane {
	var localFiles []*models.LocalFile
	// Querying SQLite JSON string slice using LIKE
	query := fmt.Sprintf(`%%"%s"%%`, tag)
	if err := s.db.Gorm().
		Where("tags LIKE ?", query).
		Limit(20).
		Find(&localFiles).Error; err != nil || len(localFiles) == 0 {
		return nil
	}

	lane := &CuratedSwimlane{
		ID:      id,
		Title:   title,
		Type:    "episode_tag",
		Entries: make([]*LibraryCollectionEntry, 0, len(localFiles)),
	}

	// We need to keep track of added episodes to avoid duplicates if tags are weird
	added := make(map[uint]bool)

	for _, lf := range localFiles {
		// Attempt to resolve LibraryMedia
		var media models.LibraryMedia
		if err := s.db.Gorm().Where("id = ?", lf.LibraryMediaId).First(&media).Error; err != nil {
			continue
		}

		// Attempt to resolve LibraryEpisode
		// Since we have lf.Metadata.Episode inside parsed info, we need a reliable way to map it.
		// LocalFile has MediaID, but to find LibraryEpisode we need LibraryMediaID and EpisodeNumber.
		
		// To safely extract episode number from lf, we can use the TechnicalInfo or ParsedData.
		// However, a simpler query is to match by name or by scanning all episodes for this media.
		// Wait, a more straightforward way is to fetch the episode based on metadata episode number.
		// But in Kamehouse, LocalFiles might not easily link to LibraryEpisode without parsing JSON.
		// Let's use a subquery or directly query LibraryEpisode where tags match? 
		// Actually, tags are stored on LocalFile, not LibraryEpisode.
		// Let's assume the LocalFile Name contains the episode number or it's just the first match.
		// Actually, let's query LibraryEpisode directly joining with LocalFile if needed.
		// No, let's just parse the Episode number from ParsedData.
		
		// Unmarshal ParsedData to get the Episode number
		var parsedInfo struct {
			Episode int `json:"episode"`
		}
		if len(lf.ParsedData) > 0 {
			_ = json.Unmarshal(lf.ParsedData, &parsedInfo)
		}

		var episode models.LibraryEpisode
		if parsedInfo.Episode > 0 {
			if err := s.db.Gorm().Where("library_media_id = ? AND episode_number = ?", media.ID, parsedInfo.Episode).First(&episode).Error; err != nil {
				continue
			}
		} else {
			continue
		}

		if added[episode.ID] {
			continue
		}
		// Skip media stubs without a real poster image
		if media.PosterImage == "" || media.GetPreferredTitle() == "" {
			continue
		}
		added[episode.ID] = true

		lane.Entries = append(lane.Entries, &LibraryCollectionEntry{
			Media:            &media,
			MediaID:          int(media.ID),
			Episode:          &episode,
			AvailabilityType: "FULL_LOCAL",
		})
	}

	if len(lane.Entries) == 0 {
		return nil
	}

	return lane
}

var curatedHomeCache = cache.NewCache[*CuratedHomeResponse](30 * time.Minute)
var dynamicTagLanesCache = cache.NewCache[[]*CuratedSwimlane](30 * time.Minute)

// InvalidateCuratedHomeCache clears the thread-safe in-memory cache for the curated home swimlanes.
func InvalidateCuratedHomeCache() {
	curatedHomeCache.Clear()
	dynamicTagLanesCache.Clear()
}

func GetCuratedHome(_ context.Context, database *db.Database) (*CuratedHomeResponse, error) {
	cacheKey := "curated_home"
	if cached, ok := curatedHomeCache.Get(cacheKey); ok && cached != nil {
		return cached, nil
	}

	svc := NewIntelligenceService(database, nil, nil)
	resp, err := svc.GetCuratedSwimlanes(context.Background())
	if err != nil {
		return nil, err
	}

	curatedHomeCache.Set(cacheKey, resp)
	return resp, nil
}

// buildEpisodeSwimlaneByTag builds a swimlane of LibraryEpisodes whose tags JSON array
// contains the given tag string (SQLite JSON LIKE). Enriches each entry with its parent
// LibraryMedia so the frontend can display series name + episode image.
func (s *IntelligenceService) buildEpisodeSwimlaneByTag(id, title, tag string) *CuratedSwimlane {
	query := fmt.Sprintf(`%%"%s"%%`, tag)
	var episodes []models.LibraryEpisode
	if err := s.db.Gorm().
		Where("tags LIKE ?", query).
		Order("episode_number ASC").
		Limit(20).
		Find(&episodes).Error; err != nil || len(episodes) == 0 {
		return nil
	}

	// Batch-fetch all parent LibraryMedia records
	mediaIDs := make([]uint, 0, len(episodes))
	for _, ep := range episodes {
		mediaIDs = append(mediaIDs, ep.LibraryMediaID)
	}

	var mediaList []models.LibraryMedia
	if err := s.db.Gorm().
		Omit("description", "synonyms", "audio_tracks", "subtitle_tracks").
		Where("id IN (?)", mediaIDs).
		Find(&mediaList).Error; err != nil {
		return nil
	}

	mediaMap := make(map[uint]*models.LibraryMedia)
	for i := range mediaList {
		mediaMap[mediaList[i].ID] = &mediaList[i]
	}

	lane := &CuratedSwimlane{
		ID:      id,
		Title:   title,
		Type:    "episode_tag",
		Entries: make([]*LibraryCollectionEntry, 0, len(episodes)),
	}

	added := make(map[uint]bool)
	for i := range episodes {
		ep := &episodes[i]
		if added[ep.ID] {
			continue
		}
		media, ok := mediaMap[ep.LibraryMediaID]
		if !ok {
			continue
		}
		// Skip media stubs: must have a real poster image and a resolved title
		if media.PosterImage == "" || media.GetPreferredTitle() == "" {
			continue
		}
		added[ep.ID] = true
		lane.Entries = append(lane.Entries, &LibraryCollectionEntry{
			Media:            media,
			MediaID:          int(media.ID),
			Episode:          ep,
			AvailabilityType: "FULL_LOCAL",
		})
	}

	if len(lane.Entries) == 0 {
		return nil
	}
	return lane
}

// buildEpisodeSwimlaneByName builds a swimlane of LibraryEpisodes whose suggested_swimlane
// matches the given name.
func (s *IntelligenceService) buildEpisodeSwimlaneByName(id, name string) *CuratedSwimlane {
	var episodes []models.LibraryEpisode
	if err := s.db.Gorm().
		Where("suggested_swimlane = ?", name).
		Order("episode_number ASC").
		Limit(20).
		Find(&episodes).Error; err != nil || len(episodes) == 0 {
		return nil
	}

	// Use the actual suggested_swimlane from the DB as the lane title
	title := name
	if episodes[0].SuggestedSwimlane != "" {
		title = episodes[0].SuggestedSwimlane
	}

	// Batch-fetch all parent LibraryMedia records
	mediaIDs := make([]uint, 0, len(episodes))
	for _, ep := range episodes {
		mediaIDs = append(mediaIDs, ep.LibraryMediaID)
	}

	var mediaList []models.LibraryMedia
	if err := s.db.Gorm().
		Omit("description", "synonyms", "audio_tracks", "subtitle_tracks").
		Where("id IN (?)", mediaIDs).
		Find(&mediaList).Error; err != nil {
		return nil
	}

	mediaMap := make(map[uint]*models.LibraryMedia)
	for i := range mediaList {
		mediaMap[mediaList[i].ID] = &mediaList[i]
	}

	lane := &CuratedSwimlane{
		ID:      id,
		Title:   title,
		Type:    "episode_tag",
		Entries: make([]*LibraryCollectionEntry, 0, len(episodes)),
	}

	added := make(map[uint]bool)
	for i := range episodes {
		ep := &episodes[i]
		if added[ep.ID] {
			continue
		}
		media, ok := mediaMap[ep.LibraryMediaID]
		if !ok {
			continue
		}
		// Skip media stubs: must have a real poster image and a resolved title
		if media.PosterImage == "" || media.GetPreferredTitle() == "" {
			continue
		}
		added[ep.ID] = true
		lane.Entries = append(lane.Entries, &LibraryCollectionEntry{
			Media:            media,
			MediaID:          int(media.ID),
			Episode:          ep,
			AvailabilityType: "FULL_LOCAL",
		})
	}

	if len(lane.Entries) == 0 {
		return nil
	}
	return lane
}

func (s *IntelligenceService) buildLocalLibraryLane() *CuratedSwimlane {
	var media []*models.LibraryMedia
	// Only show media that has at least one local file in the collection
	hasFiles := s.db.Gorm().Model(&models.LocalFile{}).Select("1").
		Where("library_media_id = library_media.id AND library_media_id > 0").Limit(1)
	if err := s.db.Gorm().
		Omit("description", "synonyms", "audio_tracks", "subtitle_tracks").
		Where("EXISTS (?)", hasFiles).
		Order("updated_at DESC").
		Limit(40).
		Find(&media).Error; err != nil || len(media) == 0 {
		return nil
	}
	lane := &CuratedSwimlane{
		ID:      "local_library",
		Title:   "Tu Videoteca Local",
		Type:    "local_library",
		Entries: make([]*LibraryCollectionEntry, 0, len(media)),
	}
	for _, m := range media {
		if m.PosterImage == "" || m.GetPreferredTitle() == "" {
			continue
		}
		lane.Entries = append(lane.Entries, &LibraryCollectionEntry{
			Media:            m,
			MediaID:          int(m.ID),
			AvailabilityType: "FULL_LOCAL",
		})
	}
	if len(lane.Entries) == 0 {
		return nil
	}
	return lane
}

func (s *IntelligenceService) buildEpicMomentsLane() *CuratedSwimlane {
	var media []*models.LibraryMedia
	hasFiles := s.db.Gorm().Model(&models.LocalFile{}).Select("1").
		Where("library_media_id = library_media.id AND library_media_id > 0").Limit(1)
	if err := s.db.Gorm().
		Omit("description", "synonyms", "audio_tracks", "subtitle_tracks").
		Where("EXISTS (?) AND score >= ?", hasFiles, epicScoreThreshold).
		Order("score DESC").
		Limit(40).
		Find(&media).Error; err != nil || len(media) == 0 {
		return nil
	}
	lane := &CuratedSwimlane{
		ID:      "epic_moments",
		Title:   "Sagas Legendarias y Épicas",
		Type:    "epic_moments",
		Entries: make([]*LibraryCollectionEntry, 0, len(media)),
	}
	for _, m := range media {
		if m.PosterImage == "" || m.GetPreferredTitle() == "" {
			continue
		}
		lane.Entries = append(lane.Entries, &LibraryCollectionEntry{
			Media:            m,
			MediaID:          int(m.ID),
			AvailabilityType: "HYBRID",
		})
	}
	if len(lane.Entries) == 0 {
		return nil
	}
	return lane
}

func (s *IntelligenceService) buildEssentialCinemaLane() *CuratedSwimlane {
	var media []*models.LibraryMedia
	hasFiles := s.db.Gorm().Model(&models.LocalFile{}).Select("1").
		Where("library_media_id = library_media.id AND library_media_id > 0").Limit(1)
	if err := s.db.Gorm().
		Omit("description", "synonyms", "audio_tracks", "subtitle_tracks").
		Where("EXISTS (?) AND format IN ?", hasFiles, []string{"MOVIE", "OVA", "SPECIAL"}).
		Order("score DESC").
		Limit(30).
		Find(&media).Error; err != nil || len(media) == 0 {
		return nil
	}
	lane := &CuratedSwimlane{
		ID:      "essential_cinema",
		Title:   "Cine Esencial: Películas Dragon Ball",
		Type:    "essential_cinema",
		Entries: make([]*LibraryCollectionEntry, 0, len(media)),
	}
	for _, m := range media {
		if m.PosterImage == "" || m.GetPreferredTitle() == "" {
			continue
		}
		lane.Entries = append(lane.Entries, &LibraryCollectionEntry{
			Media:            m,
			MediaID:          int(m.ID),
			AvailabilityType: "FULL_LOCAL",
		})
	}
	if len(lane.Entries) == 0 {
		return nil
	}
	return lane
}

func (s *IntelligenceService) buildTrendingLane() *CuratedSwimlane {
	// Shows Dragon Ball series sorted by recently added to the collection
	var media []*models.LibraryMedia
	hasFiles := s.db.Gorm().Model(&models.LocalFile{}).Select("1").
		Where("library_media_id = library_media.id AND library_media_id > 0").Limit(1)
	if err := s.db.Gorm().
		Omit("description", "synonyms", "audio_tracks", "subtitle_tracks").
		Where("EXISTS (?) AND format = ?", hasFiles, "TV").
		Order("created_at DESC").
		Limit(20).
		Find(&media).Error; err != nil || len(media) == 0 {
		return nil
	}
	lane := &CuratedSwimlane{
		ID:      "trending",
		Title:   "Series Dragon Ball: Tu Colección",
		Type:    "trending",
		Entries: make([]*LibraryCollectionEntry, 0, len(media)),
	}
	for _, m := range media {
		if m.PosterImage == "" || m.GetPreferredTitle() == "" {
			continue
		}
		lane.Entries = append(lane.Entries, &LibraryCollectionEntry{
			Media:            m,
			MediaID:          int(m.ID),
			AvailabilityType: "FULL_LOCAL",
		})
	}
	if len(lane.Entries) == 0 {
		return nil
	}
	return lane
}
