package autodownloader

import (
	"context"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util"
	"testing"

	"github.com/5rahim/habari"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestComparison(t *testing.T) {
	database, _ := db.NewDatabase(context.Background(), t.TempDir(), "test", util.NewLogger())
	ad := AutoDownloader{
		metadataProviderRef: util.NewRef(metadata_provider.GetFakeProvider(t, database)),
		settings: &models.AutoDownloaderSettings{
			EnableSeasonCheck: true,
		},
	}

	rule := &dto.AutoDownloaderRule{
		MediaId:             166531,
		ReleaseGroups:       []string{"SubsPlease", "Erai-raws"},
		Resolutions:         []string{"1080p"},
		TitleComparisonType: "likely",
		EpisodeType:         "recent",
		EpisodeNumbers:      []int{3}, // ignored
		Destination:         "/data/KameHouse/library/[Oshi no Ko] 2nd Season",
		ComparisonTitle:     "[Oshi no Ko] 2nd Season",
	}

	tests := []struct {
		torrentName                  string
		succeedTitleComparison       bool
		succeedSeasonAndEpisodeMatch bool
		enableSeasonCheck            bool
	}{
		{
			torrentName:                  "[Erai-raws] Oshi no Ko 2nd Season - 03 [720p][Multiple Subtitle] [ENG][FRE]",
			succeedTitleComparison:       true,
			succeedSeasonAndEpisodeMatch: true,
			enableSeasonCheck:            true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.torrentName, func(t *testing.T) {
			ad.settings.EnableSeasonCheck = tt.enableSeasonCheck
			p := habari.Parse(tt.torrentName)
			if tt.succeedTitleComparison {
				require.True(t, ad.isTitleMatch(p, tt.torrentName, rule, nil))
			} else {
				require.False(t, ad.isTitleMatch(p, tt.torrentName, rule, nil))
			}
			_, ok := ad.isSeasonAndEpisodeMatch(p, rule, nil)
			if tt.succeedSeasonAndEpisodeMatch {
				require.True(t, ok)
			} else {
				require.False(t, ok)
			}
		})
	}
}

func TestComparison2(t *testing.T) {
	database, _ := db.NewDatabase(context.Background(), t.TempDir(), "test", util.NewLogger())
	ad := AutoDownloader{
		metadataProviderRef: util.NewRef(metadata_provider.GetFakeProvider(t, database)),
		settings: &models.AutoDownloaderSettings{
			EnableSeasonCheck: true,
		},
	}

	rule := &dto.AutoDownloaderRule{
		MediaId:             166531,
		ReleaseGroups:       []string{},
		Resolutions:         []string{"1080p"},
		TitleComparisonType: "likely",
		EpisodeType:         "recent",
		EpisodeNumbers:      []int{},
		Destination:         "/data/KameHouse/library/Dandadan",
		ComparisonTitle:     "Dandadan",
	}

	tests := []struct {
		torrentName                 string
		succeedAdditionalTermsMatch bool
		ruleAdditionalTerms         []string
	}{
		{
			torrentName:                 "[Anime Time] Dandadan - 04 [Dual Audio][1080p][HEVC 10bit x265][AAC][Multi Sub] [Weekly]",
			ruleAdditionalTerms:         []string{},
			succeedAdditionalTermsMatch: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.torrentName, func(t *testing.T) {
			rule.AdditionalTerms = tt.ruleAdditionalTerms
			ok := ad.isTitleMatch(habari.Parse(tt.torrentName), tt.torrentName, rule, nil)
			assert.True(t, ok)
			ok = ad.isAdditionalTermsMatch(tt.torrentName, rule)
			if tt.succeedAdditionalTermsMatch {
				assert.True(t, ok)
			} else {
				assert.False(t, ok)
			}
		})
	}
}

func TestComparison3(t *testing.T) {
	database, _ := db.NewDatabase(context.Background(), t.TempDir(), "test", util.NewLogger())
	ad := AutoDownloader{
		metadataProviderRef: util.NewRef(metadata_provider.GetFakeProvider(t, database)),
		settings: &models.AutoDownloaderSettings{
			EnableSeasonCheck: true,
		},
	}

	rule := &dto.AutoDownloaderRule{
		MediaId:             166531,
		ReleaseGroups:       []string{},
		Resolutions:         []string{},
		TitleComparisonType: "likely",
		EpisodeType:         "recent",
		EpisodeNumbers:      []int{},
		Destination:         "/data/KameHouse/library/Dandadan",
		ComparisonTitle:     "Dandadan",
	}

	tests := []struct {
		torrentName                  string
		succeedTitleComparison       bool
		succeedSeasonAndEpisodeMatch bool
		enableSeasonCheck            bool
	}{
		{
			torrentName:                  "[Salieri] Zom 100 Bucket List of the Dead - S1 - BD (1080p) (HDR) [Dual Audio]",
			succeedTitleComparison:       false,
			succeedSeasonAndEpisodeMatch: false,
			enableSeasonCheck:            false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.torrentName, func(t *testing.T) {
			ad.settings.EnableSeasonCheck = tt.enableSeasonCheck
			p := habari.Parse(tt.torrentName)
			if tt.succeedTitleComparison {
				require.True(t, ad.isTitleMatch(p, tt.torrentName, rule, nil))
			} else {
				require.False(t, ad.isTitleMatch(p, tt.torrentName, rule, nil))
			}
			_, ok := ad.isSeasonAndEpisodeMatch(p, rule, nil)
			if tt.succeedSeasonAndEpisodeMatch {
				assert.True(t, ok)
			} else {
				assert.False(t, ok)
			}
		})
	}
}
