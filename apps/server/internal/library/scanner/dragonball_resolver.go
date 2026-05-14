package scanner

import (
	"regexp"
	"strconv"
	"strings"
)

var (
	epRegex = regexp.MustCompile(`(?i)s\d+e\d+|e\d+|cap\d+|episodio\s*\d+`)
)

// ResolveDragonBallID evaluates a parsed title/directory name and returns the exact
// TMDB ID and whether it's a movie or a series.
func ResolveDragonBallID(title string) (int, bool, bool) {
	t := strings.ToLower(title)

	// Helper to normalize strings
	normalize := func(s string) string {
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

	ct := normalize(t)

	hasWord := func(word string) bool {
		return strings.Contains(ct, " "+word+" ")
	}

	resId := 0
	isMovie := false
	found := false

	// ── 1. EPISODE DETECTION ──
	isEpisode := epRegex.MatchString(t)

	// ── 2. MOVIE DETECTION (High Priority) ──
	// IDs here are native TMDB movie IDs. The provider adds 1,000,000 offset internally.
	if !isEpisode || hasWord("movie") || hasWord("pelicula") {
		isMovie = true
		// Battle of Gods (TMDB: 126963)
		if hasWord("dioses") || hasWord("gods") {
			resId = 126963
			found = true
		}
		// Resurrection F (TMDB: 303857)
		if !found && (hasWord("resurreccion") || hasWord("resurrection")) {
			resId = 303857
			found = true
		}
		// Super Broly (TMDB: 503314)
		if !found && hasWord("broly") && hasWord("super") && !hasWord("hero") && !hasWord("legendario") && !hasWord("legendary") {
			resId = 503314
			found = true
		}
		// Super Hero (TMDB: 610150)
		if !found && hasWord("super") && hasWord("hero") {
			resId = 610150
			found = true
		}
		// Broly - Second Coming (TMDB: 44251)
		// Bio-Broly (TMDB: 39106)
		// Broly - The Legendary Super Saiyan (TMDB: 34433)
		if !found && hasWord("broly") {
			if hasWord("regreso") || hasWord("second") {
				resId = 44251 // Broly - Second Coming
				found = true
			} else if hasWord("bio") || hasWord("combate") {
				resId = 39106 // Bio-Broly
				found = true
			} else if hasWord("legendario") || hasWord("legendary") {
				resId = 34433 // Broly - The Legendary Super Saiyan
				found = true
			} else {
				resId = 34433 // Generic Broly fallback
				found = true
			}
		}
		// Fusion Reborn (TMDB: 39107)
		if !found && (hasWord("fusion") || hasWord("janemba")) {
			resId = 39107
			found = true
		}
		// Wrath of the Dragon / El Ataque del Dragón (TMDB: 39108)
		if !found && (hasWord("tapion") || hasWord("ataque")) {
			resId = 39108
			found = true
		}
		// Cooler's Revenge (TMDB: 24752) / Return of Cooler (TMDB: 39103)
		if !found && hasWord("cooler") {
			if hasWord("regreso") || hasWord("return") || hasWord("choque") {
				resId = 39103 // Return of Cooler
				found = true
			} else {
				resId = 24752 // Cooler's Revenge
				found = true
			}
		}
		// Bojack Unbound (TMDB: 39105)
		if !found && (hasWord("bojack") || hasWord("galactico") || hasWord("unbound")) {
			resId = 39105
			found = true
		}
		// Super Android 13 (TMDB: 39104)
		if !found && hasWord("13") && (hasWord("android") || hasWord("androide")) {
			resId = 39104
			found = true
		}
		// History of Trunks (TMDB: 39324)
		if !found && hasWord("trunks") && (hasWord("futuro") || hasWord("future")) {
			resId = 39324
			found = true
		}
		// Bardock - Father of Goku / Episodio de Bardock / La Batalla de Freezer Contra el Padre de Goku (TMDB: 39323)
		if !found && (hasWord("bardock") || (hasWord("padre") && hasWord("goku") && hasWord("freezer"))) {
			resId = 39323
			found = true
		}
		// Tree of Might / Árbol del Poder (TMDB: 39101)
		if !found && (hasWord("arbol") || hasWord("turles")) {
			resId = 39101
			found = true
		}
		// The World's Strongest (TMDB: 39100)
		if !found && hasWord("fuerte") && (hasWord("hombre") || hasWord("mundo")) {
			resId = 39100
			found = true
		}
		// Lord Slug (TMDB: 39102)
		if !found && hasWord("slug") {
			resId = 39102
			found = true
		}
		// Dead Zone (TMDB: 28609)
		if !found && (hasWord("dead") || hasWord("zone") || hasWord("devuelveme")) {
			resId = 28609
			found = true
		}
		// 100 años después - GT Special (TMDB: 18095)
		if !found && (hasWord("100") && (hasWord("anos") || hasWord("despues"))) {
			resId = 18095
			found = true
		}
		// Yo! Son Goku and His Friends Return!! (TMDB: 101037)
		if !found && ((hasWord("hola") && hasWord("goku")) || hasWord("regresan") || hasWord("return")) {
			resId = 101037
			found = true
		}
		// Goku's Traffic Safety / Seguridad Vial (TMDB: 39322)
		if !found && (hasWord("vial") || hasWord("seguridad") || hasWord("safety")) {
			resId = 39322
			found = true
		}
		// Clásicas Dragon Ball (original series)
		// La Leyenda de Shenlong (TMDB: 39144)
		if !found && hasWord("leyenda") && (hasWord("shenlong") || hasWord("shenron")) {
			resId = 39144
			found = true
			// La Princesa Durmiente (TMDB: 39145)
		} else if !found && hasWord("princesa") && hasWord("durmiente") {
			resId = 39145
			found = true
			// Una Aventura Mística (TMDB: 116776)
		} else if !found && (hasWord("aventura") && hasWord("mistica")) {
			resId = 116776
			found = true
		} else if !found && (hasWord("camino") && (hasWord("fuerte") || hasWord("power"))) {
			resId = 39148
			found = true
		}

		// ── MOVIE NUMBER DETECTION (Fallback) ──
		if !found {
			// Extract number from title if it looks like a movie number
			// e.g. "Dragon Ball Z - 10" or "Movie 10"
			numRegex := regexp.MustCompile(`\b(movie|pelicula|film)?\s*(\d{1,2})\b`)
			if m := numRegex.FindStringSubmatch(t); m != nil {
				num, _ := strconv.Atoi(m[2])
				isZ := hasWord("z") || hasWord("dbz")
				isDB := (hasWord("db") || hasWord("dragon ball")) && !isZ && !hasWord("super") && !hasWord("gt")

				if isZ {
					switch num {
					case 1:
						resId = 28609 // Dead Zone
						found = true
					case 2:
						resId = 39100 // World's Strongest
						found = true
					case 3:
						resId = 39101 // Tree of Might
						found = true
					case 4:
						resId = 39102 // Lord Slug
						found = true
					case 5:
						resId = 24752 // Cooler's Revenge
						found = true
					case 6:
						resId = 39103 // Return of Cooler
						found = true
					case 7:
						resId = 39104 // Super Android 13
						found = true
					case 8:
						resId = 34433 // Broly Legendary
						found = true
					case 9:
						resId = 39105 // Bojack Unbound
						found = true
					case 10:
						resId = 44251 // Broly Second Coming
						found = true
					case 11:
						resId = 39106 // Bio-Broly
						found = true
					case 12:
						resId = 39107 // Fusion Reborn
						found = true
					case 13:
						resId = 39108 // Wrath of the Dragon
						found = true
					}
				} else if isDB {
					switch num {
					case 1:
						resId = 39144 // Leyenda Shenlong
						found = true
					case 2:
						resId = 39145 // Princesa Durmiente
						found = true
					case 3:
						resId = 116776 // Aventura Mistica
						found = true
					case 4:
						resId = 39148 // Camino mas fuerte
						found = true
					}
				}
			}
		}
	}

	// ── 3. SERIES DETECTION (Priority: Daima/GT) ──
	if !found {
		isMovie = false
		if strings.Contains(ct, " daima ") {
			resId = 236994
			found = true
		} else if strings.Contains(ct, " gt ") {
			resId = 12697 // Dragon Ball GT (Verified)
			found = true
		} else if hasWord("kai") {
			resId = 61709
			found = true
		} else if strings.Contains(ct, " dragon ball super ") || hasWord("dbs") {
			resId = 62715
			found = true
		} else if hasWord("dbz") || strings.Contains(ct, " dragon ball z ") || (hasWord("z") && !hasWord("super")) {
			resId = 12971
			found = true
		} else if hasWord("heroes") {
			resId = 80629
			found = true
		} else if hasWord("db") || strings.Contains(ct, " dragon ball ") {
			resId = 12609
			found = true
		}
	}

	return resId, isMovie, found
}
