package metadata

import (
	"context"
	"fmt"
	"strings"

	"kamehouse/internal/api/omdb"
	"kamehouse/internal/database/models/dto"
)

// OMDbEnricher enriches a NormalizedMedia with ratings, runtime, director, and awards from OMDb.
// It is NOT a full Provider (no SearchMedia) — it is an enricher called after a match is found.
//
// OMDb free API key (1,000 req/day): https://www.omdbapi.com/apikey.aspx
// Lookup requires an IMDb ID (tt-prefixed), which comes from the NFO or TMDb cross-reference.
type OMDbEnricher struct {
	client *omdb.Client
}

// NewOMDbEnricher creates a new OMDb enricher.
func NewOMDbEnricher(apiKey string) *OMDbEnricher {
	return &OMDbEnricher{
		client: omdb.NewClient(apiKey),
	}
}

// EnrichByImdbID fills rating/runtime/awards fields on the given NormalizedMedia using its IMDb ID.
// imdbID must be in the format "tt1234567".
// Non-fatal — enrichment failures are silently ignored.
func (e *OMDbEnricher) EnrichByImdbID(ctx context.Context, media *dto.NormalizedMedia, imdbID string) error {
	if media == nil || imdbID == "" {
		return nil
	}

	info, err := e.client.GetByImdbID(ctx, imdbID)
	if err != nil {
		return nil // Non-fatal
	}

	e.applyToMedia(media, info)
	return nil
}

// EnrichByTitle falls back to title+year lookup when an IMDb ID is not available.
// Non-fatal — enrichment failures are silently ignored.
func (e *OMDbEnricher) EnrichByTitle(ctx context.Context, media *dto.NormalizedMedia, title string, year int) error {
	if media == nil || title == "" {
		return nil
	}

	info, err := e.client.GetByTitle(ctx, title, year)
	if err != nil {
		return nil // Non-fatal
	}

	e.applyToMedia(media, info)
	return nil
}

func (e *OMDbEnricher) applyToMedia(media *dto.NormalizedMedia, info *omdb.MovieInfo) {
	if info.ImdbRating != "" && info.ImdbRating != "N/A" {
		media.ImdbRating = &info.ImdbRating
	}
	if info.ImdbVotes != "" && info.ImdbVotes != "N/A" {
		media.ImdbVotes = &info.ImdbVotes
	}
	if info.Runtime != "" && info.Runtime != "N/A" {
		// OMDb returns "148 min". Extract the number.
		var r int
		if _, err := fmt.Sscanf(info.Runtime, "%d", &r); err == nil && r > 0 {
			media.Runtime = &r
		}
	}
	if info.Director != "" && info.Director != "N/A" {
		media.Director = &info.Director
	}
	if info.Awards != "" && info.Awards != "N/A" {
		media.Awards = &info.Awards
	}
	if info.Rated != "" && info.Rated != "N/A" {
		media.Rated = &info.Rated
	}
	// Extract Rotten Tomatoes rating from the Ratings array
	for _, rating := range info.Ratings {
		if strings.Contains(rating.Source, "Rotten Tomatoes") {
			rt := rating.Value
			media.RTRating = &rt
			break
		}
	}
	// Also enrich description if not already set
	if media.Description == nil && info.Plot != "" && info.Plot != "N/A" {
		media.Description = &info.Plot
	}
}
