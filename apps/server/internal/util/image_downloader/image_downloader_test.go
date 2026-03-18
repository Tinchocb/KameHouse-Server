//go:build integration

package image_downloader

import (
	"fmt"
	"kamehouse/internal/util"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestImageDownloader_DownloadImages(t *testing.T) {
	t.Skip("Skipping: requires live CDN access (integration test)")
	tests := []struct {
		name        string
		urls        []string
		downloadDir string
		expectedNum int
		cancelAfter int
	}{
		{
			name: "test1",
			urls: []string{
				"https://placehold.co/600x400.jpg",
				"https://placehold.co/600x400.jpg",
				"https://placehold.co/400x600.jpg",
			},
			downloadDir: t.TempDir(),
			expectedNum: 2,
			cancelAfter: 0,
		},
		//{
		//	name:        "test1",
		//	urls:        []string{"https://placehold.co/600x400.jpg"},
		//	downloadDir: t.TempDir(),
		//	cancelAfter: 0,
		//},
	}

	for _, tt := range tests {

		t.Run(tt.name, func(t *testing.T) {

			id := NewImageDownloader(tt.downloadDir, util.NewLogger())

			if tt.cancelAfter > 0 {
				go func() {
					time.Sleep(time.Duration(tt.cancelAfter) * time.Second)
					close(id.cancelChannel)
				}()
			}

			fmt.Print(tt.downloadDir)

			if err := id.DownloadImages(tt.urls); err != nil {
				t.Errorf("ImageDownloader.DownloadImages() error = %v", err)
			}

			downloadedImages := make(map[string]string, 0)
			for _, url := range tt.urls {
				imgPath, ok := id.GetImageFilenameByUrl(url)
				downloadedImages[imgPath] = imgPath
				if !ok {
					t.Errorf("ImageDownloader.GetImagePathByUrl() error")
				} else {
					t.Logf("ImageDownloader.GetImagePathByUrl() = %v", imgPath)
				}
			}

			require.Len(t, downloadedImages, tt.expectedNum)
		})

	}

	time.Sleep(1 * time.Second)
}
