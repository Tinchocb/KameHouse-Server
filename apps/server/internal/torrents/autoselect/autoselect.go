package autoselect

import (
	"context"
	"fmt"
	"kamehouse/internal/api/anilist"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/models/dto"
	hibiketorrent "kamehouse/internal/extension/hibike/torrent"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/torrents/torrent"
	"kamehouse/internal/util"
	"sort"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

// TorrentWithCacheStatus wraps a torrent with its debrid/local cache availability.
type TorrentWithCacheStatus struct {
	Torrent  *hibiketorrent.AnimeTorrent
	IsCached bool
}

// Name delegates to the wrapped torrent's Name field.
func (t *TorrentWithCacheStatus) GetName() string { return t.Torrent.Name }

type AutoSelect struct {
	logger            *zerolog.Logger
	torrentRepository *torrent.Repository
	metadataProvider  *util.Ref[metadata_provider.Provider]
	platform          *util.Ref[platform.Platform]
	onEvent           func(event interface{})
}

type NewAutoSelectOptions struct {
	Logger            *zerolog.Logger
	TorrentRepository *torrent.Repository
	MetadataProvider  *util.Ref[metadata_provider.Provider]
	Platform          *util.Ref[platform.Platform]
	OnEvent           func(event interface{})
}

func New(opts *NewAutoSelectOptions) *AutoSelect {
	return &AutoSelect{
		logger:            opts.Logger,
		torrentRepository: opts.TorrentRepository,
		metadataProvider:  opts.MetadataProvider,
		platform:          opts.Platform,
		onEvent:           opts.OnEvent,
	}
}

func (a *AutoSelect) SelectEpisode(ctx context.Context, media *anilist.CompleteAnime, aniDbEpisode string, episodeNumber int) (interface{}, error) {
	return nil, nil
}

// filter applies the profile constraints to the torrent list and returns only passing torrents.
func (a *AutoSelect) filter(torrents []*hibiketorrent.AnimeTorrent, profile *dto.AutoSelectProfile) []*hibiketorrent.AnimeTorrent {
	if profile == nil {
		return torrents
	}

	var result []*hibiketorrent.AnimeTorrent
	for _, t := range torrents {
		if !a.torrentPassesProfile(t, profile) {
			continue
		}
		result = append(result, t)
	}
	return result
}

// torrentPassesProfile checks if a torrent satisfies all hard constraints of the profile.
func (a *AutoSelect) torrentPassesProfile(t *hibiketorrent.AnimeTorrent, profile *dto.AutoSelectProfile) bool {
	if profile == nil {
		return true
	}

	nameLower := strings.ToLower(t.Name)

	// Min seeders
	if profile.MinSeeders > 0 && t.Seeders < profile.MinSeeders {
		return false
	}

	// Min/Max size
	if profile.MinSize != "" && t.Size > 0 {
		minBytes, err := util.StringToBytes(profile.MinSize)
		if err == nil && t.Size < minBytes {
			return false
		}
	}
	if profile.MaxSize != "" && t.Size > 0 {
		maxBytes, err := util.StringToBytes(profile.MaxSize)
		if err == nil && t.Size > maxBytes {
			return false
		}
	}

	// Exclude terms
	for _, term := range profile.ExcludeTerms {
		if strings.Contains(nameLower, strings.ToLower(term)) {
			return false
		}
	}

	// Batch preference
	if profile.BatchPreference == dto.AutoSelectPreferenceOnly && !t.IsBatch {
		return false
	}
	if profile.BatchPreference == dto.AutoSelectPreferenceNever && t.IsBatch {
		return false
	}

	// Multiple audio preference
	hasDualAudio := strings.Contains(nameLower, "dual audio") || strings.Contains(nameLower, "dual-audio")
	if profile.MultipleAudioPreference == dto.AutoSelectPreferenceOnly && !hasDualAudio {
		return false
	}
	if profile.MultipleAudioPreference == dto.AutoSelectPreferenceNever && hasDualAudio {
		return false
	}

	// Require codec
	if profile.RequireCodec && len(profile.PreferredCodecs) > 0 {
		found := false
		for _, codec := range profile.PreferredCodecs {
			if strings.Contains(nameLower, strings.ToLower(codec)) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	// Require language
	if profile.RequireLanguage && len(profile.PreferredLanguages) > 0 {
		found := false
		for _, lang := range profile.PreferredLanguages {
			parts := strings.Split(lang, ",")
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if strings.Contains(nameLower, strings.ToLower(p)) {
					found = true
					break
				}
			}
			if found {
				break
			}
		}
		if !found {
			return false
		}
	}

	// Require source
	if profile.RequireSource && len(profile.PreferredSources) > 0 {
		found := false
		for _, src := range profile.PreferredSources {
			if strings.Contains(nameLower, strings.ToLower(src)) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	return true
}

// scoreForSort computes a soft score for sorting purposes (not a hard filter).
func (a *AutoSelect) scoreForSort(t *hibiketorrent.AnimeTorrent, profile *dto.AutoSelectProfile) int {
	if profile == nil {
		return 0
	}
	score := 0
	nameLower := strings.ToLower(t.Name)

	// Resolution bonus
	for _, res := range profile.Resolutions {
		if strings.Contains(nameLower, strings.ToLower(res)) {
			score += 100
			break
		}
	}

	// Codec bonus
	for _, codec := range profile.PreferredCodecs {
		if strings.Contains(nameLower, strings.ToLower(codec)) {
			score += 40
			break
		}
	}

	// Dual audio preference
	hasDualAudio := strings.Contains(nameLower, "dual audio") || strings.Contains(nameLower, "dual-audio")
	if hasDualAudio {
		switch profile.MultipleAudioPreference {
		case dto.AutoSelectPreferencePrefer:
			score += 15
		case dto.AutoSelectPreferenceAvoid:
			score -= 15
		}
	}

	// Provider preference
	for _, prov := range profile.Providers {
		if strings.EqualFold(t.Provider, prov) {
			score += 50
			break
		}
	}

	return score
}

// sort sorts the torrents in-place by profile score (descending), breaking ties by seeders.
func (a *AutoSelect) sort(torrents []*hibiketorrent.AnimeTorrent, profile *dto.AutoSelectProfile) {
	sort.SliceStable(torrents, func(i, j int) bool {
		si := a.scoreForSort(torrents[i], profile)
		sj := a.scoreForSort(torrents[j], profile)
		if si != sj {
			return si > sj
		}
		return torrents[i].Seeders > torrents[j].Seeders
	})
}

// filterAndSort filters, sorts, and optionally re-sorts with cache status.
func (a *AutoSelect) filterAndSort(
	torrents []*hibiketorrent.AnimeTorrent,
	profile *dto.AutoSelectProfile,
	postSearchSort func([]*hibiketorrent.AnimeTorrent) []*TorrentWithCacheStatus,
) []*hibiketorrent.AnimeTorrent {
	filtered := a.filter(torrents, profile)
	a.sort(filtered, profile)

	if postSearchSort == nil {
		return filtered
	}

	withCache := postSearchSort(filtered)

	// Re-sort with cache awareness: cached torrent gets promoted if within 70% of best score
	bestScore := 0
	for _, t := range filtered {
		s := a.scoreForSort(t, profile)
		if s > bestScore {
			bestScore = s
		}
	}
	threshold := int(float64(bestScore) * 0.70)

	sort.SliceStable(withCache, func(i, j int) bool {
		si := a.scoreForSort(withCache[i].Torrent, profile)
		sj := a.scoreForSort(withCache[j].Torrent, profile)
		ci := withCache[i].IsCached && si >= threshold
		cj := withCache[j].IsCached && sj >= threshold

		if ci != cj {
			return ci // cached preferred items come first
		}
		if si != sj {
			return si > sj
		}
		return withCache[i].Torrent.Seeders > withCache[j].Torrent.Seeders
	})

	result := make([]*hibiketorrent.AnimeTorrent, len(withCache))
	for i, t := range withCache {
		result[i] = t.Torrent
	}
	return result
}

// searchFromProvider searches a single provider with resolution fallback.
func (a *AutoSelect) searchFromProvider(
	ctx context.Context,
	providerID string,
	media *anilist.CompleteAnime,
	episodeNumber int,
	isBatch bool,
	profile *dto.AutoSelectProfile,
) ([]*hibiketorrent.AnimeTorrent, error) {
	if a.torrentRepository == nil {
		return nil, fmt.Errorf("no torrent repository configured")
	}

	ext, ok := a.torrentRepository.GetAnimeProviderExtension(providerID)
	if !ok || ext == nil {
		return nil, fmt.Errorf("provider %q not found", providerID)
	}

	return nil, fmt.Errorf("provider search not implemented in stub")
}

// searchFromProviders searches across multiple providers and deduplicates results by info hash.
func (a *AutoSelect) searchFromProviders(
	ctx context.Context,
	providerIDs []string,
	media *anilist.CompleteAnime,
	episodeNumber int,
	isBatch bool,
	profile *dto.AutoSelectProfile,
) ([]*hibiketorrent.AnimeTorrent, error) {
	return nil, nil
}

// search runs the full search pipeline across providers.
func (a *AutoSelect) search(
	ctx context.Context,
	media *anilist.CompleteAnime,
	episodeNumber int,
	profile *dto.AutoSelectProfile,
) ([]*hibiketorrent.AnimeTorrent, error) {
	return nil, nil
}

// shouldSearchBatch returns true if the media is a finished TV series that ended at least 2 weeks ago.
func (a *AutoSelect) shouldSearchBatch(media *anilist.CompleteAnime) bool {
	if media == nil {
		return false
	}
	if media.Format != nil && *media.Format == anilist.MediaFormatMovie {
		return false
	}
	if media.Status == nil || *media.Status != anilist.MediaStatusFinished {
		return false
	}
	if media.EndDate == nil || media.EndDate.Year == nil {
		return true // Finished but no end date — assume old enough
	}

	year := *media.EndDate.Year
	month := 1
	day := 1
	if media.EndDate.Month != nil {
		month = *media.EndDate.Month
	}
	if media.EndDate.Day != nil {
		day = *media.EndDate.Day
	}

	endDate := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	twoWeeksAgo := time.Now().UTC().AddDate(0, 0, -14)
	return !endDate.After(twoWeeksAgo)
}

// getProvidersToSearch returns the ordered list of provider IDs to search for a given profile.
func (a *AutoSelect) getProvidersToSearch(profile *dto.AutoSelectProfile) []string {
	maxProviders := 3

	if profile != nil && len(profile.Providers) > 0 {
		if len(profile.Providers) <= maxProviders {
			return profile.Providers
		}
		return profile.Providers[:maxProviders]
	}

	// Fall back to default provider from repository settings
	if a.torrentRepository != nil {
		def := a.torrentRepository.GetDefaultAnimeProvider()
		if def != "" {
			return []string{def}
		}
	}
	return []string{}
}
