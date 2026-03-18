package torrentio

import (
	"testing"
)

// ─────────────────────────────────────────────────────────────────────────────
// parseQuality
// ─────────────────────────────────────────────────────────────────────────────

func TestParseQuality(t *testing.T) {
	cases := []struct {
		name     string
		title    string
		expected string
	}{
		{name: "Torrentio\nSubsPlease", title: "[SubsPlease] Bleach S01E01 (4K HDR).mkv\n👤 342", expected: "4K HDR"},
		{name: "Torrentio\nSubsPlease", title: "[SubsPlease] Bleach S01E01 (2160p).mkv",  expected: "4K"},
		{name: "Torrentio\nErai-raws",  title: "[Erai-raws] Bleach S01E01 [1080p].mkv",    expected: "1080p"},
		{name: "Torrentio\nHi10",       title: "[Hi10] Bleach 01 [720p].mkv",              expected: "720p"},
		{name: "Torrentio\nOld",        title: "[Old] Bleach 01 [480p].mkv",               expected: "480p"},
		{name: "Torrentio\nUnknown",    title: "some.file.without.quality.mkv",            expected: "unknown"},
	}

	for _, tc := range cases {
		t.Run(tc.expected, func(t *testing.T) {
			got := parseQuality(tc.name, tc.title)
			if got != tc.expected {
				t.Errorf("parseQuality(%q, %q) = %q, want %q", tc.name, tc.title, got, tc.expected)
			}
		})
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// parseReleaseGroup
// ─────────────────────────────────────────────────────────────────────────────

func TestParseReleaseGroup(t *testing.T) {
	cases := []struct {
		name     string
		expected string
	}{
		{"Torrentio\nSubsPlease",   "SubsPlease"},
		{"Torrentio\nErai-raws",    "Erai-raws"},
		{"SubsPlease",              "SubsPlease"},
		{"Torrentio",               ""},
		{"",                        ""},
	}

	for _, tc := range cases {
		t.Run(tc.expected+"_"+tc.name, func(t *testing.T) {
			got := parseReleaseGroup(tc.name)
			if got != tc.expected {
				t.Errorf("parseReleaseGroup(%q) = %q, want %q", tc.name, got, tc.expected)
			}
		})
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// parseFilename
// ─────────────────────────────────────────────────────────────────────────────

func TestParseFilename(t *testing.T) {
	title := "[SubsPlease] Bleach - 02 (1080p) [ABCD1234].mkv\n👤 123 💾 1.4 GB ⚙️ x264"
	want  := "[SubsPlease] Bleach - 02 (1080p) [ABCD1234].mkv"
	got   := parseFilename(title)
	if got != want {
		t.Errorf("parseFilename got %q, want %q", got, want)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// parseSeeders
// ─────────────────────────────────────────────────────────────────────────────

func TestParseSeeders(t *testing.T) {
	cases := []struct {
		title    string
		expected int
	}{
		{"[SubsPlease] file.mkv\n👤 342 💾 1.4 GB", 342},
		{"file.mkv\n👤 5 ⚙️ x264",                  5},
		{"file.mkv — no seeder info",               -1},
		{"",                                         -1},
	}

	for _, tc := range cases {
		t.Run(tc.title, func(t *testing.T) {
			got := parseSeeders(tc.title)
			if got != tc.expected {
				t.Errorf("parseSeeders(%q) = %d, want %d", tc.title, got, tc.expected)
			}
		})
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// mapStreams
// ─────────────────────────────────────────────────────────────────────────────

func TestMapStreams_BasicMapping(t *testing.T) {
	raw := []stremioStream{
		{
			Name:     "Torrentio\nSubsPlease",
			Title:    "[SubsPlease] Bleach - 01 (1080p) [ABCD].mkv\n👤 200 💾 1.4 GB",
			InfoHash: "abc123",
			FileIdx:  0,
		},
		{
			Name:  "Torrentio\nDebridProvider",
			Title: "Bleach.S01E01.1080p.WEB.mkv",
			URL:   "https://realdebrid.com/dl/abcxyz",
		},
	}

	results := mapStreams(raw)

	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}

	p2p := results[0]
	if p2p.InfoHash != "abc123"                  { t.Errorf("InfoHash mismatch: %s", p2p.InfoHash) }
	if p2p.Quality != "1080p"                    { t.Errorf("Quality mismatch: %s", p2p.Quality) }
	if p2p.ReleaseGroup != "SubsPlease"          { t.Errorf("ReleaseGroup mismatch: %s", p2p.ReleaseGroup) }
	if p2p.Seeders != 200                        { t.Errorf("Seeders mismatch: %d", p2p.Seeders) }
	if p2p.IsDebrid                              { t.Error("expected P2P source, got debrid") }
	if p2p.MagnetURI == ""                       { t.Error("expected MagnetURI to be set") }

	debrid := results[1]
	if !debrid.IsDebrid      { t.Error("expected debrid source") }
	if debrid.URL == ""      { t.Error("expected debrid URL to be set") }
}
