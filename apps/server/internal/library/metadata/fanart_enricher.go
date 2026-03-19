package metadata

import (
	"context"
	"strconv"

	"kamehouse/internal/api/fanart"
	"kamehouse/internal/database/models/dto"
)

// FanArtEnricher enriches a NormalizedMedia with HD logos, clearart, and thumbs from FanArt.tv.
// It is NOT a full Provider (no SearchMedia) — it is an enricher called after a match is found.
//
// FanArt.tv free API key: https://fanart.tv/get-an-api-key/
// Rate limit: ~90 requests/minute
type FanArtEnricher struct {
	client *fanart.Client
	lang   string // preferred language code, e.g. "en", "es"
}

// NewFanArtEnricher creates a new FanArt.tv enricher.
// lang is the ISO 639-1 language preference for image lookup (e.g. "en", "es"). Defaults to "en".
func NewFanArtEnricher(apiKey string, lang ...string) *FanArtEnricher {
	language := "en"
	if len(lang) > 0 && lang[0] != "" {
		language = lang[0]
	}
	return &FanArtEnricher{
		client: fanart.NewClient(apiKey),
		lang:   language,
	}
}

// EnrichTV fills LogoImage, ThumbImage, and ClearArtImage on the given NormalizedMedia
// for a TV show using its TVDB ID (preferred) or falls back to a text search.
//
// tvdbID  — TVDB ID string (from NFO or cross-reference). Required.
func (e *FanArtEnricher) EnrichTV(ctx context.Context, media *dto.NormalizedMedia, tvdbID string) error {
	if media == nil || tvdbID == "" {
		return nil
	}

	images, err := e.client.GetTVImages(ctx, tvdbID)
	if err != nil {
		// Non-fatal: enrichment is best-effort
		return nil
	}

	if logo := fanart.BestImage(images.HdTVLogo, e.lang); logo != "" {
		media.LogoImage = &logo
	}
	if thumb := fanart.BestImage(images.TVThumb, e.lang); thumb != "" {
		media.ThumbImage = &thumb
	}
	if clearart := fanart.BestImage(images.ClearArt, e.lang); clearart != "" {
		media.ClearArtImage = &clearart
	}
	// Use FanArt banner only if we don't already have one from TMDb
	if media.BannerImage == nil {
		if banner := fanart.BestImage(images.Backgrounds, e.lang); banner != "" {
			media.BannerImage = &banner
		}
	}

	return nil
}

// EnrichMovie fills LogoImage, ThumbImage, and ClearArtImage on the given NormalizedMedia
// for a movie using its TMDb ID.
func (e *FanArtEnricher) EnrichMovie(ctx context.Context, media *dto.NormalizedMedia, tmdbID int) error {
	if media == nil || tmdbID <= 0 {
		return nil
	}

	images, err := e.client.GetMovieImages(ctx, strconv.Itoa(tmdbID))
	if err != nil {
		return nil // Non-fatal
	}

	if logo := fanart.BestImage(images.HdLogo, e.lang); logo != "" {
		media.LogoImage = &logo
	}
	if thumb := fanart.BestImage(images.Thumb, e.lang); thumb != "" {
		media.ThumbImage = &thumb
	}
	if clearart := fanart.BestImage(images.ClearArt, e.lang); clearart != "" {
		media.ClearArtImage = &clearart
	}
	if media.BannerImage == nil {
		if bg := fanart.BestImage(images.Background, e.lang); bg != "" {
			media.BannerImage = &bg
		}
	}

	return nil
}
