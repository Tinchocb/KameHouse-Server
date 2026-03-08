// Package fandomwiki provides a client for querying the Dragon Ball Fandom Wiki
// (Hispano) via the MediaWiki Action API. It is the primary source of truth for
// character lore and metadata in the KameHouse media server.
//
// API reference: https://www.mediawiki.org/wiki/API:Main_page
package fandomwiki

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// baseURL is the entry point for all MediaWiki API calls against the Spanish
// Dragon Ball Fandom wiki.
const baseURL = "https://dragonball.fandom.com/es/api.php"

// userAgent is injected on every outbound request to identify the KameHouse
// server to the Fandom CDN and prevent it from being blocked as a bot.
const userAgent = "KameHouse-Server/1.0"

// defaultRequestDelay is the minimum pause between consecutive API calls.
// MediaWiki recommends at least 1 request per second for non-bot accounts.
// We use 1.1 s to give a comfortable margin against IP throttling.
const defaultRequestDelay = 1100 * time.Millisecond

// ---------------------------------------------------------------------------
// Domain structs
// ---------------------------------------------------------------------------

// SearchResult is a single item returned by the wiki's full-text search.
type SearchResult struct {
	// PageID is the unique integer identifier of the wiki page.
	PageID int `json:"pageid"`
	// Title is the canonical article title (e.g. "Goku").
	Title string `json:"title"`
	// Snippet is a short HTML-formatted excerpt with the matching terms highlighted.
	Snippet string `json:"snippet"`
}

// FandomEntry is the flat domain struct produced by GetDetails. It contains
// only the fields that the KameHouse application cares about, decoupling
// consumers from the deeply-nested MediaWiki JSON schema.
type FandomEntry struct {
	// Title is the canonical article title.
	Title string
	// Summary is the plain-text introduction section of the article.
	// HTML has been stripped server-side via explaintext=1.
	Summary string
	// ImageURL is the URL of the uncropped profile image.
	// Sourced via piprop=original so we always receive the full resolution.
	ImageURL string
}

// ---------------------------------------------------------------------------
// Internal unmarshaling structs for the MediaWiki JSON schema
//
// MediaWiki wraps results in `query.pages`, which is a JSON object whose keys
// are dynamic page IDs (e.g. {"12345": {...}}). We handle this by unmarshaling
// the pages value into a map[string]mwPage first, then extracting the first
// (and only expected) element.
// ---------------------------------------------------------------------------

// mwSearchResponse is the top-level envelope for action=query&list=search.
type mwSearchResponse struct {
	Query struct {
		Search []SearchResult `json:"search"`
	} `json:"query"`
}

// mwPage holds the per-page data returned by action=query&prop=extracts|pageimages.
type mwPage struct {
	PageID  int    `json:"pageid"`
	Title   string `json:"title"`
	Extract string `json:"extract"` // plain text intro (when explaintext=1)
	// Thumbnail is populated when piprop=thumbnail is requested (not used here).
	Original *mwImage `json:"original"` // full-resolution image (piprop=original)
}

// mwImage wraps the image metadata returned under the "original" key.
type mwImage struct {
	Source string `json:"source"`
}

// mwDetailsResponse is the top-level envelope for action=query&prop=extracts|pageimages.
type mwDetailsResponse struct {
	Query struct {
		// Pages is a dynamic map keyed by page ID as a string.
		Pages map[string]mwPage `json:"pages"`
	} `json:"query"`
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

// Client is the HTTP client for the Dragon Ball Fandom Wiki API.
//
// Usage:
//
//	c := fandomwiki.NewClient()
//	results, err := c.Search("Goku")
//	entry, err  := c.GetDetails("Goku")
type Client struct {
	// http is the underlying transport; timeout is set at construction time.
	http *http.Client
	// rateLimiter is a channel used as a simple counting semaphore / token
	// bucket to enforce inter-request delays during batch operations.
	rateLimiter <-chan time.Time
}

// NewClient constructs a Client with:
//   - A 10-second HTTP timeout (covers the full round-trip, including reading body).
//   - A rate-limiter that allows at most 1 request per defaultRequestDelay.
func NewClient() *Client {
	return &Client{
		http: &http.Client{
			Timeout: 10 * time.Second,
		},
		// time.Tick returns a channel that emits a value every defaultRequestDelay.
		// Callers block on this channel before each request, ensuring that no two
		// requests are issued faster than once per defaultRequestDelay interval.
		rateLimiter: time.Tick(defaultRequestDelay), //nolint:staticcheck // intentionally infinite ticker
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Search queries the Fandom Wiki for pages matching query and returns a list
// of SearchResult entries. It uses the MediaWiki full-text search endpoint.
//
// Endpoint: ?action=query&list=search&srsearch={query}&utf8=&format=json
func (c *Client) Search(query string) ([]SearchResult, error) {
	if query == "" {
		return nil, fmt.Errorf("fandomwiki: Search called with an empty query")
	}

	params := url.Values{}
	params.Set("action", "query")
	params.Set("list", "search")
	params.Set("srsearch", query)
	params.Set("utf8", "")
	params.Set("format", "json")

	body, err := c.get(params)
	if err != nil {
		return nil, fmt.Errorf("fandomwiki: Search(%q): request failed: %w", query, err)
	}

	var result mwSearchResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("fandomwiki: Search(%q): JSON parse error: %w", query, err)
	}

	return result.Query.Search, nil
}

// GetDetails fetches the introductory summary and profile image for a wiki page
// identified by its canonical title. The title should match the article's exact
// name (e.g. "Goku", "Vegeta"). Spaces are encoded automatically.
//
// Endpoint: ?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=original&titles={title}&format=json
//
// The explaintext=1 parameter is critical — without it MediaWiki returns raw
// wikitext/HTML, which the client would have to strip manually.
// The piprop=original parameter ensures we retrieve the full, uncropped image
// rather than a resized thumbnail.
func (c *Client) GetDetails(title string) (*FandomEntry, error) {
	if title == "" {
		return nil, fmt.Errorf("fandomwiki: GetDetails called with an empty title")
	}

	params := url.Values{}
	params.Set("action", "query")
	params.Set("prop", "extracts|pageimages")
	params.Set("exintro", "1")
	params.Set("explaintext", "1")
	params.Set("piprop", "original")
	params.Set("titles", title)
	params.Set("format", "json")

	body, err := c.get(params)
	if err != nil {
		return nil, fmt.Errorf("fandomwiki: GetDetails(%q): request failed: %w", title, err)
	}

	var raw mwDetailsResponse
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("fandomwiki: GetDetails(%q): JSON parse error: %w", title, err)
	}

	// MediaWiki returns a map of pages keyed by page ID. We always request a
	// single title, so we simply take the first (and only) entry in the map.
	// A special page ID of -1 indicates that the page was not found.
	if len(raw.Query.Pages) == 0 {
		return nil, fmt.Errorf("fandomwiki: GetDetails(%q): no pages returned", title)
	}

	var page mwPage
	for _, p := range raw.Query.Pages {
		page = p
		break
	}

	if page.PageID == -1 {
		return nil, fmt.Errorf("fandomwiki: GetDetails(%q): page not found", title)
	}

	entry := &FandomEntry{
		Title:   page.Title,
		Summary: page.Extract,
	}

	// Populate ImageURL only when MediaWiki actually returned an original image.
	if page.Original != nil {
		entry.ImageURL = page.Original.Source
	}

	return entry, nil
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// get performs a rate-limited HTTP GET against the Fandom MediaWiki API with
// the supplied query parameters appended to the base URL.
//
// It blocks on the internal rate-limiter channel before each request to ensure
// that concurrent or sequential batch calls do not exceed the allowed request
// rate and trigger Fandom's IP throttling.
//
// The User-Agent header is injected on every request as required by the
// MediaWiki API policy:
// https://www.mediawiki.org/wiki/API:Etiquette#The_User-Agent_header
func (c *Client) get(params url.Values) ([]byte, error) {
	// Block until the rate limiter releases a token.
	// During a single ad-hoc call this returns almost immediately.
	// During batch scraping it enforces the configured inter-request delay.
	<-c.rateLimiter

	endpoint := baseURL + "?" + params.Encode()

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("could not build request for %s: %w", endpoint, err)
	}

	// Identify KameHouse to the Fandom CDN / MediaWiki servers.
	req.Header.Set("User-Agent", userAgent)
	// Explicitly request JSON; MediaWiki also respects the format= query param,
	// but setting Accept is considered good practice.
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	// Treat any non-2xx response as an unrecoverable error. The caller is
	// responsible for deciding whether to retry.
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return nil, fmt.Errorf("unexpected HTTP status %d for URL %s", resp.StatusCode, endpoint)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	return body, nil
}
