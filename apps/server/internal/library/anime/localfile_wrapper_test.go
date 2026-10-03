package anime_test

import (
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/anime"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLocalFileWrapperEntry(t *testing.T) {

	lfs := anime.MockHydratedLocalFiles(
		anime.MockGenerateHydratedLocalFileGroupOptions("/mnt/anime/", "/mnt/anime/One Piece/One Piece - %ep.mkv", 21, []anime.MockHydratedLocalFileWrapperOptionsMetadata{
			{MetadataEpisode: 1070, MetadataAniDbEpisode: "1070", MetadataType: dto.LocalFileTypeMain},
			{MetadataEpisode: 1071, MetadataAniDbEpisode: "1071", MetadataType: dto.LocalFileTypeMain},
			{MetadataEpisode: 1072, MetadataAniDbEpisode: "1072", MetadataType: dto.LocalFileTypeMain},
			{MetadataEpisode: 1073, MetadataAniDbEpisode: "1073", MetadataType: dto.LocalFileTypeMain},
			{MetadataEpisode: 1074, MetadataAniDbEpisode: "1074", MetadataType: dto.LocalFileTypeMain},
		}),
		anime.MockGenerateHydratedLocalFileGroupOptions("/mnt/anime/", "/mnt/anime/Blue Lock/Blue Lock - %ep.mkv", 22222, []anime.MockHydratedLocalFileWrapperOptionsMetadata{
			{MetadataEpisode: 1, MetadataAniDbEpisode: "1", MetadataType: dto.LocalFileTypeMain},
			{MetadataEpisode: 2, MetadataAniDbEpisode: "2", MetadataType: dto.LocalFileTypeMain},
			{MetadataEpisode: 3, MetadataAniDbEpisode: "3", MetadataType: dto.LocalFileTypeMain},
		}),
		anime.MockGenerateHydratedLocalFileGroupOptions("/mnt/anime/", "/mnt/anime/Kimi ni Todoke/Kimi ni Todoke - %ep.mkv", 9656, []anime.MockHydratedLocalFileWrapperOptionsMetadata{
			{MetadataEpisode: 0, MetadataAniDbEpisode: "S1", MetadataType: dto.LocalFileTypeMain},
			{MetadataEpisode: 1, MetadataAniDbEpisode: "1", MetadataType: dto.LocalFileTypeMain},
			{MetadataEpisode: 2, MetadataAniDbEpisode: "2", MetadataType: dto.LocalFileTypeMain},
		}),
	)

	tests := []struct {
		name                              string
		mediaID                           int
		expectedNbMainLocalFiles          int
		expectedLatestEpisode             int
		expectedEpisodeNumberAfterEpisode []int
	}{
		{
			name:                              "One Piece",
			mediaID:                           21,
			expectedNbMainLocalFiles:          5,
			expectedLatestEpisode:             1074,
			expectedEpisodeNumberAfterEpisode: []int{1071, 1072},
		},
		{
			name:                              "Blue Lock",
			mediaID:                           22222,
			expectedNbMainLocalFiles:          3,
			expectedLatestEpisode:             3,
			expectedEpisodeNumberAfterEpisode: []int{2, 3},
		},
	}

	lfw := anime.NewLocalFileWrapper(lfs)

	// Not empty
	if assert.Greater(t, len(lfw.LocalEntries), 0) {

		for _, tt := range tests {

			// Can get by id
			entry, ok := lfw.GetLocalEntryById(tt.mediaID)
			if assert.Truef(t, ok, "could not find entry for %s", tt.name) {

				assert.Equalf(t, tt.mediaID, entry.MediaID, "media id does not match for %s", tt.name)

				// Can get main local files
				mainLfs, ok := entry.GetMainLocalFiles()
				if assert.Truef(t, ok, "could not find main local files for %s", tt.name) {

					// Number of main local files matches
					assert.Equalf(t, tt.expectedNbMainLocalFiles, len(mainLfs), "number of main local files does not match for %s", tt.name)
				}

				// Can get unwatched files
				unwatched := entry.GetUnwatchedLocalFiles(0)
				assert.Equalf(t, tt.expectedNbMainLocalFiles, len(unwatched), "all main files should be unwatched at progress 0 for %s", tt.name)
			}

		}

	}

}

