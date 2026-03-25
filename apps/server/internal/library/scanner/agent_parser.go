package scanner

import (
	"fmt"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/parser"
	"strings"
)

type MediaMatch struct {
	ParsedMedia parser.ParsedMedia
	OriginalPath string
	Filename     string
	CleanTitle   string
	ReleaseGroup string
	Resolution   string
	Season       int
	Episode      int
	IsSpecial    bool
	Synopsis   string
	PosterURL  string
	ExternalID string
	Confidence float64
	SelfHealed bool
	Error      error
}

var (
	// No longer needed as regex logic moved to internal/library/parser
)

// Normalize passes the raw filename directly to the robust Regex parser.
func Normalize(path string) parser.ParsedMedia {
	return parser.Parse(path)
}

// NormalizeAndScore evaluates the Tokenized string, cross-checks context, calculates
// confidence, and decides whether "Self Healing" string manipulation is necessary.
func (a *ScannerAgent) ScoreAndResolve(pm parser.ParsedMedia, originalPath string) MediaMatch {
	match := MediaMatch{
		ParsedMedia:  pm,
		OriginalPath: originalPath,
	}

	// If we have a real media catalog, use Bayesian scoring against it
	if a.mediaContainer != nil && len(a.mediaContainer.NormalizedMedia) > 0 {
		bestConfidence := 0.0
		var bestMedia *dto.NormalizedMedia

		for _, media := range a.mediaContainer.NormalizedMedia {
			confidence := agentCalculateBayesianScore(pm, media)
			if confidence > bestConfidence {
				bestConfidence = confidence
				bestMedia = media
			}
		}

		match.Confidence = bestConfidence

		// Self-healing: if confidence is low, try sanitizing sub-group tags
		if bestConfidence < a.config.MinConfidence {
			match.SelfHealed = true
			healedTitle := sanitizeSubGroupTags(pm.Title)
			if healedTitle != pm.Title {
				healedPM := pm
				healedPM.Title = healedTitle
				for _, media := range a.mediaContainer.NormalizedMedia {
					conf := agentCalculateBayesianScore(healedPM, media)
					if conf > bestConfidence {
						bestConfidence = conf
						bestMedia = media
						match.Confidence = conf
					}
				}
			}
		}

		if bestMedia != nil && bestConfidence >= a.config.MinConfidence {
			match.ExternalID = fmt.Sprintf("AL:%d", bestMedia.ID)
		} else {
			match.ExternalID = "UNMATCHED"
		}

		return match
	}

	// FALLBACK: Mock scoring when no media catalog is available
	baseLength := float64(len(pm.Title) * 2)
	match.Confidence = baseLength / 100.0

	if match.Confidence >= 1.0 {
		match.Confidence = 1.0
	}

	if match.Confidence < a.config.MinConfidence {
		match.SelfHealed = true
		if pm.Season == 0 && pm.Episode == 0 {
			match.Confidence += 0.20
		}
		healedTitle := strings.ReplaceAll(pm.Title, "Part ", "Cour ")
		if strings.Contains(healedTitle, "Cour") {
			match.CleanTitle = healedTitle
			match.Confidence += 0.15
		}
	}

	if match.Confidence > 1.0 {
		match.Confidence = 1.0
	}

	if match.Confidence >= a.config.MinConfidence {
		match.ExternalID = "AL:00000"
	} else {
		match.ExternalID = "UNMATCHED"
	}

	return match
}

// agentCalculateBayesianScore is the ScannerAgent's version of Bayesian scoring.
// It mirrors matcher.calculateBayesianScore but works with ParsedMedia instead of LocalFile.
func agentCalculateBayesianScore(pm parser.ParsedMedia, media *dto.NormalizedMedia) float64 {
	prior := 0.50

	// Evidence 1: Dice similarity across all titles and synonyms
	bestDice := 0.0
	candidateTitles := make([]string, 0, len(media.Synonyms)+4)
	if media.Title != nil {
		if media.Title.Romaji != nil && *media.Title.Romaji != "" {
			candidateTitles = append(candidateTitles, *media.Title.Romaji)
		}
		if media.Title.English != nil && *media.Title.English != "" {
			candidateTitles = append(candidateTitles, *media.Title.English)
		}
		if media.Title.Native != nil && *media.Title.Native != "" {
			candidateTitles = append(candidateTitles, *media.Title.Native)
		}
		if media.Title.UserPreferred != nil && *media.Title.UserPreferred != "" {
			candidateTitles = append(candidateTitles, *media.Title.UserPreferred)
		}
	}
	for _, alias := range media.Synonyms {
		if alias != nil && *alias != "" {
			candidateTitles = append(candidateTitles, *alias)
		}
	}
	for _, title := range candidateTitles {
		sim := calculateDice(pm.Title, title)
		if sim > bestDice {
			bestDice = sim
		}
	}

	posterior := updateBayes(prior, bestDice, 0.20)

	// DBZ OVERRIDE: Check if the parsed title guarantees a match to this specific media
	if dbId, isDb := ResolveDragonBallID(pm.Title); isDb {
		if media.TmdbId != nil && *media.TmdbId == dbId {
			bestDice = 1.0
			posterior = 1.0
		}
	}

	// Evidence 2: Season matching
	if pm.Season > 1 && media.Format != nil && string(*media.Format) == "TV" {
		posterior = updateBayes(posterior, 0.90, 0.10)
	}

	// Evidence 3: Special/OVA detection
	if pm.Season == 0 && pm.Episode == 0 {
		if media.Format != nil && (string(*media.Format) == "OVA" || string(*media.Format) == "SPECIAL" || string(*media.Format) == "MOVIE") {
			posterior = updateBayes(posterior, 0.95, 0.50)
		} else {
			posterior = updateBayes(posterior, 0.10, 0.80)
		}
	}

	// Evidence 4: Year contextual inference
	fileYear := extractYear(pm.Title)
	if fileYear > 0 && media.StartDate != nil && media.StartDate.Year != nil {
		if fileYear == *media.StartDate.Year {
			posterior = updateBayes(posterior, 0.95, 0.10)
		} else {
			posterior = updateBayes(posterior, 0.30, 0.60)
		}
	}

	// Evidence 5: Movie Fallback Padding
	if media.Format != nil && string(*media.Format) == "MOVIE" && bestDice >= 0.45 {
		posterior = updateBayes(posterior, 0.85, 0.15)
	}

	return posterior
}

// Utility: parseFallbackInt stops Go from panicking if string conversion gets complex
func parseFallbackInt(s string, fallback int) int {
	var val int
	fmt.Sscanf(s, "%d", &val)
	if val == 0 {
		return fallback
	}
	return val
}
