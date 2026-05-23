package anime

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// tagTitleMappings associates tag names with user-friendly Spanish swimlane titles.
var tagTitleMappings = map[string]string{
	"Súper Saiyajin":           "El Poder del Súper Saiyajin",
	"Batalla Épica":            "Duelos y Combates Legendarios",
	"Fusión de Guerreros":      "¡Fusión HA!: Guerreros Fusionados",
	"Búsqueda de las Esferas":  "La Búsqueda de las Esferas del Dragón",
	"Artes Marciales Clásicas": "Torneos y Artes Marciales Clásicas",
	"El Imperio de Freezer":    "La Tiranía del Imperio de Freezer",
	"La Patrulla Roja":         "La Amenaza de la Patrulla Roja",
	"Mundo de los Demonios":    "Combates en el Reino de los Demonios",
	"Viajes en el Tiempo":      "Líneas Temporales y Viajes en el Tiempo",
	"Viajes por el Espacio":    "Aventura y Viajes por el Espacio",
	"Dioses de la Destrucción": "Entidades Divinas y Dioses de la Destrucción",
	"Nuevas Generaciones":      "El Futuro Z: Nuevas Generaciones",
	"Entrenamiento Extremo":    "El Camino del Guerrero Z: Entrenamiento",
	"Vida Cotidiana":           "Momentos de Vida Cotidiana",
	"Humor y Relleno":          "Comedia y Momentos Divertidos",
	"Técnicas de Ki":           "Técnicas de Ki Especiales",
	"Técnicas Letales":         "Técnicas Letales y Peligrosas",
}

// tagToID converts a tag name into a clean, safe, lowercase ID format.
func tagToID(tag string) string {
	slug := strings.ToLower(tag)
	slug = strings.ReplaceAll(slug, " ", "_")
	slug = strings.ReplaceAll(slug, "ú", "u")
	slug = strings.ReplaceAll(slug, "á", "a")
	slug = strings.ReplaceAll(slug, "é", "e")
	slug = strings.ReplaceAll(slug, "í", "i")
	slug = strings.ReplaceAll(slug, "ó", "o")
	slug = strings.ReplaceAll(slug, "ñ", "n")
	slug = strings.ReplaceAll(slug, "¡", "")
	slug = strings.ReplaceAll(slug, "!", "")
	slug = strings.ReplaceAll(slug, ":", "")
	return "tag_" + slug
}

type tagCount struct {
	tag   string
	count int
}

// BuildDynamicTagLanes queries the database for all episode tags, aggregates them,
// filters for tags associated with 50 or more episodes, and constructs swimlanes for them.
func (s *IntelligenceService) BuildDynamicTagLanes() []*CuratedSwimlane {
	if cached, ok := dynamicTagLanesCache.Get("dynamic_tag_lanes"); ok && cached != nil {
		return cached
	}

	var results []struct {
		Tags string `gorm:"column:tags"`
	}
	if err := s.db.Gorm().Table("library_episodes").
		Select("tags").
		Where("tags IS NOT NULL AND tags != '' AND tags != '[]' AND tags != 'null'").
		Find(&results).Error; err != nil {
		s.logger.Error().Err(err).Msg("tag_lanes: failed to fetch tags from library_episodes")
		return nil
	}

	counts := make(map[string]int)
	for _, res := range results {
		if res.Tags == "" || res.Tags == "null" {
			continue
		}
		var list []string
		if err := json.Unmarshal([]byte(res.Tags), &list); err == nil {
			for _, t := range list {
				counts[t]++
			}
		}
	}

	var tagCounts []tagCount
	for tag, count := range counts {
		// Filter tags that are associated with 50 or more episodes
		if count >= 50 {
			tagCounts = append(tagCounts, tagCount{tag: tag, count: count})
		}
	}

	// Sort tags by frequency descending to prioritize highly popular categories
	sort.Slice(tagCounts, func(i, j int) bool {
		return tagCounts[i].count > tagCounts[j].count
	})

	var lanes []*CuratedSwimlane
	for _, tc := range tagCounts {
		// Get a friendly title or fall back to the tag name
		title, ok := tagTitleMappings[tc.tag]
		if !ok {
			title = fmt.Sprintf("Colección: %s", tc.tag)
		}

		laneID := tagToID(tc.tag)
		if lane := s.buildEpisodeSwimlaneByTag(laneID, title, tc.tag); lane != nil {
			lanes = append(lanes, lane)
		}
	}

	dynamicTagLanesCache.Set("dynamic_tag_lanes", lanes)
	return lanes
}
