package handlers

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	json "github.com/goccy/go-json"
	"github.com/labstack/echo/v4"
)

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

// AddonSubtitleEntry is a single subtitle track returned by an HTTP Addon.
type AddonSubtitleEntry struct {
	ID   string `json:"id"`
	Lang string `json:"lang"` // ISO 639-1 code (e.g. "en", "es", "ja")
	URL  string `json:"url"`  // Direct URL to the subtitle file (VTT/SRT)
}

// addonSubtitleResponse is the expected JSON shape from an addon's /subtitles/ endpoint.
type addonSubtitleResponse struct {
	Subtitles []AddonSubtitleEntry `json:"subtitles"`
}

// ──────────────────────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────────────────────

// HandleGetAddonSubtitles
//
//	@summary returns aggregated subtitle tracks from all installed HTTP Addons.
//	@desc    For each installed extension that exposes a manifest URI, this handler
//	         fetches /subtitles/{type}/{id}.json and merges the results.
//	@route /api/v1/addons/subtitles/:type/:id [GET]
func (h *Handler) HandleGetAddonSubtitles(c echo.Context) error {
	mediaType := c.Param("type") // e.g. "series", "movie"
	mediaId := c.Param("id")     // e.g. "12345"

	if mediaType == "" || mediaId == "" {
		return c.JSON(http.StatusBadRequest, NewErrorResponse(fmt.Errorf("missing type or id parameter")))
	}

	// Get all installed extensions (returns []*extension.Extension)
	extensions := h.App.ExtensionRepository.ListExtensionData()

	var (
		mu      sync.Mutex
		allSubs []AddonSubtitleEntry
		wg      sync.WaitGroup
	)

	client := &http.Client{Timeout: 10 * time.Second}

	for _, ext := range extensions {
		manifestURI := ext.ManifestURI
		if manifestURI == "" || manifestURI == "builtin" {
			continue
		}

		// Derive the addon base URL from manifest URI
		// e.g. "https://addon.example.com/manifest.json" → "https://addon.example.com"
		baseURL := strings.TrimSuffix(manifestURI, "/manifest.json")
		if baseURL == manifestURI {
			continue
		}

		subtitleURL := fmt.Sprintf("%s/subtitles/%s/%s.json", baseURL, mediaType, mediaId)
		extName := ext.Name

		wg.Add(1)
		go func(url string, name string) {
			defer wg.Done()

			resp, err := client.Get(url)
			if err != nil {
				h.App.Logger.Debug().Str("addon", name).Err(err).Msg("addon subtitles: fetch failed")
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				return
			}

			body, err := io.ReadAll(resp.Body)
			if err != nil {
				return
			}

			var result addonSubtitleResponse
			if err := json.Unmarshal(body, &result); err != nil {
				h.App.Logger.Debug().Str("addon", name).Err(err).Msg("addon subtitles: invalid JSON")
				return
			}

			if len(result.Subtitles) == 0 {
				return
			}

			mu.Lock()
			allSubs = append(allSubs, result.Subtitles...)
			mu.Unlock()
		}(subtitleURL, extName)
	}

	wg.Wait()

	if allSubs == nil {
		allSubs = []AddonSubtitleEntry{}
	}

	return h.RespondWithData(c, allSubs)
}
