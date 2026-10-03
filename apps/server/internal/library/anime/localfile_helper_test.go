package anime_test

import (
	"testing"

	"kamehouse/internal/database/models/dto"

	"github.com/stretchr/testify/assert"
)

func TestLocalFile_GetNormalizedPath(t *testing.T) {

	tests := []struct {
		filePath       string
		libraryPath    string
		expectedResult string
	}{
		{
			filePath:       "E:/Anime/Bungou Stray Dogs 5th Season/Bungou Stray Dogs/[SubsPlease] Bungou Stray Dogs - 61 (1080p) [F609B947].mkv",
			libraryPath:    "E:/ANIME",
			expectedResult: "e:/anime/bungou stray dogs 5th season/bungou stray dogs/[subsplease] bungou stray dogs - 61 (1080p) [f609b947].mkv",
		},
		{
			filePath:       "E:/Anime/Shakugan No Shana/Shakugan No Shana I/Opening/OP01.mkv",
			libraryPath:    "E:/ANIME",
			expectedResult: "e:/anime/shakugan no shana/shakugan no shana i/opening/op01.mkv",
		},
	}

	for _, tt := range tests {
		t.Run(tt.filePath, func(t *testing.T) {
			lf := dto.NewLocalFile(tt.filePath, tt.libraryPath)

			if assert.NotNil(t, lf) {

				if assert.Equal(t, tt.expectedResult, lf.GetNormalizedPath()) {
					t.Log(lf.GetNormalizedPath())
				}
			}

		})
	}

}

func TestLocalFile_GetParsedTitle(t *testing.T) {

	tests := []struct {
		filePath            string
		libraryPath         string
		expectedParsedTitle string
	}{
		{
			filePath:            "E:/Anime/Bungou Stray Dogs 5th Season/Bungou Stray Dogs/[SubsPlease] Bungou Stray Dogs - 61 (1080p) [F609B947].mkv",
			libraryPath:         "E:/ANIME",
			expectedParsedTitle: "Bungou Stray Dogs",
		},
		{
			filePath:            "E:/Anime/Shakugan No Shana/Shakugan No Shana I/Opening/OP01.mkv",
			libraryPath:         "E:/ANIME",
			expectedParsedTitle: "Shakugan No Shana I",
		},
	}

	for _, tt := range tests {
		t.Run(tt.filePath, func(t *testing.T) {
			lf := dto.NewLocalFile(tt.filePath, tt.libraryPath)

			if assert.NotNil(t, lf) {

				if assert.Equal(t, tt.expectedParsedTitle, lf.GetParsedTitle()) {
					t.Log(lf.GetParsedTitle())
				}
			}

		})
	}

}

func TestLocalFile_GetFolderTitle(t *testing.T) {

	tests := []struct {
		filePath            string
		libraryPath         string
		expectedFolderTitle string
	}{
		{
			filePath:            "E:/Anime/Bungou Stray Dogs 5th Season/S05E11 - Episode Title.mkv",
			libraryPath:         "E:/ANIME",
			expectedFolderTitle: "Bungou Stray Dogs",
		},
		{
			filePath:            "E:/Anime/Shakugan No Shana/Shakugan No Shana I/Opening/OP01.mkv",
			libraryPath:         "E:/ANIME",
			expectedFolderTitle: "Shakugan No Shana I",
		},
	}

	for _, tt := range tests {
		t.Run(tt.filePath, func(t *testing.T) {
			lf := dto.NewLocalFile(tt.filePath, tt.libraryPath)

			if assert.NotNil(t, lf) {

				if assert.Equal(t, tt.expectedFolderTitle, lf.GetFolderTitle()) {
					t.Log(lf.GetFolderTitle())
				}
			}

		})
	}

}
