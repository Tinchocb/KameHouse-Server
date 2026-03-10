package scanner

import (
	"fmt"
	"kamehouse/internal/database/models/dto"
	"path/filepath"
	"regexp"
	"strings"
)

// Data Structures defining the AI workflow
type ParsedMedia struct {
	OriginalPath string
	Filename     string
	CleanTitle   string
	ReleaseGroup string
	Resolution   string
	Season       int
	Episode      int
	IsSpecial    bool
}

type MediaMatch struct {
	ParsedMedia
	ExternalID string
	Confidence float64
	SelfHealed bool
	Error      error
}

var (
	// Greedy regex pre-compiled to avoid allocation overhead on parallel runs
	reGroup      = regexp.MustCompile(`^\[([^\]]+)\]`)
	reResolution = regexp.MustCompile(`(?i)(1080p|720p|480p|2160p|4k)`)
	reEpisode    = regexp.MustCompile(`(?i)(?:-?\s|e|ep|v)(\d{2,4})(?:v\d)?\b`)
	reSeason     = regexp.MustCompile(`(?i)S(\d{1,2})`)
)

// Normalize is a lightweight tokenizer that extracts chaos (like 1080p, [SubsPlease], etc.)
// into clean properties without loading massive NLP models into RAM.
func Normalize(path string) ParsedMedia {
	filename := filepath.Base(path)
	filenameNoExt := strings.TrimSuffix(filename, filepath.Ext(filename))

	pm := ParsedMedia{
		OriginalPath: path,
		Filename:     filename,
		Season:       1, // Base assumption unless proven otherwise
	}

	workingStr := filenameNoExt

	// 1. Extract Release Group (greedily remove it so it doesn't pollute the Title)
	if loc := reGroup.FindStringSubmatch(workingStr); len(loc) > 1 {
		pm.ReleaseGroup = loc[1]
		workingStr = strings.Replace(workingStr, loc[0], "", 1)
	}

	// 1b. Strip fan-edit tokens (e.g. "by Seldion", "Saga Saiyajin") into ReleaseGroup
	if stripped := StripFanEditTokens(workingStr); stripped != workingStr {
		if pm.ReleaseGroup == "" {
			pm.ReleaseGroup = "fan-edit"
		}
		workingStr = stripped
	}

	// 2. Resolution stripping
	if loc := reResolution.FindStringSubmatch(workingStr); len(loc) > 1 {
		pm.Resolution = loc[1]
		workingStr = strings.Replace(workingStr, loc[0], "", 1)
	}

	// 3. Season stripping
	if loc := reSeason.FindStringSubmatch(workingStr); len(loc) > 1 {
		pm.Season = parseFallbackInt(loc[1], 1)
		workingStr = strings.Replace(workingStr, loc[0], "", 1)
	}

	// 4. Episode Parsing
	if loc := reEpisode.FindStringSubmatch(workingStr); len(loc) > 1 {
		pm.Episode = parseFallbackInt(loc[1], 0)
		workingStr = strings.Replace(workingStr, loc[0], "", 1)
	}

	// 5. Special/OVA categorization
	lowerName := strings.ToLower(workingStr)
	if strings.Contains(lowerName, "ova") || strings.Contains(lowerName, "special") || strings.Contains(lowerName, "extra") {
		pm.IsSpecial = true
	}

	// 6. Linguistic Polish (Removes leftover underscores, CRC tags `[A1B2C3D4]`, parens)
	clean := regexp.MustCompile(`[\[\]\(\)_]`).ReplaceAllString(workingStr, " ")
	clean = regexp.MustCompile(`[[:xdigit:]]{8}`).ReplaceAllString(clean, "") // Remove 8-char CRC hashes
	clean = strings.Join(strings.Fields(clean), " ")                          // Normalize massive spacing

	pm.CleanTitle = strings.TrimSpace(clean)
	return pm
}

// NormalizeAndScore evaluates the Tokenized string, cross-checks context, calculates
// confidence, and decides whether "Self Healing" string manipulation is necessary.
func (a *ScannerAgent) ScoreAndResolve(pm ParsedMedia) MediaMatch {
	match := MediaMatch{
		ParsedMedia: pm,
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
			healedTitle := sanitizeSubGroupTags(pm.CleanTitle)
			if healedTitle != pm.CleanTitle {
				healedPM := pm
				healedPM.CleanTitle = healedTitle
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
	baseLength := float64(len(pm.CleanTitle) * 2)
	match.Confidence = baseLength / 100.0

	if match.Confidence >= 1.0 {
		match.Confidence = 1.0
	}

	if match.Confidence < a.config.MinConfidence {
		match.SelfHealed = true
		if pm.IsSpecial {
			match.Confidence += 0.20
		}
		healedTitle := strings.ReplaceAll(pm.CleanTitle, "Part ", "Cour ")
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
func agentCalculateBayesianScore(pm ParsedMedia, media *dto.NormalizedMedia) float64 {
	prior := 0.50

	// Evidence 1: Dice similarity across all synonyms
	bestDice := 0.0
	for _, alias := range media.Synonyms {
		sim := calculateDice(pm.CleanTitle, *alias)
		if sim > bestDice {
			bestDice = sim
		}
	}
	posterior := updateBayes(prior, bestDice, 0.20)

	// Evidence 2: Season matching
	if pm.Season > 1 && media.Format != nil && string(*media.Format) == "TV" {
		posterior = updateBayes(posterior, 0.90, 0.10)
	}

	// Evidence 3: Special/OVA detection
	if pm.IsSpecial {
		if media.Format != nil && (string(*media.Format) == "OVA" || string(*media.Format) == "SPECIAL") {
			posterior = updateBayes(posterior, 0.95, 0.50)
		} else {
			posterior = updateBayes(posterior, 0.10, 0.80)
		}
	}

	// Evidence 4: Year contextual inference
	fileYear := extractYear(pm.CleanTitle)
	if fileYear > 0 && media.StartDate != nil && media.StartDate.Year != nil {
		if fileYear == *media.StartDate.Year {
			posterior = updateBayes(posterior, 0.95, 0.10)
		} else {
			posterior = updateBayes(posterior, 0.30, 0.60)
		}
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
