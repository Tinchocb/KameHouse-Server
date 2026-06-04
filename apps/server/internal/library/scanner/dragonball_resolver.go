package scanner

import (
	"regexp"
	"strconv"
	"strings"
)

var (
	// epRegex strips episode/chapter markers before numeric movie detection.
	epRegex = regexp.MustCompile(`(?i)s\d+e\d+|e\d+|cap\d+|episodio\s*\d+`)

	// resRegex strips video resolution tokens that would produce false numeric matches
	// (e.g. "1080p", "720p", "4k").
	resRegex = regexp.MustCompile(`(?i)\b\d{3,4}[pi]\b|\b4k\b`)

	// movieNumRegex matches an explicit movie/film/pelicula prefix followed by 1–2 digits.
	// The prefix is now MANDATORY to prevent false positives from chapter numbers,
	// resolutions, and year-like tokens.
	movieNumRegex = regexp.MustCompile(`(?i)\b(?:movie|pelicula|film)\s*(\d{1,2})\b`)
)

// dragonBallMovies contains all Dragon Ball movie mappings in priority order.
// Each entry is evaluated by ResolveFranchiseID: Keywords (AND), AnyOf (OR), Excluded (NOT).
// The first matching MovieMapping wins.
var dragonBallMovies = FranchiseDef{
	TriggerWords: []string{}, // No global trigger — called only when upstream identifies DB content.
	Movies: []MovieMapping{
		// ── Dragon Ball Super movies ──────────────────────────────────────────
		{AnyOf: []string{"dioses", "gods"}, TMDBID: 126963},                                              // Battle of Gods
		{AnyOf: []string{"resurreccion", "resurrection"}, TMDBID: 303857},                                // Resurrection 'F'
		{Keywords: []string{"broly", "super"}, Excluded: []string{"hero", "legendario", "legendary"}, TMDBID: 503314}, // DBS: Broly
		{Keywords: []string{"super", "hero"}, TMDBID: 610150},                                            // Dragon Ball Super: Super Hero

		// ── DBZ Broly trilogy ────────────────────────────────────────────────
		{Keywords: []string{"broly"}, AnyOf: []string{"regreso", "second"}, TMDBID: 44251},               // Broly – Second Coming
		{Keywords: []string{"broly"}, AnyOf: []string{"bio", "combate"}, TMDBID: 39106},                  // Bio-Broly
		{Keywords: []string{"broly"}, AnyOf: []string{"legendario", "legendary"}, TMDBID: 34433},         // Broly – The Legendary Super Saiyan
		{Keywords: []string{"broly"}, TMDBID: 34433},                                                     // Broly (generic fallback)

		// ── DBZ movies ───────────────────────────────────────────────────────
		{AnyOf: []string{"fusion", "janemba"}, TMDBID: 39107},                                            // Fusion Reborn
		{AnyOf: []string{"tapion", "ataque"}, TMDBID: 39108},                                             // Wrath of the Dragon
		{Keywords: []string{"cooler"}, AnyOf: []string{"regreso", "return", "choque"}, TMDBID: 39103},    // Return of Cooler
		{Keywords: []string{"cooler"}, TMDBID: 24752},                                                    // Cooler's Revenge
		{AnyOf: []string{"bojack", "galactico", "unbound"}, TMDBID: 39105},                               // Bojack Unbound
		{Keywords: []string{"13"}, AnyOf: []string{"android", "androide"}, TMDBID: 39104},                // Super Android 13
		{Keywords: []string{"trunks"}, AnyOf: []string{"futuro", "future"}, TMDBID: 39324},               // History of Trunks
		{Keywords: []string{"bardock"}, AnyOf: []string{"episodio", "episode"}, TMDBID: 120475},          // Episode of Bardock (2011)
		{AnyOf: []string{"bardock"}, TMDBID: 39323},                                                      // Bardock – Father of Goku (keyword)
		{Keywords: []string{"padre", "goku", "freezer"}, TMDBID: 39323},                                  // Bardock – via description tokens
		{AnyOf: []string{"arbol", "turles"}, TMDBID: 39101},                                              // Tree of Might
		{Keywords: []string{"fuerte"}, AnyOf: []string{"hombre", "mundo"}, TMDBID: 39100},                // The World's Strongest
		{Keywords: []string{"slug"}, TMDBID: 39102},                                                      // Lord Slug
		{AnyOf: []string{"dead", "devuelveme"}, TMDBID: 28609},                                           // Dead Zone

		// ── GT Special ───────────────────────────────────────────────────────
		{Keywords: []string{"100"}, AnyOf: []string{"anos", "despues"}, TMDBID: 18095},                   // A Hero's Legacy (100 años)

		// ── Specials / Side-stories ──────────────────────────────────────────
		{Keywords: []string{"hola", "goku"}, TMDBID: 38594},                                              // Yo! Son Goku and His Friends Return!!
		{AnyOf: []string{"regresan"}, TMDBID: 38594},                                                     // Yo! (alternate title)
		{AnyOf: []string{"vial", "seguridad", "safety"}, TMDBID: 39322},                                  // Goku's Traffic Safety

		// ── Classic Dragon Ball movies ───────────────────────────────────────
		{Keywords: []string{"leyenda"}, AnyOf: []string{"shenlong", "shenron"}, TMDBID: 39144},           // La Leyenda de Shenlong
		{Keywords: []string{"princesa", "durmiente"}, TMDBID: 39145},                                     // La Princesa Durmiente
		{Keywords: []string{"aventura", "mistica"}, TMDBID: 116776},                                      // Una Aventura Mística
		{Keywords: []string{"camino"}, AnyOf: []string{"fuerte", "power"}, TMDBID: 39148},                // El Camino al Poder
	},
}

// ResolveDragonBallID evaluates a parsed title/directory name and returns the exact
// TMDB ID and whether it's a movie or a series. The returned ID is a raw TMDB ID;
// callers apply the 1,000,000 movie offset convention themselves.
//
// Returns (tmdbID, isMovie, found).
func ResolveDragonBallID(title string) (int, bool, bool) {
	t := strings.ToLower(title)
	ct := normalizeDragonBallTitle(t)

	resId := 0
	isMovie := false
	found := false

	// ── 1. EPISODE DETECTION ──────────────────────────────────────────────────
	// If the title contains episode markers it is almost certainly a series
	// episode, not a standalone movie — unless it also has an explicit "movie"
	// keyword (e.g. folder-level NFO named "Dragon Ball Z Movie 01").
	isEpisode := epRegex.MatchString(t)

	// ── 2. MOVIE DETECTION (data-driven, high priority) ──────────────────────
	if !isEpisode || franchiseHasWord(ct, "movie") || franchiseHasWord(ct, "pelicula") {
		resId, isMovie, found = ResolveFranchiseID(ct, dragonBallMovies)
	}

	// ── 3. MOVIE NUMBER FALLBACK ─────────────────────────────────────────────
	// Only reached when keyword detection failed. Strips episode/resolution
	// tokens first to prevent false matches (e.g. "Cap 05", "1080p").
	if !found && (!isEpisode || franchiseHasWord(ct, "movie") || franchiseHasWord(ct, "pelicula")) {
		isMovie = true

		// Strip episode markers and resolution strings before numeric detection.
		cleanTitle := epRegex.ReplaceAllString(t, " ")
		cleanTitle = resRegex.ReplaceAllString(cleanTitle, " ")

		// The "movie|pelicula|film" prefix is now MANDATORY — avoids false
		// positives from chapter numbers, years, and season numbers.
		if m := movieNumRegex.FindStringSubmatch(cleanTitle); m != nil {
			num, _ := strconv.Atoi(m[1])

			isZ := franchiseHasWord(ct, "z") || franchiseHasWord(ct, "dbz")
			isDB := (franchiseHasWord(ct, "db") || strings.Contains(ct, " dragon ball ")) &&
				!isZ && !franchiseHasWord(ct, "super") && !franchiseHasWord(ct, "gt")

			if isZ {
				switch num {
				case 1:
					resId, found = 28609, true // Dead Zone
				case 2:
					resId, found = 39100, true // World's Strongest
				case 3:
					resId, found = 39101, true // Tree of Might
				case 4:
					resId, found = 39102, true // Lord Slug
				case 5:
					resId, found = 24752, true // Cooler's Revenge
				case 6:
					resId, found = 39103, true // Return of Cooler
				case 7:
					resId, found = 39104, true // Super Android 13
				case 8:
					resId, found = 34433, true // Broly – Legendary
				case 9:
					resId, found = 39105, true // Bojack Unbound
				case 10:
					resId, found = 44251, true // Broly – Second Coming
				case 11:
					resId, found = 39106, true // Bio-Broly
				case 12:
					resId, found = 39107, true // Fusion Reborn
				case 13:
					resId, found = 39108, true // Wrath of the Dragon
				}
			} else if isDB {
				switch num {
				case 1:
					resId, found = 39144, true // La Leyenda de Shenlong
				case 2:
					resId, found = 39145, true // La Princesa Durmiente
				case 3:
					resId, found = 116776, true // Una Aventura Mística
				case 4:
					resId, found = 39148, true // El Camino al Poder
				}
			}
		}
	}

	// ── 4. SERIES DETECTION (priority: Daima → GT → Kai → Super → Z → Heroes → DB) ──
	if !found {
		isMovie = false
		switch {
		case strings.Contains(ct, " daima "):
			resId, found = 236994, true
		case strings.Contains(ct, " gt "):
			resId, found = 12697, true
		case strings.Contains(ct, " dragon ball super ") || franchiseHasWord(ct, "dbs"):
			resId, found = 62715, true
		case franchiseHasWord(ct, "dbz"),
			strings.Contains(ct, " dragon ball z "),
			franchiseHasWord(ct, "z") && !franchiseHasWord(ct, "super"):
			resId, found = 12971, true
		case franchiseHasWord(ct, "heroes"):
			resId, found = 80629, true
		case franchiseHasWord(ct, "db"), strings.Contains(ct, " dragon ball "):
			resId, found = 12609, true
		}
	}

	return resId, isMovie, found
}

// normalizeDragonBallTitle converts a raw title to a lowercase, space-padded,
// accent-stripped, punctuation-removed string suitable for word-boundary matching.
func normalizeDragonBallTitle(s string) string {
	s = strings.ReplaceAll(s, "-", " ")
	s = strings.ReplaceAll(s, "_", " ")
	s = strings.ReplaceAll(s, ".", " ")
	s = strings.ReplaceAll(s, "[", " ")
	s = strings.ReplaceAll(s, "]", " ")
	s = strings.ReplaceAll(s, "(", " ")
	s = strings.ReplaceAll(s, ")", " ")
	s = strings.ReplaceAll(s, "á", "a")
	s = strings.ReplaceAll(s, "é", "e")
	s = strings.ReplaceAll(s, "í", "i")
	s = strings.ReplaceAll(s, "ó", "o")
	s = strings.ReplaceAll(s, "ú", "u")
	s = strings.ReplaceAll(s, "ñ", "n")
	// Remove all non-alphanumeric except spaces
	reg := regexp.MustCompile(`[^a-z0-9\s]+`)
	s = reg.ReplaceAllString(s, " ")
	return " " + strings.Join(strings.Fields(s), " ") + " "
}
