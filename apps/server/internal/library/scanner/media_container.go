package scanner

import (
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util"

	"github.com/rs/zerolog"
)

type (
	MediaContainerOptions struct {
		AllMedia   []*dto.NormalizedMedia
		ScanLogger *ScanLogger
	}

	// MediaContainer holds all the NormalizedMedia that will be used by the Matcher.
	// It creates an inverted index for fast candidate lookup based on title tokens.
	// Note: It doesn't care that the NormalizedMedia are not fully fetched.
	// Before v3.5, it was used to flatten relations into NormalizedMedia.
	MediaContainer struct {
		NormalizedMedia       []*dto.NormalizedMedia
		NormalizedTitlesCache map[int][]*NormalizedTitle // mediaID -> normalized titles
		ScanLogger            *ScanLogger
		// Inverted Index for fast candidate lookup
		// Token -> media that contain this token in their title
		TokenIndex map[string][]*dto.NormalizedMedia
	}
)

// NewMediaContainer creates a new MediaContainer from a list of NormalizedMedia that will be used by the Matcher.
func NewMediaContainer(opts *MediaContainerOptions) *MediaContainer {
	mc := new(MediaContainer)
	mc.ScanLogger = opts.ScanLogger

	mc.NormalizedMedia = opts.AllMedia

	// pre-compute normalized titles for all media
	mc.NormalizedTitlesCache = make(map[int][]*NormalizedTitle, len(mc.NormalizedMedia))

	// Initialize token index
	mc.TokenIndex = make(map[string][]*dto.NormalizedMedia)

	for _, m := range mc.NormalizedMedia {
		normalized := make([]*NormalizedTitle, 0)

		// Keep track of which tokens this media has been added to to avoid duplicates
		seenTokens := make(map[string]struct{})

		addTitle := func(t *string, isMain bool) {
			if t != nil && *t != "" {
				norm := NormalizeTitle(*t)
				norm.IsMain = isMain
				normalized = append(normalized, norm)

				// Populate index
				tokens := GetSignificantTokens(norm.Tokens)
				for _, token := range tokens {
					if _, ok := seenTokens[token]; !ok {
						mc.TokenIndex[token] = append(mc.TokenIndex[token], m)
						seenTokens[token] = struct{}{}
					}
				}
				// Also index compound tokens (adjacent pairs concatenated)
				// e.g. "re" + "zero" -> "rezero" so that "ReZero" can find "Re Zero kara..."
				for i := 0; i < len(tokens)-1; i++ {
					// only concatenate short tokens to avoid too much noise
					if len(tokens[i]) <= 5 && len(tokens[i+1]) <= 5 {
						compound := tokens[i] + tokens[i+1]
						if _, ok := seenTokens[compound]; !ok {
							mc.TokenIndex[compound] = append(mc.TokenIndex[compound], m)
							seenTokens[compound] = struct{}{}
						}
					}
				}
			}
		}

		if m.Title != nil {
			if m.Title.Romaji != nil {
				addTitle(m.Title.Romaji, true)
			}
			if m.Title.English != nil {
				addTitle(m.Title.English, true)
			}
			if m.Title.Native != nil {
				addTitle(m.Title.Native, false)
			}
			if m.Title.UserPreferred != nil {
				addTitle(m.Title.UserPreferred, true)
			}
		}
		if m.Synonyms != nil {
			for _, syn := range m.Synonyms {
				if syn == nil || !util.IsMostlyLatinString(*syn) {
					continue
				}
				addTitle(syn, false)
			}
		}

		// Add aliases from the local alias database
		// Check all existing titles against the alias DB and add any matches
		titlesToCheck := make([]string, 0, 4)
		if m.Title != nil {
			if m.Title.Romaji != nil {
				titlesToCheck = append(titlesToCheck, *m.Title.Romaji)
			}
			if m.Title.English != nil {
				titlesToCheck = append(titlesToCheck, *m.Title.English)
			}
		}
		for _, t := range titlesToCheck {
			if aliases := GetAliasesForTitle(t); len(aliases) > 0 {
				for _, alias := range aliases {
					a := alias
					addTitle(&a, false)
				}
			}
		}

		mc.NormalizedTitlesCache[m.ID] = normalized
		seenTokens = nil
	}

	if mc.ScanLogger != nil {
		mc.ScanLogger.LogMediaContainer(zerolog.InfoLevel).
			Any("mediaCount", len(mc.NormalizedMedia)).
			Any("tokenIndexSize", len(mc.TokenIndex)).
			Msg("Created media container")
	}

	return mc
}
