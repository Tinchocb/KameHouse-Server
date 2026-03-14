package autodownloader

import (
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util"
	"regexp"
	"strings"

	"github.com/samber/lo"
)

func (ad *AutoDownloader) isExcludedTermsMatch(torrentName string, rule *dto.AutoDownloaderRule) bool {
	if len(rule.ExcludeTerms) == 0 {
		return true
	}
	torrentNameLower := strings.ToLower(torrentName)
	for _, term := range rule.ExcludeTerms {
		terms := strings.Split(term, ",")
		for _, t := range terms {
			t = strings.TrimSpace(t)
			if strings.Contains(torrentNameLower, strings.ToLower(t)) {
				return false
			}
		}
	}
	return true
}

func (ad *AutoDownloader) isConstraintsMatch(t *NormalizedTorrent, rule *dto.AutoDownloaderRule) bool {
	seeders := t.GetSeeders()
	size := t.GetSize()
	if seeders > -1 && rule.MinSeeders > 0 && seeders < rule.MinSeeders {
		return false
	}
	if size > 0 && rule.MinSize != "" {
		minSize, err := util.StringToBytes(rule.MinSize)
		if err == nil && size < minSize {
			return false
		}
	}
	if size > 0 && rule.MaxSize != "" {
		maxSize, err := util.StringToBytes(rule.MaxSize)
		if err == nil && size > maxSize {
			return false
		}
	}
	return true
}

// isProfileValidChecks checks if the torrent matches the profile's validity conditions (require, block, thresholds)
// It does not calculate scores
func (ad *AutoDownloader) isProfileValidChecks(t *NormalizedTorrent, profile *dto.AutoDownloaderProfile) bool {
	if profile == nil {
		return true
	}

	seeders := t.GetSeeders()
	size := t.GetSize()
	name := t.GetName()

	// Check thresholds
	// Only check if torrent has seeders info
	if seeders > -1 && profile.MinSeeders > 0 && seeders < profile.MinSeeders {
		return false
	}
	// Only check if torrent has size info
	if profile.MinSize != "" && size > 0 {
		minSize, err := util.StringToBytes(profile.MinSize)
		if err == nil && size < minSize {
			return false
		}
	}
	if profile.MaxSize != "" && size > 0 {
		maxSize, err := util.StringToBytes(profile.MaxSize)
		if err == nil && size > maxSize {
			return false
		}
	}

	// Check conditions (block & require)
	// Condition ID -> bool
	requiredFound := make(map[string]bool)
	requiredConditions := make([]string, 0)

	// Identify required conditions first
	for _, condition := range profile.Conditions {
		if condition.Action == dto.AutoDownloaderProfileRuleFormatActionRequire {
			requiredConditions = append(requiredConditions, condition.ID)
		}
	}

	torrentNameLower := strings.ToLower(name)

	for _, condition := range profile.Conditions {
		isMatch := false
		if condition.IsRegex {
			re, err := regexp.Compile(condition.Term)
			if err == nil {
				isMatch = re.MatchString(name)
			}
		} else {
			terms := strings.Split(condition.Term, ",")
			for _, term := range terms {
				term = strings.TrimSpace(term)
				if strings.Contains(torrentNameLower, strings.ToLower(term)) {
					isMatch = true
					break
				}
			}
		}

		if isMatch {
			switch condition.Action {
			case dto.AutoDownloaderProfileRuleFormatActionBlock:
				return false // Immediate fail
			case dto.AutoDownloaderProfileRuleFormatActionRequire:
				requiredFound[condition.ID] = true
			}
		}
	}

	// Check if all required conditions were met
	for _, reqID := range requiredConditions {
		if !requiredFound[reqID] {
			return false
		}
	}

	return true
}

func (ad *AutoDownloader) calculateTorrentScore(t *NormalizedTorrent, profile *dto.AutoDownloaderProfile) int {
	if profile == nil {
		return 0
	}

	score := 0
	name := t.GetName()
	torrentNameLower := strings.ToLower(name)

	for _, condition := range profile.Conditions {
		if condition.Action != dto.AutoDownloaderProfileRuleFormatActionScore {
			continue
		}

		isMatch := false
		if condition.IsRegex {
			re, err := regexp.Compile(condition.Term)
			if err == nil {
				isMatch = re.MatchString(name)
			}
		} else {
			terms := strings.Split(condition.Term, ",")
			for _, term := range terms {
				term = strings.TrimSpace(term)
				if strings.Contains(torrentNameLower, strings.ToLower(term)) {
					isMatch = true
					break
				}
			}
		}

		if isMatch {
			score += condition.Score
		}
	}

	return score
}

func (ad *AutoDownloader) isResolutionMatch(quality string, resolutions []string) (ok bool) {
	defer util.HandlePanicInModuleThen("autodownloader/isResolutionMatch", func() {
		ok = false
	})

	if len(resolutions) == 0 {
		return true
	}
	if quality == "" {
		return false
	}

	normalizedQuality := util.NormalizeResolution(quality)

	for _, q := range resolutions {
		normalizedRuleRes := util.NormalizeResolution(q)
		if util.ExtractResolutionInt(normalizedQuality) == util.ExtractResolutionInt(normalizedRuleRes) {
			return true
		}
	}
	return false
}

// getReleaseGroupToResolutionsMap groups rules by release group to optimize search queries.
// It resolves resolutions from profiles if the rule doesn't have them explicitly set.
// It also resolves release groups from profiles if the rule doesn't have them explicitly set.
func (ad *AutoDownloader) getReleaseGroupToResolutionsMap(rules []*dto.AutoDownloaderRule, profiles []*dto.AutoDownloaderProfile) map[string][]string {
	res := make(map[string][]string)

	for _, rule := range rules {
		// Determine effective resolutions for this rule
		effectiveResolutions := rule.Resolutions
		if len(effectiveResolutions) == 0 {
			// Fallback to profile resolutions
			for _, p := range profiles {
				// Check global profile or specific assigned profile
				if p.Global || (rule.ProfileID != nil && p.DbID == *rule.ProfileID) {
					effectiveResolutions = append(effectiveResolutions, p.Resolutions...)
				}
			}
		}
		effectiveResolutions = lo.Uniq(effectiveResolutions)

		// Determine effective release groups for this rule
		effectiveReleaseGroups := rule.ReleaseGroups
		if len(effectiveReleaseGroups) == 0 {
			// Fallback to profile release groups
			for _, p := range profiles {
				// Check global profile or specific assigned profile
				if p.Global || (rule.ProfileID != nil && p.DbID == *rule.ProfileID) {
					effectiveReleaseGroups = append(effectiveReleaseGroups, p.ReleaseGroups...)
				}
			}
		}
		effectiveReleaseGroups = lo.Uniq(effectiveReleaseGroups)

		if len(effectiveResolutions) == 0 {
			// Returns "-" if no resolutions were found
			// The rule will just fetch by release group only
			effectiveResolutions = []string{"-"}
		}

		// Group by release groups
		for _, rg := range effectiveReleaseGroups {
			if _, ok := res[rg]; !ok {
				res[rg] = make([]string, 0)
			}
			res[rg] = append(res[rg], effectiveResolutions...)
		}
	}

	// Deduplicate resolutions for each group
	for rg, resolutions := range res {
		res[rg] = lo.Uniq(resolutions)
	}

	return res
}

// calculateCandidateScore computes the aggregate score for a torrent across all provided profiles.
// Returns (totalScore, minimumRequiredScore).
func (ad *AutoDownloader) calculateCandidateScore(t *NormalizedTorrent, profiles []*dto.AutoDownloaderProfile) (int, int) {
	totalScore := 0
	minScore := 0
	for _, profile := range profiles {
		totalScore += ad.calculateTorrentScore(t, profile)
		if profile.MinimumScore > minScore {
			minScore = profile.MinimumScore
		}
	}
	return totalScore, minScore
}

// selectBestCandidate picks the candidate with the highest score, breaking ties by seeder count.
func (ad *AutoDownloader) selectBestCandidate(candidates []*Candidate) *Candidate {
	if len(candidates) == 0 {
		return nil
	}
	best := candidates[0]
	for _, c := range candidates[1:] {
		if c.Score > best.Score {
			best = c
		} else if c.Score == best.Score && c.Torrent.GetSeeders() > best.Torrent.GetSeeders() {
			best = c
		}
	}
	return best
}

// getRuleProfiles returns the profiles applicable to a given rule (its specific profile + all global profiles, deduped).
func (ad *AutoDownloader) getRuleProfiles(rule *dto.AutoDownloaderRule, profiles []*dto.AutoDownloaderProfile) []*dto.AutoDownloaderProfile {
	result := make([]*dto.AutoDownloaderProfile, 0)
	seen := make(map[uint]bool)

	// Add the specific profile first
	if rule.ProfileID != nil {
		for _, p := range profiles {
			if p.DbID == *rule.ProfileID && !seen[p.DbID] {
				result = append(result, p)
				seen[p.DbID] = true
			}
		}
	}

	// Add all global profiles (deduped)
	for _, p := range profiles {
		if p.Global && !seen[p.DbID] {
			result = append(result, p)
			seen[p.DbID] = true
		}
	}

	return result
}

// inheritResolutionsFromProfiles returns the effective resolutions for a rule, inheriting from profiles when not explicitly set.
func (ad *AutoDownloader) inheritResolutionsFromProfiles(rule *dto.AutoDownloaderRule, profiles []*dto.AutoDownloaderProfile) []string {
	if len(rule.Resolutions) > 0 {
		return rule.Resolutions
	}

	var inherited []string
	for _, p := range profiles {
		inherited = append(inherited, p.Resolutions...)
	}
	return lo.Uniq(inherited)
}
