package local

import (
	"fmt"
	"kamehouse/internal/api/metadata"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"kamehouse/internal/util/image_downloader"
	"path/filepath"

	"github.com/goccy/go-json"
	"github.com/rs/zerolog"
	"github.com/samber/lo"
)

// UnifiedMediaDeepCopy creates a deep copy of the given unified media struct.
func UnifiedMediaDeepCopy(media *platform.UnifiedMedia) *platform.UnifiedMedia {
	bytes, err := json.Marshal(media)
	if err != nil {
		return nil
	}

	deepCopy := &platform.UnifiedMedia{}
	err = json.Unmarshal(bytes, deepCopy)
	if err != nil {
		return nil
	}

	deepCopy.NextAiringEpisode = nil

	return deepCopy
}

func ToNewPointer[A any](a *A) *A {
	if a == nil {
		return nil
	}
	t := *a
	return &t
}

func IntPointerValue[A int](a *A) A {
	if a == nil {
		return 0
	}
	return *a
}

func Float64PointerValue[A float64](a *A) A {
	if a == nil {
		return 0
	}
	return *a
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// DownloadAnimeEpisodeImages saves the episode images for the given anime media ID.
// This should be used to update the episode images for an anime, e.g. after a new episode is released.
//
// The episodeImageUrls map should be in the format of {"1": "url1", "2": "url2", ...}, where the key is the episode number (defined in metadata.AnimeMetadata).
// It will download the images to the `<assetsDir>/<mId>` directory and return a map of episode numbers to the downloaded image filenames.
//
//	DownloadAnimeEpisodeImages(logger, "path/to/datadir/local/assets", 123, map[string]string{"1": "url1", "2": "url2"})
//	-> map[string]string{"1": "filename1.jpg", "2": "filename2.jpg"}
func DownloadAnimeEpisodeImages(logger *zerolog.Logger, assetsDir string, mId int, episodeImageUrls map[string]string) (map[string]string, bool) {
	defer util.HandlePanicInModuleThen("sync/DownloadAnimeEpisodeImages", func() {})

	logger.Trace().Msgf("local manager: Downloading %d episode images for anime %d", len(episodeImageUrls), mId)

	// e.g. /path/to/datadir/local/assets/123
	mediaAssetPath := filepath.Join(assetsDir, fmt.Sprintf("%d", mId))
	imageDownloader := image_downloader.NewImageDownloader(mediaAssetPath, logger)
	// Download the images
	imgUrls := make([]string, 0, len(episodeImageUrls))
	for _, episodeImage := range episodeImageUrls {
		if episodeImage == "" {
			continue
		}
		imgUrls = append(imgUrls, episodeImage)
	}

	err := imageDownloader.DownloadImages(imgUrls)
	if err != nil {
		logger.Error().Err(err).Msgf("local manager: Failed to download images for anime %d", mId)
		return nil, false
	}

	images, err := imageDownloader.GetImageFilenamesByUrls(imgUrls)
	if err != nil {
		logger.Error().Err(err).Msgf("local manager: Failed to get image filenames for anime %d", mId)
		return nil, false
	}

	episodeImagePaths := make(map[string]string)
	for episodeNum, episodeImage := range episodeImageUrls {
		episodeImagePaths[episodeNum] = images[episodeImage]
	}

	return episodeImagePaths, true
}

// DownloadAnimeImages saves the banner and cover images for the given anime list entry.
// It will also download the episode images for the anime.
// It will return the downloaded banner and cover filenames, and a map of episode numbers to the downloaded episode image filenames.
func DownloadAnimeImages(logger *zerolog.Logger, assetsDir string, entry *platform.UnifiedCollectionEntry, animeMetadata *metadata.AnimeMetadata, metadataWrapper metadata_provider.AnimeMetadataWrapper, lfs []*dto.LocalFile) (string, string, map[string]string, bool) {
	defer util.HandlePanicInModuleThen("sync/DownloadAnimeImages", func() {})

	mId := entry.Media.ID
	logger.Trace().Msgf("local manager: Downloading images for anime %d", mId)

	// e.g. /path/to/datadir/local/assets/123
	mediaAssetPath := filepath.Join(assetsDir, fmt.Sprintf("%d", mId))
	imageDownloader := image_downloader.NewImageDownloader(mediaAssetPath, logger)

	// Get all images
	imgUrls := make([]string, 0)
	if entry.Media.BannerImage != nil && *entry.Media.BannerImage != "" {
		imgUrls = append(imgUrls, *entry.Media.BannerImage)
	}
	if entry.Media.GetCoverImageSafe() != "" {
		imgUrls = append(imgUrls, entry.Media.GetCoverImageSafe())
	}

	// Filter local files for the current media
	mediaLfs := lo.Filter(lfs, func(lf *dto.LocalFile, _ int) bool {
		return lf.MediaId == mId
	})

	episodeImageUrls := make(map[string]string)
	for _, lf := range mediaLfs {
		if lf.Metadata.AniDBEpisode == "" {
			continue
		}
		epMetadata := metadataWrapper.GetEpisodeMetadata(lf.Metadata.AniDBEpisode)
		if epMetadata.Image == "" {
			continue
		}
		episodeImageUrls[lf.Metadata.AniDBEpisode] = epMetadata.Image
		imgUrls = append(imgUrls, epMetadata.Image)
	}

	err := imageDownloader.DownloadImages(imgUrls)
	if err != nil {
		logger.Error().Err(err).Msgf("local manager: Failed to download images for anime %d", mId)
		return "", "", nil, false
	}

	images, err := imageDownloader.GetImageFilenamesByUrls(imgUrls)
	if err != nil {
		logger.Error().Err(err).Msgf("local manager: Failed to get image filenames for anime %d", mId)
		return "", "", nil, false
	}

	bannerImage := ""
	if entry.Media.BannerImage != nil {
		bannerImage = images[*entry.Media.BannerImage]
	}
	coverImage := images[entry.Media.GetCoverImageSafe()]

	episodeImagePaths := make(map[string]string)
	for epNum, epImageUrl := range episodeImageUrls {
		episodeImagePaths[epNum] = images[epImageUrl]
	}

	return bannerImage, coverImage, episodeImagePaths, true
}
