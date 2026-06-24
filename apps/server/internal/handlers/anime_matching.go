package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	librarymetadata "kamehouse/internal/library/metadata"
	"kamehouse/internal/util"
)

func matchesAnyRequestedPath(localFilePath string, requestedPaths []string) bool {
	localNormalized := util.NormalizePath(localFilePath)
	for _, requestedPath := range requestedPaths {
		requestedNormalized := strings.TrimSuffix(util.NormalizePath(requestedPath), "/")
		if requestedNormalized == "" {
			continue
		}
		if localNormalized == requestedNormalized {
			return true
		}
		if strings.HasPrefix(localNormalized, requestedNormalized+"/") {
			return true
		}
	}
	return false
}

func ensureManualMatchMetadata(lf *dto.LocalFile) {
	if lf.Metadata == nil {
		lf.Metadata = &dto.LocalFileMetadata{}
	}
	if lf.Metadata.Type == "" {
		lf.Metadata.Type = dto.LocalFileTypeMain
	}
	if lf.ParsedData == nil || lf.ParsedData.Episode == "" {
		return
	}
	episode, err := strconv.Atoi(lf.ParsedData.Episode)
	if err != nil {
		return
	}
	if lf.Metadata.Episode == 0 {
		lf.Metadata.Episode = episode
	}
	if lf.Metadata.AniDBEpisode == "" {
		lf.Metadata.AniDBEpisode = fmt.Sprintf("%d", episode)
	}
}

func (h *Handler) getLibraryMediaIDForMedia(mediaID int, lfs []*dto.LocalFile) uint {
	for _, lf := range lfs {
		if lf.MediaID == mediaID && lf.LibraryMediaId > 0 {
			return lf.LibraryMediaId
		}
	}
	return 0
}

func (h *Handler) ensureLibraryMediaForManualMatch(ctx context.Context, mediaID int, lfs []*dto.LocalFile) (uint, error) {
	if existingID := h.getLibraryMediaIDForMedia(mediaID, lfs); existingID > 0 {
		return existingID, nil
	}

	if h.App.Metadata.TMDBClient == nil {
		return 0, errors.New("tmdb client is not configured")
	}

	provider := librarymetadata.NewTMDBProviderWithClient(h.App.Metadata.TMDBClient, h.App.Database)
	media, err := provider.GetMediaDetails(ctx, strconv.Itoa(mediaID))
	if err != nil {
		return 0, err
	}
	if media == nil {
		return 0, errors.New("media details not found")
	}

	saved, err := db.InsertLibraryMedia(h.App.Database, normalizedMediaToLibraryMedia(media))
	if err != nil {
		return 0, err
	}

	return saved.ID, nil
}

func normalizedMediaToLibraryMedia(media *dto.NormalizedMedia) *models.LibraryMedia {
	ret := &models.LibraryMedia{
		Type:           "SHOW",
		Format:         "TV",
		MetadataStatus: "COMPLETE",
	}

	if media == nil {
		return ret
	}

	if media.Format != nil {
		ret.Format = string(*media.Format)
		if ret.Format == "MOVIE" {
			ret.Type = "MOVIE"
		}
	}
	if media.TmdbID != nil {
		ret.TmdbID = *media.TmdbID
	}
	if media.Title != nil {
		if media.Title.Native != nil {
			ret.TitleOriginal = *media.Title.Native
		}
		if media.Title.Romaji != nil {
			ret.TitleRomaji = *media.Title.Romaji
		}
		if media.Title.English != nil {
			ret.TitleEnglish = *media.Title.English
		}
		if media.Title.Spanish != nil {
			ret.TitleSpanish = *media.Title.Spanish
		}
		if ret.TitleEnglish == "" && media.Title.UserPreferred != nil {
			ret.TitleEnglish = *media.Title.UserPreferred
		}
	}
	if media.Description != nil {
		ret.Description = *media.Description
	}
	if media.Score != nil {
		ret.Score = *media.Score
	}
	if len(media.Genres) > 0 {
		if b, err := json.Marshal(media.Genres); err == nil {
			ret.Genres = b
		}
	}
	if media.CoverImage != nil && media.CoverImage.Large != nil {
		ret.PosterImage = *media.CoverImage.Large
	}
	if media.BannerImage != nil {
		ret.BannerImage = *media.BannerImage
	}
	if media.Year != nil {
		ret.Year = *media.Year
	}
	if media.Episodes != nil {
		ret.TotalEpisodes = *media.Episodes
	}
	if media.Status != nil {
		ret.Status = string(*media.Status)
	}
	if media.MetadataStatus != nil && *media.MetadataStatus != "" {
		ret.MetadataStatus = *media.MetadataStatus
	}

	return ret
}
