package anime

import (
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/util/cache"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

// ─────────────────────────────────────────────────────────────────────────────
// Content tagging types
// ─────────────────────────────────────────────────────────────────────────────

// ContentTag classifies an episode's narrative role.
type ContentTag string

const (
	TagFiller ContentTag = "FILLER" // Non-canon padding content
	TagEpic   ContentTag = "EPIC"   // Outstanding episode (score > 8.5 / 85 on 0-100 scale)
	TagCanon  ContentTag = "CANON"  // Default canon episode
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
// IDs: Dragon Ball (12609), Dragon Ball Z (12971), Dragon Ball GT (12697)
// Dragon Ball Super (62715), Dragon Ball Daima (236994)
var dragonBallArcs = map[int][]arcRange{
	// ─── Dragon Ball (12609) ──────────────────────────────────────────
	12609: {
		{1, 13, "Saga de Pilaf"},
		{14, 28, "21° Torneo de Artes Marciales"},
		{29, 68, "Saga de la Patrulla Roja"},
		{69, 82, "Saga de Uranai Baba"},
		{83, 101, "22° Torneo de Artes Marciales"},
		{102, 122, "Saga de Piccolo Daimaku"},
		{123, 153, "Saga de Piccolo Jr."},
	},
	// ─── Dragon Ball Z (12971) ────────────────────────────────────────
	12971: {
		{1, 35, "Saga de los Saiyajin"},
		{36, 107, "Saga de Freezer"},
		{108, 117, "Saga de Garlic Jr."},
		{118, 139, "Saga de los Androides"},
		{140, 194, "Saga de Cell"},
		{195, 199, "Torneo del Otro Mundo"},
		{200, 291, "Saga de Majin Buu"},
	},
	// ─── Dragon Ball Kai (61709 / 42705) ──────────────────────────────
	61709: {
		{1, 17, "Saga de los Saiyajin"},
		{18, 54, "Saga de Freezer"},
		{55, 98, "Saga de los Androides y Cell"},
		{99, 167, "Saga de Majin Buu"},
	},
	42705: {
		{1, 17, "Saga de los Saiyajin"},
		{18, 54, "Saga de Freezer"},
		{55, 98, "Saga de los Androides y Cell"},
		{99, 167, "Saga de Majin Buu"},
	},
	// ─── Dragon Ball GT (12697) ───────────────────────────────────────
	12697: {
		{1, 16, "Saga de las Esferas Definitivas"},
		{17, 40, "Saga de Baby"},
		{41, 47, "Saga de Super 17"},
		{48, 64, "Saga de los Dragones Malignos"},
	},
	// ─── Dragon Ball Super (62715) ────────────────────────────────────
	62715: {
		{1, 14, "Saga de la Batalla de los Dioses"},
		{15, 27, "Saga de la Resurrección de F"},
		{28, 41, "Saga del Torneo del Universo 6"},
		{42, 46, "Saga del Agua Sobrenatural (Vegeta Copia)"},
		{47, 76, "Saga de Goku Black"},
		{77, 81, "Saga de Exhibición Zen"},
		{82, 96, "Saga de Reclutamiento"},
		{97, 131, "Saga del Torneo del Poder"},
	},
	// ─── Dragon Ball Daima (236994) ───────────────────────────────────
	236994: {
		{1, 10, "El Misterio del Mundo Demonio"},
		{11, 20, "La Travesía en el Mundo Demonio"},
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
	db *db.Database
	fm FillerChecker // may be nil when filler data is not yet loaded

	// scoringMedia memoriza (30 s) el LibraryMedia con el que se puntúa cada episodio.
	scoringMedia *cache.Cache[*models.LibraryMedia]
}

// NewIntelligenceService constructs the service.
// fm may be nil; when nil, filler detection is skipped gracefully.
func NewIntelligenceService(database *db.Database, fm FillerChecker, _ *zerolog.Logger) *IntelligenceService {
	return &IntelligenceService{
		db:           database,
		fm:           fm,
		scoringMedia: cache.NewCache[*models.LibraryMedia](30*time.Second, 512),
	}
}

// lookupScoringMedia resuelve el LibraryMedia con el que se puntúa un episodio
// (primero por tmdb_id y, si no existe, por id). Solo trae las columnas que usa
// computeIntelligence (score y genres) y memoriza el resultado, incluido el "no
// encontrado", para no repetir 1-2 consultas por cada episodio de la serie.
func (s *IntelligenceService) lookupScoringMedia(mediaID int) *models.LibraryMedia {
	key := strconv.Itoa(mediaID)
	if s.scoringMedia != nil {
		if cached, ok := s.scoringMedia.Get(key); ok {
			return cached
		}
	}

	var found *models.LibraryMedia
	var m models.LibraryMedia
	if err := s.db.Gorm().Select("id", "score", "genres").Where("tmdb_id = ?", mediaID).First(&m).Error; err == nil {
		found = &m
	} else if err := s.db.Gorm().Select("id", "score", "genres").Where("id = ?", mediaID).First(&m).Error; err == nil {
		found = &m
	}

	if s.scoringMedia != nil {
		s.scoringMedia.Set(key, found)
	}
	return found
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

	// ── Rating + Epic detection + Vibe derivation ────────────────────
	var media *models.LibraryMedia
	func() {
		defer func() { recover() }() //nolint:errcheck
		media = s.lookupScoringMedia(mediaID)
		if media != nil {
			if media.Score > 0 {
				intel.Rating = float64(media.Score) / 10.0
			}
			// Override to Epic only when not already classified as Filler.
			if media.Score >= epicScoreThreshold && intel.Tag != TagFiller {
				intel.Tag = TagEpic
			}
		}
	}()

	// ── Arc grouping ─────────────────────────────────────────────────
	intel.ArcName = resolveArc(mediaID, episodeNum)

	// ── Vibe derivation ──────────────────────────────────────────────
	if media != nil {
		intel.Vibes = s.DeriveSeriesVibes(media)
	} else {
		intel.Vibes = make([]string, 0)
	}

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
