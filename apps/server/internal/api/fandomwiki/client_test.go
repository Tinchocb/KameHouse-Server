package fandomwiki

import (
	"encoding/json"
	"testing"
)

// TestSearchParsing verifies that the mwSearchResponse struct correctly
// deserializes the MediaWiki search JSON format.
func TestSearchParsing(t *testing.T) {
	raw := `{
		"query": {
			"search": [
				{"pageid": 1, "title": "Goku", "snippet": "Un <b>guerrero</b> Z"},
				{"pageid": 2, "title": "Vegeta", "snippet": "Príncipe de los <b>Saiyajins</b>"}
			]
		}
	}`

	var resp mwSearchResponse
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if got := len(resp.Query.Search); got != 2 {
		t.Fatalf("expected 2 results, got %d", got)
	}
	if resp.Query.Search[0].Title != "Goku" {
		t.Errorf("expected first result title 'Goku', got %q", resp.Query.Search[0].Title)
	}
	if resp.Query.Search[1].PageID != 2 {
		t.Errorf("expected second result pageId 2, got %d", resp.Query.Search[1].PageID)
	}
}

// TestGetDetailsParsing verifies the most complex part of the client:
// correctly extracting a page from the dynamic map[string]mwPage structure.
func TestGetDetailsParsing(t *testing.T) {
	// MediaWiki uses the page ID as a dynamic JSON key — this is the exact
	// shape returned by the API for a found page.
	raw := `{
		"query": {
			"pages": {
				"7704": {
					"pageid": 7704,
					"title": "Goku",
					"extract": "Goku es el protagonista principal de la serie.",
					"original": {
						"source": "https://static.wikia.nocookie.net/dragonball/images/goku.png"
					}
				}
			}
		}
	}`

	var resp mwDetailsResponse
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if len(resp.Query.Pages) != 1 {
		t.Fatalf("expected 1 page, got %d", len(resp.Query.Pages))
	}

	page := resp.Query.Pages["7704"]

	if page.Title != "Goku" {
		t.Errorf("expected title 'Goku', got %q", page.Title)
	}
	if page.Extract == "" {
		t.Error("expected non-empty extract")
	}
	if page.Original == nil {
		t.Fatal("expected Original image to be non-nil")
	}
	if page.Original.Source == "" {
		t.Error("expected non-empty image source URL")
	}
}

// TestGetDetailsPageNotFound verifies that a page-ID of -1 is handled
// correctly — MediaWiki returns -1 when the requested title does not exist.
func TestGetDetailsPageNotFound(t *testing.T) {
	raw := `{
		"query": {
			"pages": {
				"-1": {
					"pageid": -1,
					"title": "Personaje Inexistente",
					"missing": ""
				}
			}
		}
	}`

	var resp mwDetailsResponse
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	page := resp.Query.Pages["-1"]
	if page.PageID != -1 {
		t.Errorf("expected pageid -1 for missing page, got %d", page.PageID)
	}
}

// TestGetDetailsNoImage verifies that GetDetails handles pages without
// an associated image gracefully (Original pointer should be nil).
func TestGetDetailsNoImage(t *testing.T) {
	raw := `{
		"query": {
			"pages": {
				"42": {
					"pageid": 42,
					"title": "Krillin",
					"extract": "Krillin es el mejor amigo humano de Goku."
				}
			}
		}
	}`

	var resp mwDetailsResponse
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	page := resp.Query.Pages["42"]
	if page.Original != nil {
		t.Errorf("expected Original to be nil when no image is present, got %+v", page.Original)
	}
}
