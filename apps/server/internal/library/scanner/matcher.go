package scanner

import (
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/hook"
	"kamehouse/internal/library/parser"
	"kamehouse/internal/util/parallel"
	"context"

	"github.com/rs/zerolog"
)

// reYear matches a 4-digit calendar year (1900–2099) bounded by word boundaries.
// Pre-compiled at package init to avoid repeated allocation inside extractYear().
var reYear = regexp.MustCompile(`\b((?:19|20)\d{2})\b`)

// AgentMatcher acts as the autonomous "Brain" of the scanning engine.
// Instead of binary matching, it uses Bayesian Probabilities to evaluate file paths,
// contextual folders, and metadata to establish confidence in an identity match.
type Matcher struct { // Keep struct name 'Matcher' for backwards compatibility
	LocalFiles        []*dto.LocalFile
	MediaContainer    *MediaContainer
	Logger            *zerolog.Logger
	Database          *db.Database
	Threshold         float64
	MatchingAlgorithm string
	StrictStructure   bool
}

func NewMatcher(localFiles []*dto.LocalFile, mediaContainer *MediaContainer, logger *zerolog.Logger, db *db.Database) *Matcher {
	return &Matcher{
		LocalFiles:     localFiles,
		MediaContainer: mediaContainer,
		Logger:         logger,
		Database:       db,
		Threshold:      0.80, // Default threshold
	}
}

// MatchLocalFilesWithMedia orchestrates the Thinking Workers that will probabilistically evaluate all files.
func (m *Matcher) MatchLocalFilesWithMedia() error {
	m.Logger.Info().Msg("AgentMatcher: Initiating Bayesian Identity Resolution...")
	start := time.Now()

	// Trigger Pre-Match Hooks
	event := &ScanMatchingStartedEvent{
		LocalFiles:      m.LocalFiles,
		NormalizedMedia: m.MediaContainer.NormalizedMedia,
	}
	hook.GlobalHookManager.OnScanMatchingStarted().Trigger(event)

	if event.IsDefaultPrevented() {
		m.LocalFiles = event.LocalFiles
		return nil
	}

	// Use generic parallel processing module
	parallel.EachTask(m.LocalFiles, func(lf *dto.LocalFile, _ int) {
		m.BayesianResolve(lf)
	})

	m.Logger.Info().Msgf("AgentMatcher: Completed Bayesian Pass on %d files in %v", len(m.LocalFiles), time.Since(start))

	// Trigger Post-Match Hooks
	completedEvent := &ScanMatchingCompletedEvent{LocalFiles: m.LocalFiles}
	hook.GlobalHookManager.OnScanMatchingCompleted().Trigger(completedEvent)

	return nil
}

// MatchBatch processes an asynchronous batch of paths coming from the queue
func (m *Matcher) MatchBatch(ctx context.Context, batchPaths []string) error {
	m.Logger.Info().Int("count", len(batchPaths)).Msg("AgentMatcher: Processing async batch from queue")

	localFiles := make([]*dto.LocalFile, len(batchPaths))
	for i, path := range batchPaths {
		localFiles[i] = dto.NewLocalFileS(path, nil)
	}

	parallel.EachTask(localFiles, func(lf *dto.LocalFile, _ int) {
		if ctx.Err() != nil {
			return
		}
		m.BayesianResolve(lf)
	})

	// Add batch insertion logic here if needed, decoupled from scanner UI thread

	return nil
}

// BayesianResolve calculates the probabilistic confidence that a file belongs to a specific media.
func (m *Matcher) BayesianResolve(lf *dto.LocalFile) {
	// 1. Initial Parse
	pm := Normalize(lf.Path)

	// SHORT-CIRCUIT: Check hardcoded custom overrides before Bayesian scoring.
	if overrideID, found := LookupCustomOverride(pm.Title); found {
		lf.MediaId = overrideID
		lf.Metadata.Episode = pm.Episode
		if pm.Title != "" && pm.Season == 1 && pm.Episode == 1 {
			// This is a naive attempt; in production IsSpecial is determined by parser correctly
			// but we fallback safely here.
			lf.Metadata.Type = dto.LocalFileTypeMain
		} else {
			lf.Metadata.Type = dto.LocalFileTypeMain
		}
		m.Logger.Info().Msgf("AgentMatcher: Custom override matched '%s' -> %d [short-circuit]", lf.Name, overrideID)
		return
	}

	bestConfidence := 0.0
	var bestMatch *dto.NormalizedMedia

	// Evaluate against all media (The API catalog)
	if m.MediaContainer != nil {
		for _, media := range m.MediaContainer.NormalizedMedia {
			confidence := m.calculateBayesianScore(pm, media)

			if confidence > bestConfidence {
				bestConfidence = confidence
				bestMatch = media
			}
		}
	}

	// 2. RECURSIVE FALLBACK ENGINE (Self-Healing Loop)
	threshold := m.Threshold
	if threshold <= 0 {
		threshold = 0.80
	}

	if bestConfidence < threshold {
		m.Logger.Debug().Msgf("AgentMatcher: Sub-optimal confidence (%.2f) on '%s'. Initiating Heuristic Healing.", bestConfidence, lf.Name)

		// Self-Healing Step 1: Check Ghost Associations first (Has the user or probability engine seen this anomaly before?)
		if m.Database != nil {
			if association, err := m.Database.GetGhostAssociationByPath(lf.Path); err == nil && association != nil {
				if association.UserResolved || association.GhostMatchCount > 3 {
					// The system learned this override! Forcibly map it.
					lf.MediaId = association.TargetMediaId
					bestConfidence = 1.0 // Heuristic Absolute Truth
					m.Logger.Info().Msgf("AgentMatcher: Resurrected identity using Ghost Association for '%s' -> %d", lf.Name, lf.MediaId)

					// Find and assign the bestMatch struct
					for _, media := range m.MediaContainer.NormalizedMedia {
						if media.ID == association.TargetMediaId {
							bestMatch = media
							break
						}
					}
					goto verdict // Skip further parsing
				}
			}
		}

		// Self-Healing Step 2: Strip bracket tags entirely and re-score
		healedTitle := sanitizeSubGroupTags(pm.Title)
		if healedTitle != pm.Title {
			pm.Title = healedTitle
			for _, media := range m.MediaContainer.NormalizedMedia {
				conf := m.calculateBayesianScore(pm, media)
				if conf > bestConfidence {
					bestConfidence = conf
					bestMatch = media
				}
			}
		}

		// Self-Healing Step 3: Check Folder Context
		if bestConfidence < threshold && len(lf.ParsedFolderData) > 0 {
			folderStr := filepath.Base(filepath.Dir(lf.Path))
			pm.Title = Normalize(folderStr).Title
			for _, media := range m.MediaContainer.NormalizedMedia {
				conf := m.calculateBayesianScore(pm, media)
				if conf*0.90 > bestConfidence {
					bestConfidence = conf * 0.90
					bestMatch = media
				}
			}
		}
	}

verdict:
	// 3. Verdict
	if bestMatch != nil && bestConfidence >= threshold {
		lf.MediaId = bestMatch.ID

		lf.Metadata.Episode = pm.Episode
		lf.Metadata.Type = dto.LocalFileTypeMain

		m.Logger.Debug().Msgf("AgentMatcher: Matched '%s' -> %d [Confd: %.2f]", lf.Name, bestMatch.ID, bestConfidence)
	} else {
		m.Logger.Warn().Msgf("AgentMatcher: AI failed to identify '%s' (Max Confd: %.2f). Marking as Unrecognized.", lf.Name, bestConfidence)

		// If it completely failed, log it as a Ghost Association candidate so the UI can learn when the user manually fixes it
		if m.Database != nil && bestMatch != nil && bestConfidence > 0.40 {
			ghost := &models.GhostAssociatedMedia{
				Path:           lf.Path,
				OriginalTitle:  lf.Name,
				AlgorithmScore: bestConfidence,
				TargetMediaId:  bestMatch.ID,
				UserResolved:   false,
			}
			_ = m.Database.UpsertGhostAssociation(ghost) // Silent best-effort insert
		}
	}

	// Hook Integration
	matchedEvent := &ScanLocalFileMatchedEvent{
		Match:     bestMatch,
		Found:     bestMatch != nil && bestConfidence >= threshold,
		LocalFile: lf,
		Score:     bestConfidence,
	}
	hook.GlobalHookManager.OnScanLocalFileMatched().Trigger(matchedEvent)
}

// calculateBayesianScore implements a naive Bayes estimation for identity correlation.
func (m *Matcher) calculateBayesianScore(pm parser.ParsedMedia, media *dto.NormalizedMedia) float64 {
	prior := 0.50 // Base probability that ANY file matches ANY media

	// Evidence 1: Sorensen-Dice Textual Similarity (Is the string morphologically similar?)
	// Build all candidate title strings from both primary titles and synonyms
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

	bestDice := 0.0
	for _, title := range candidateTitles {
		sim := calculateDice(pm.Title, title)
		if sim > bestDice {
			bestDice = sim
		}
	}

	// Update via Evidence 1 (If strings match perfectly, confidence spikes; if 0, confidence crashes)
	posterior := updateBayes(prior, bestDice, 0.20)

	// Evidence 2: Season Matching (Did the parser extract season 2, and does this media represent season 2?)
	if pm.Season > 1 && media.Format != nil && string(*media.Format) == "TV" {
		posterior = updateBayes(posterior, 0.90, 0.10)
	}

	// Evidence 3: Special/OVA Detection (Fallback logic moved out of pm)
	if pm.Season == 0 && pm.Episode == 0 {
		if media.Format != nil && (string(*media.Format) == "OVA" || string(*media.Format) == "SPECIAL") {
			posterior = updateBayes(posterior, 0.95, 0.50)
		} else {
			posterior = updateBayes(posterior, 0.10, 0.80)
		}
	}

	// Evidence 4: Year/Air-Date Contextual Inference (Self-Healing Metadata Agent)
	// If the filename contains a year like "(1993)" and the media has a matching start date,
	// it's an extremely strong signal — especially for movies and specials.
	fileYear := extractYear(pm.Title)
	if fileYear > 0 && media.StartDate != nil && media.StartDate.Year != nil {
		if fileYear == *media.StartDate.Year {
			posterior = updateBayes(posterior, 0.95, 0.10) // Massive boost: year matches
		} else {
			// Small penalty for year mismatch — makes wrong candidates drop faster
			posterior = updateBayes(posterior, 0.30, 0.60)
		}
	}

	return posterior
}

// extractYear extracts a 4-digit year from strings like "Dragon Ball Z (1993)" or "- 1993.mkv".
// Uses the package-level reYear to avoid recompiling the pattern on every call.
func extractYear(s string) int {
	if loc := reYear.FindStringSubmatch(s); len(loc) > 1 {
		return parseFallbackInt(loc[1], 0)
	}
	return 0
}

// updateBayes applies a simplified Naive Bayes update.
// p_e_given_h = Probability of Evidence given Hypothesis is True
// p_e_given_not_h = Probability of Evidence given Hypothesis is False
func updateBayes(prior, p_e_given_h, p_e_given_not_h float64) float64 {
	if p_e_given_h < 0.01 {
		p_e_given_h = 0.01
	}
	if p_e_given_not_h < 0.01 {
		p_e_given_not_h = 0.01
	}

	numerator := p_e_given_h * prior
	denominator := numerator + (p_e_given_not_h * (1.0 - prior))

	return numerator / denominator
}

// sanitizeSubGroupTags isolates things like [SubsPlease] or (1080p) from being mapped to titles
func sanitizeSubGroupTags(input string) string {
	// 1. Remove [ReleaseGroup] at the start
	if strings.HasPrefix(input, "[") {
		closingIdx := strings.Index(input, "]")
		if closingIdx > 0 && closingIdx < len(input)-1 {
			input = strings.TrimSpace(input[closingIdx+1:])
		}
	}

	// 2. Remove trailing tags like [1080p], (TV), etc.
	reTags := regexp.MustCompile(`\s*(\[.*?\]|\(.*?\))\s*$`)
	for reTags.MatchString(input) {
		input = reTags.ReplaceAllString(input, "")
	}

	// 3. Remove common CRC32 hashes at the end
	reCRC := regexp.MustCompile(`(?i)\s*\[[0-9A-F]{8}\]\s*$`)
	input = reCRC.ReplaceAllString(input, "")

	return strings.TrimSpace(input)
}

// calculateDice implements the real Sørensen-Dice Coefficient using character bigrams.
// This replaces the previous stub that returned 0.20 for non-substring matches.
func calculateDice(s1, s2 string) float64 {
	s1 = strings.ToLower(strings.TrimSpace(s1))
	s2 = strings.ToLower(strings.TrimSpace(s2))

	if len(s1) == 0 || len(s2) == 0 {
		return 0.0
	}
	if s1 == s2 {
		return 1.0
	}

	// Generate bigrams for s1
	bigrams1 := makeBigrams(s1)
	bigrams2 := makeBigrams(s2)

	if len(bigrams1) == 0 || len(bigrams2) == 0 {
		// Fallback for single-char strings
		if strings.Contains(s1, s2) || strings.Contains(s2, s1) {
			return 0.85
		}
		return 0.0
	}

	// Count intersection
	intersection := 0
	used := make(map[int]bool, len(bigrams2))
	for _, b1 := range bigrams1 {
		for j, b2 := range bigrams2 {
			if !used[j] && b1 == b2 {
				intersection++
				used[j] = true
				break
			}
		}
	}

	return (2.0 * float64(intersection)) / float64(len(bigrams1)+len(bigrams2))
}

// makeBigrams splits a string into consecutive character pairs.
func makeBigrams(s string) []string {
	runes := []rune(s)
	if len(runes) < 2 {
		return nil
	}
	bigrams := make([]string, 0, len(runes)-1)
	for i := 0; i < len(runes)-1; i++ {
		bigrams = append(bigrams, string(runes[i:i+2]))
	}
	return bigrams
}
