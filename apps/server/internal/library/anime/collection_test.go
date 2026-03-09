package anime_test

import (
	"context"
	"kamehouse/internal/api/anilist"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/extension"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/platforms/anilist_platform"
	"kamehouse/internal/test_utils"
	"kamehouse/internal/util"
	"testing"

	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
)

func TestNewLibraryCollection(t *testing.T) {
	test_utils.InitTestProvider(t, test_utils.Anilist())
	logger := util.NewLogger()

	database, err := db.NewDatabase(context.Background(), t.TempDir(), "test", logger)
	assert.NoError(t, err)

	metadataProvider := metadata_provider.GetFakeProvider(t, database)

	anilistClient := anilist.TestGetMockAnilistClient()
	anilistPlatform := anilist_platform.NewAnilistPlatform(util.NewRef(anilistClient), util.NewRef(extension.NewUnifiedBank()), logger, database)

	animeCollection, err := anilistPlatform.GetAnimeCollection(t.Context(), false)

	if assert.NoError(t, err) {

		// Mock Anilist collection and local files
		// User is currently watching Sousou no Frieren and One Piece
		lfs := make([]*dto.LocalFile, 0)

		// Sousou no Frieren
		// 7 episodes downloaded, 4 watched
		mediaId := 154587
		lfs = append(lfs, anime.MockHydratedLocalFiles(
			anime.MockGenerateHydratedLocalFileGroupOptions("E:/Anime", "E:\\Anime\\Sousou no Frieren\\[SubsPlease] Sousou no Frieren - %ep (1080p) [F02B9CEE].mkv", mediaId, []anime.MockHydratedLocalFileWrapperOptionsMetadata{
				{MetadataEpisode: 1, MetadataAniDbEpisode: "1", MetadataType: dto.LocalFileTypeMain},
				{MetadataEpisode: 2, MetadataAniDbEpisode: "2", MetadataType: dto.LocalFileTypeMain},
				{MetadataEpisode: 3, MetadataAniDbEpisode: "3", MetadataType: dto.LocalFileTypeMain},
				{MetadataEpisode: 4, MetadataAniDbEpisode: "4", MetadataType: dto.LocalFileTypeMain},
				{MetadataEpisode: 5, MetadataAniDbEpisode: "5", MetadataType: dto.LocalFileTypeMain},
				{MetadataEpisode: 6, MetadataAniDbEpisode: "6", MetadataType: dto.LocalFileTypeMain},
				{MetadataEpisode: 7, MetadataAniDbEpisode: "7", MetadataType: dto.LocalFileTypeMain},
			}),
		)...)
		anilist.TestModifyAnimeCollectionEntry(animeCollection, mediaId, anilist.TestModifyAnimeCollectionEntryInput{
			Status:   lo.ToPtr(anilist.MediaListStatusCurrent),
			Progress: lo.ToPtr(4), // Mock progress
		})

		// One Piece
		// Downloaded 1070-1075 but only watched up until 1060
		mediaId = 21
		lfs = append(lfs, anime.MockHydratedLocalFiles(
			anime.MockGenerateHydratedLocalFileGroupOptions("E:/Anime", "E:\\Anime\\One Piece\\[SubsPlease] One Piece - %ep (1080p) [F02B9CEE].mkv", mediaId, []anime.MockHydratedLocalFileWrapperOptionsMetadata{
				{MetadataEpisode: 1070, MetadataAniDbEpisode: "1070", MetadataType: dto.LocalFileTypeMain},
				{MetadataEpisode: 1071, MetadataAniDbEpisode: "1071", MetadataType: dto.LocalFileTypeMain},
				{MetadataEpisode: 1072, MetadataAniDbEpisode: "1072", MetadataType: dto.LocalFileTypeMain},
				{MetadataEpisode: 1073, MetadataAniDbEpisode: "1073", MetadataType: dto.LocalFileTypeMain},
				{MetadataEpisode: 1074, MetadataAniDbEpisode: "1074", MetadataType: dto.LocalFileTypeMain},
				{MetadataEpisode: 1075, MetadataAniDbEpisode: "1075", MetadataType: dto.LocalFileTypeMain},
			}),
		)...)
		anilist.TestModifyAnimeCollectionEntry(animeCollection, mediaId, anilist.TestModifyAnimeCollectionEntryInput{
			Status:   lo.ToPtr(anilist.MediaListStatusCurrent),
			Progress: lo.ToPtr(1060), // Mock progress
		})

		// Add unmatched local files
		mediaId = 0
		lfs = append(lfs, anime.MockHydratedLocalFiles(
			anime.MockGenerateHydratedLocalFileGroupOptions("E:/Anime", "E:\\Anime\\Unmatched\\[SubsPlease] Unmatched - %ep (1080p) [F02B9CEE].mkv", mediaId, []anime.MockHydratedLocalFileWrapperOptionsMetadata{
				{MetadataEpisode: 1, MetadataAniDbEpisode: "1", MetadataType: dto.LocalFileTypeMain},
				{MetadataEpisode: 2, MetadataAniDbEpisode: "2", MetadataType: dto.LocalFileTypeMain},
				{MetadataEpisode: 3, MetadataAniDbEpisode: "3", MetadataType: dto.LocalFileTypeMain},
				{MetadataEpisode: 4, MetadataAniDbEpisode: "4", MetadataType: dto.LocalFileTypeMain},
			}),
		)...)

		libraryCollection, err := anime.NewLibraryCollection(t.Context(), &anime.NewLibraryCollectionOptions{
			Database:            database,
			LocalFiles:          lfs,
			PlatformRef:         util.NewRef(anilistPlatform),
			MetadataProviderRef: util.NewRef(metadataProvider),
		})

		if assert.NoError(t, err) {

			assert.Equal(t, 0, len(libraryCollection.ContinueWatchingList)) // Only Sousou no Frieren is in the continue watching list
			assert.Equal(t, 4, len(libraryCollection.UnmatchedLocalFiles))  // 4 unmatched local files

		}
	}

}
