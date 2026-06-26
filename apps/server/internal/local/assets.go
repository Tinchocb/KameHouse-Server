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

func FormatAssetUrl(mediaID int, filename string) *string {
	a := fmt.Sprintf("{{LOCAL_ASSETS}}/%d/%s", mediaID, filename)
	return &a
}

func DownloadAnimeEpisodeImages(logger *zerolog.Logger, assetsDir string, mID int, episodeImageUrls map[string]string) (map[string]string, bool) {
	defer util.HandlePanicInModuleThen("assets/DownloadAnimeEpisodeImages", func() {})

	logger.Trace().Msgf("local manager: Downloading %d episode images for anime %d", len(episodeImageUrls), mID)

	mediaAssetPath := filepath.Join(assetsDir, fmt.Sprintf("%d", mID))
	imageDownloader := image_downloader.NewImageDownloader(mediaAssetPath, logger)
	imgUrls := make([]string, 0, len(episodeImageUrls))
	for _, episodeImage := range episodeImageUrls {
		if episodeImage == "" {
			continue
		}
		imgUrls = append(imgUrls, episodeImage)
	}

	err := imageDownloader.DownloadImages(imgUrls)
	if err != nil {
		logger.Error().Err(err).Msgf("local manager: Failed to download images for anime %d", mID)
		return nil, false
	}

	images, err := imageDownloader.GetImageFilenamesByUrls(imgUrls)
	if err != nil {
		logger.Error().Err(err).Msgf("local manager: Failed to get image filenames for anime %d", mID)
		return nil, false
	}

	episodeImagePaths := make(map[string]string)
	for episodeNum, episodeImage := range episodeImageUrls {
		episodeImagePaths[episodeNum] = images[episodeImage]
	}

	return episodeImagePaths, true
}

func DownloadAnimeImages(logger *zerolog.Logger, assetsDir string, entry *platform.UnifiedCollectionEntry, animeMetadata *metadata.AnimeMetadata, metadataWrapper metadata_provider.AnimeMetadataWrapper, lfs []*dto.LocalFile) (string, string, map[string]string, bool) {
	defer util.HandlePanicInModuleThen("assets/DownloadAnimeImages", func() {})

	mID := entry.Media.ID
	logger.Trace().Msgf("local manager: Downloading images for anime %d", mID)

	mediaAssetPath := filepath.Join(assetsDir, fmt.Sprintf("%d", mID))
	imageDownloader := image_downloader.NewImageDownloader(mediaAssetPath, logger)

	imgUrls := make([]string, 0)
	if entry.Media.BannerImage != nil && *entry.Media.BannerImage != "" {
		imgUrls = append(imgUrls, *entry.Media.BannerImage)
	}
	if entry.Media.GetCoverImageSafe() != "" {
		imgUrls = append(imgUrls, entry.Media.GetCoverImageSafe())
	}

	mediaLfs := lo.Filter(lfs, func(lf *dto.LocalFile, _ int) bool {
		return lf.MediaID == mID
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
		logger.Error().Err(err).Msgf("local manager: Failed to download images for anime %d", mID)
		return "", "", nil, false
	}

	images, err := imageDownloader.GetImageFilenamesByUrls(imgUrls)
	if err != nil {
		logger.Error().Err(err).Msgf("local manager: Failed to get image filenames for anime %d", mID)
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