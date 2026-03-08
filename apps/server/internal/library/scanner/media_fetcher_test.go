//go:build integration


package scanner

import (
	"kamehouse/internal/api/anilist"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/extension"
	librarymetadata "kamehouse/internal/library/metadata"
	"kamehouse/internal/platforms/anilist_platform"
	"kamehouse/internal/test_utils"
	"kamehouse/internal/util"
	"kamehouse/internal/util/limiter"
	"testing"

	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
)

func TestNewMediaFetcher(t *testing.T) {
	test_utils.InitTestProvider(t, test_utils.Anilist())

	if test_utils.ConfigData.Provider.AnilistJwt == "" {
		t.Skip("skipping test because AnilistJwt is not set")
	}

	anilistClient := anilist.TestGetMockAnilistClient()
	logger := util.NewLogger()
	database, err := db.NewDatabase(test_utils.ConfigData.Path.DataDir, test_utils.ConfigData.Database.Name, logger)
	if err != nil {
		t.Fatal(err)
	}
	anilistClientRef := util.NewRef(anilistClient)
	extensionBankRef := util.NewRef(extension.NewUnifiedBank())
	anilistPlatform := anilist_platform.NewAnilistPlatform(anilistClientRef, extensionBankRef, logger, database)
	anilistPlatform.SetUsername(test_utils.ConfigData.Provider.AnilistUsername)
	metadataProvider := metadata_provider.GetFakeProvider(t, database)
	completeAnimeCache := anilist.NewCompleteAnimeCache()
	anilistRateLimiter := limiter.NewAnilistLimiter()

	dir := "E:/Anime"

	tests := []struct {
		name                   string
		paths                  []string
		enhanced               bool
		disableAnimeCollection bool
	}{
		{
			name: "86 - Eighty Six Part 1 & 2",
			paths: []string{
				"E:/Anime/[SubsPlease] 86 - Eighty Six (01-23) (1080p) [Batch]/[SubsPlease] 86 - Eighty Six - 20v2 (1080p) [30072859].mkv",
				"E:/Anime/[SubsPlease] 86 - Eighty Six (01-23) (1080p) [Batch]/[SubsPlease] 86 - Eighty Six - 21v2 (1080p) [4B1616A5].mkv",
				"E:/Anime/[SubsPlease] 86 - Eighty Six (01-23) (1080p) [Batch]/[SubsPlease] 86 - Eighty Six - 22v2 (1080p) [58BF43B4].mkv",
				"E:/Anime/[SubsPlease] 86 - Eighty Six (01-23) (1080p) [Batch]/[SubsPlease] 86 - Eighty Six - 23v2 (1080p) [D94B4894].mkv",
			},
			enhanced:               false,
			disableAnimeCollection: false,
		},
		{
			name: "86 - Eighty Six Part 1 & 2",
			paths: []string{
				"E:/Anime/[SubsPlease] 86 - Eighty Six (01-23) (1080p) [Batch]/[SubsPlease] 86 - Eighty Six - 20v2 (1080p) [30072859].mkv",
				"E:/Anime/[SubsPlease] 86 - Eighty Six (01-23) (1080p) [Batch]/[SubsPlease] 86 - Eighty Six - 21v2 (1080p) [4B1616A5].mkv",
				"E:/Anime/[SubsPlease] 86 - Eighty Six (01-23) (1080p) [Batch]/[SubsPlease] 86 - Eighty Six - 22v2 (1080p) [58BF43B4].mkv",
				"E:/Anime/[SubsPlease] 86 - Eighty Six (01-23) (1080p) [Batch]/[SubsPlease] 86 - Eighty Six - 23v2 (1080p) [D94B4894].mkv",
			},
			enhanced:               true,
			disableAnimeCollection: true,
		},
	}

	for _, tt := range tests {

		t.Run(tt.name, func(t *testing.T) {

			scanLogger, err := NewConsoleScanLogger()
			if err != nil {
				t.Fatal("expected result, got error:", err.Error())
			}

			// +---------------------+
			// |   Local Files       |
			// +---------------------+

			var lfs []*dto.LocalFile
			for _, path := range tt.paths {
				lf := dto.NewLocalFile(path, dir)
				lfs = append(lfs, lf)
			}

			// +---------------------+
			// |    MediaFetcher     |
			// +---------------------+

			mf, err := NewMediaFetcher(t.Context(), &MediaFetcherOptions{
				Enhanced:               tt.enhanced,
				PlatformRef:            util.NewRef(anilistPlatform),
				LocalFiles:             lfs,
				CompleteAnimeCache:     completeAnimeCache,
				MetadataProviderRef:    util.NewRef(metadataProvider),
				MetadataProviders:      []librarymetadata.Provider{librarymetadata.NewAniListProvider(anilistClient)},
				Logger:                 util.NewLogger(),
				AnilistRateLimiter:     anilistRateLimiter,
				ScanLogger:             scanLogger,
				DisableAnimeCollection: tt.disableAnimeCollection,
			})
			if err != nil {
				t.Fatal("expected result, got error:", err.Error())
			}

			mc := NewMediaContainer(&MediaContainerOptions{
				AllMedia:   mf.AllMedia,
				ScanLogger: scanLogger,
			})

			for _, m := range mc.NormalizedMedia {
				t.Log(dto.GetTitleSafe(m))
			}

		})

	}

}

func TestNewEnhancedMediaFetcher(t *testing.T) {

	anilistClient := anilist.TestGetMockAnilistClient()
	logger := util.NewLogger()
	database, err := db.NewDatabase(test_utils.ConfigData.Path.DataDir, test_utils.ConfigData.Database.Name, logger)
	if err != nil {
		t.Fatal(err)
	}
	anilistClientRef := util.NewRef(anilistClient)
	extensionBankRef := util.NewRef(extension.NewUnifiedBank())
	anilistPlatform := anilist_platform.NewAnilistPlatform(anilistClientRef, extensionBankRef, logger, database)
	metaProvider := metadata_provider.GetFakeProvider(t, database)
	completeAnimeCache := anilist.NewCompleteAnimeCache()
	anilistRateLimiter := limiter.NewAnilistLimiter()

	dir := "E:/Anime"

	tests := []struct {
		name     string
		paths    []string
		enhanced bool
	}{
		{
			name: "86 - Eighty Six Part 1 & 2",
			paths: []string{
				"E:/Anime/[SubsPlease] 86 - Eighty Six (01-23) (1080p) [Batch]/[SubsPlease] 86 - Eighty Six - 20v2 (1080p) [30072859].mkv",
				"E:/Anime/[SubsPlease] 86 - Eighty Six (01-23) (1080p) [Batch]/[SubsPlease] 86 - Eighty Six - 21v2 (1080p) [4B1616A5].mkv",
				"E:/Anime/[SubsPlease] 86 - Eighty Six (01-23) (1080p) [Batch]/[SubsPlease] 86 - Eighty Six - 22v2 (1080p) [58BF43B4].mkv",
				"E:/Anime/[SubsPlease] 86 - Eighty Six (01-23) (1080p) [Batch]/[SubsPlease] 86 - Eighty Six - 23v2 (1080p) [D94B4894].mkv",
			},
			enhanced: false,
		},
	}

	for _, tt := range tests {

		t.Run(tt.name, func(t *testing.T) {

			scanLogger, err := NewScanLogger("./logs")
			if err != nil {
				t.Fatal("expected result, got error:", err.Error())
			}

			// +---------------------+
			// |   Local Files       |
			// +---------------------+

			var lfs []*dto.LocalFile
			for _, path := range tt.paths {
				lf := dto.NewLocalFile(path, dir)
				lfs = append(lfs, lf)
			}

			// +---------------------+
			// |    MediaFetcher     |
			// +---------------------+

			mf, err := NewMediaFetcher(t.Context(), &MediaFetcherOptions{
				Enhanced:            tt.enhanced,
				PlatformRef:         util.NewRef(anilistPlatform),
				LocalFiles:          lfs,
				CompleteAnimeCache:  completeAnimeCache,
				MetadataProviderRef: util.NewRef(metaProvider),
				MetadataProviders:   []librarymetadata.Provider{librarymetadata.NewAniListProvider(anilistClient)},
				Logger:              util.NewLogger(),
				AnilistRateLimiter:  anilistRateLimiter,
				ScanLogger:          scanLogger,
			})
			if err != nil {
				t.Fatal("expected result, got error:", err.Error())
			}

			mc := NewMediaContainer(&MediaContainerOptions{
				AllMedia:   mf.AllMedia,
				ScanLogger: scanLogger,
			})

			for _, m := range mc.NormalizedMedia {
				t.Log(dto.GetTitleSafe(m))
			}

		})

	}

}

func TestFetchMediaFromLocalFiles(t *testing.T) {

	if test_utils.ConfigData.Provider.AnilistJwt == "" {
		t.Skip("skipping test because AnilistJwt is not set")
	}

	anilistClient := anilist.TestGetMockAnilistClient()
	logger := util.NewLogger()
	_, err := db.NewDatabase(test_utils.ConfigData.Path.DataDir, test_utils.ConfigData.Database.Name, logger)
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name            string
		paths           []string
		expectedMediaId []int
	}{
		{
			name: "86 - Eighty Six Part 1 & 2",
			paths: []string{
				"E:/Anime/[SubsPlease] 86 - Eighty Six (01-23) (1080p) [Batch]/[SubsPlease] 86 - Eighty Six - 20v2 (1080p) [30072859].mkv",
				"E:/Anime/[SubsPlease] 86 - Eighty Six (01-23) (1080p) [Batch]/[SubsPlease] 86 - Eighty Six - 21v2 (1080p) [4B1616A5].mkv",
				"E:/Anime/[SubsPlease] 86 - Eighty Six (01-23) (1080p) [Batch]/[SubsPlease] 86 - Eighty Six - 22v2 (1080p) [58BF43B4].mkv",
				"E:/Anime/[SubsPlease] 86 - Eighty Six (01-23) (1080p) [Batch]/[SubsPlease] 86 - Eighty Six - 23v2 (1080p) [D94B4894].mkv",
			},
			expectedMediaId: []int{116589, 131586}, // 86 - Eighty Six Part 1 & 2
		},
	}

	dir := "E:/Anime"

	for _, tt := range tests {

		t.Run(tt.name, func(t *testing.T) {

			scanLogger, err := NewScanLogger("./logs")
			if err != nil {
				t.Fatal("expected result, got error:", err.Error())
			}

			// +---------------------+
			// |   Local Files       |
			// +---------------------+

			var lfs []*dto.LocalFile
			for _, path := range tt.paths {
				lf := dto.NewLocalFile(path, dir)
				lfs = append(lfs, lf)
			}

			// +--------------------------+
			// | FetchMediaFromLocalFiles |
			// +--------------------------+

			media, ok := FetchMediaFromLocalFiles(
				t.Context(),
				[]librarymetadata.Provider{librarymetadata.NewAniListProvider(anilistClient)},
				lfs,
				scanLogger,
			)
			if !ok {
				t.Fatal("could not fetch media from local files")
			}

			ids := lo.Map(media, func(k *dto.NormalizedMedia, _ int) int {
				return k.ID
			})

			// Test if all expected media IDs are present
			for _, id := range tt.expectedMediaId {
				assert.Contains(t, ids, id)
			}

			t.Log("Media IDs:")
			for _, m := range media {
				t.Log(dto.GetTitleSafe(m))
			}

		})
	}

}
