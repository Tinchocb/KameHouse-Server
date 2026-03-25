package scanner

import (
	"strings"
)

// ResolveDragonBallID evaluates a parsed title/directory name and returns the exact 
// TMDB ID for the Dragon Ball franchise if it matches known patterns.
// Movies have a 1,000,000 offset added so TMDBProvider correctly routes them to the /movie API.
func ResolveDragonBallID(title string) (int, bool) {
	t := strings.ToLower(title)
	t = strings.ReplaceAll(t, "-", " ")
	t = strings.ReplaceAll(t, "_", " ")
	t = strings.ReplaceAll(t, ".", " ")
	t = strings.ReplaceAll(t, "[", " ")
	t = strings.ReplaceAll(t, "]", " ")

	// Helper to check for whole words in a string
	hasWord := func(word string) bool {
		return strings.Contains(" "+t+" ", " "+word+" ")
	}

	// 1. Dragon Ball Daima (240411)
	if hasWord("daima") || strings.Contains(t, "dragon ball daima") {
		return 240411, true
	}

	// 2. Dragon Ball Super (62715)
	if hasWord("super") || hasWord("dbs") || strings.Contains(t, "dragon ball super") {
		if !hasWord("hero") && !hasWord("broly") { // Exclude movies
			return 62715, true
		}
	}

	// 3. Dragon Ball Kai (61709)
	if hasWord("kai") || strings.Contains(t, "dragon ball kai") || hasWord("dbk") {
		return 61709, true
	}

	// 4. Dragon Ball GT (888)
	if hasWord("gt") || strings.Contains(t, "dragon ball gt") || hasWord("dbgt") {
		return 888, true
	}

	// 5. Dragon Ball Heroes (80629)
	if hasWord("heroes") || hasWord("dbh") || hasWord("sdbh") {
		return 80629, true
	}

	// 6. Dragon Ball Z (12971)
	if hasWord("z") || hasWord("dbz") || strings.Contains(t, "dragon ball z") || strings.Contains(t, "dragonball z") {
		if !hasWord("movie") && !hasWord("pelicula") {
			return 12971, true
		}
	}

	// 7. Original Dragon Ball (862)
	// Make sure it doesn't accidentally hit if it's Z, GT, etc (which were caught above)
	if hasWord("db") || strings.Contains(t, "dragon ball") || strings.Contains(t, "dragonball") {
		if !hasWord("movie") && !hasWord("pelicula") {
			return 862, true
		}
	}

	// ── Movies ──

	// Dragon Ball Super: Broly (503314) -> 1503314
	if hasWord("broly") && hasWord("super") {
		return 1503314, true
	}

	// Dragon Ball Super: Super Hero (610150) -> 1610150
	if hasWord("super") && hasWord("hero") {
		return 1610150, true
	}

	// Battle of Gods (126963)
	if hasWord("dioses") || hasWord("gods") || hasWord("kami") {
		return 1126963, true
	}

	// Resurrection F (315011)
	if hasWord("resurreccion") || hasWord("resurrection") {
		return 1315011, true
	}

	// Broly - Legendary Super Saiyan (39116)
	if hasWord("broly") {
		if hasWord("second") || hasWord("regreso") {
			return 1039118, true // Broly Second Coming
		}
		if hasWord("bio") || hasWord("clonacion") {
			return 1039119, true // Bio-Broly
		}
		return 1039116, true // Broly 1
	}

	// Fusion Reborn (39120)
	if hasWord("fusion") || hasWord("janemba") {
		return 1039120, true
	}

	// Wrath of the Dragon / Tapion (39121)
	if hasWord("tapion") || hasWord("puño") || hasWord("wrath") || hasWord("ataque del dragon") {
		return 1039121, true
	}

	// Cooler's Revenge (39113)
	if hasWord("cooler") {
		if hasWord("return") || hasWord("regreso") || hasWord("choque") {
			return 1039114, true // Return of Cooler
		}
		return 1039113, true // Cooler's Revenge
	}

	// Bojack (39117)
	if hasWord("bojack") || hasWord("galaxia") || hasWord("peligro") {
		return 1039117, true
	}

	// Tree of Might (39111)
	if hasWord("tree") || hasWord("arbol") || hasWord("turles") || hasWord("batalla decisiva") {
		return 1039111, true
	}

	// World's Strongest (39110)
	if hasWord("mundo") || hasWord("strongest") {
		return 1039110, true
	}

	// Lord Slug (39112)
	if hasWord("slug") {
		return 1039112, true
	}

	// Dead Zone (39109)
	if hasWord("dead") || hasWord("zone") || hasWord("garlic") || hasWord("devuelveme") {
		return 1039109, true
	}

	// Android 13 (39115)
	if hasWord("13") || hasWord("android") || hasWord("extrema") {
		return 1039115, true
	}

	return 0, false
}
