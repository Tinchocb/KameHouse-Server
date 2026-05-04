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
	t = strings.ReplaceAll(t, "(", " ")
	t = strings.ReplaceAll(t, ")", " ")
	t = strings.ReplaceAll(t, "¡", " ")
	t = strings.ReplaceAll(t, "!", " ")
	t = strings.ReplaceAll(t, "¿", " ")
	t = strings.ReplaceAll(t, "?", " ")
	t = strings.ReplaceAll(t, ",", " ")
	t = strings.ReplaceAll(t, ":", " ")

	// Helper to check for whole words in a string
	hasWord := func(word string) bool {
		return strings.Contains(" "+t+" ", " "+word+" ")
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

	// Broly - Legendary Super Saiyan / El poder invencible (39116)
	if hasWord("broly") || hasWord("invencible") {
		if hasWord("second") || hasWord("regreso") || hasWord("legendario") {
			return 1039118, true // Broly Second Coming / El regreso del guerrero legendario
		}
		if hasWord("bio") || hasWord("clonacion") || hasWord("combate") {
			return 1039119, true // Bio-Broly / El combate final
		}
		return 1039116, true // Broly 1
	}

	// Fusion Reborn / La fusión de Goku y Vegeta (39120)
	if hasWord("fusion") || hasWord("janemba") || hasWord("fusión") {
		return 1039120, true
	}

	// Wrath of the Dragon / Tapion (39121)
	if hasWord("tapion") || hasWord("puño") || hasWord("wrath") || hasWord("ataque del dragon") {
		return 1039121, true
	}

	// Cooler's Revenge / Los rivales más poderosos (39113)
	if hasWord("cooler") || hasWord("rivales") {
		return 1039113, true
	}

	// Return of Cooler / Los guerreros más poderosos (39114)
	if (hasWord("cooler") && (hasWord("return") || hasWord("regreso") || hasWord("choque"))) || hasWord("guerreros") && hasWord("poderosos") {
		return 1039114, true
	}

	// Bojack / La galaxia corre peligro (39117)
	if hasWord("bojack") || hasWord("galaxia") || hasWord("peligro") {
		return 1039117, true
	}

	// Tree of Might / La superbatalla (39111)
	if hasWord("tree") || hasWord("arbol") || hasWord("turles") || hasWord("batalla decisiva") || hasWord("superbatalla") {
		return 1039111, true
	}

	// World's Strongest / El hombre más fuerte de este mundo (39110)
	if hasWord("mundo") || hasWord("strongest") || hasWord("fuerte") {
		return 1039110, true
	}

	// Lord Slug / El Goku Super Saiyajin (39112)
	if hasWord("slug") || (hasWord("goku") && hasWord("saiyajin")) {
		return 1039112, true
	}

	// Dead Zone / ¡Devuélveme a mi Gohan! / Devuélvanme a mi Gohan (39109)
	if hasWord("devuelveme") || hasWord("devuelvanme") || (hasWord("dead") && hasWord("zone")) || hasWord("garlic") {
		return 1039109, true
	}

	// Android 13 / La pelea de los tres Saiyajins (39115)
	if hasWord("13") || hasWord("android") || hasWord("extrema") || hasWord("tres") {
		return 1039115, true
	}

	// History of Trunks / Los dos guerreros del futuro (39148)
	if hasWord("trunks") || hasWord("futuro") {
		return 1039148, true
	}

	// Bardock - The Father of Goku / La batalla de Freezer contra el padre de Goku (39147)
	if hasWord("padre") || hasWord("freezer") {
		return 1039147, true
	}

	// Episode of Bardock (95539)
	if hasWord("episodio") || hasWord("episode") || hasWord("bardock") {
		return 1095539, true
	}

	// Sleeping Princess in Devil's Castle / La princesa durmiente en el castillo embrujado (33500)
	if hasWord("princesa") || hasWord("durmiente") || hasWord("castillo") {
		return 1033500, true
	}

	// Mystical Adventure / Una aventura mística (33513)
	if hasWord("aventura") || hasWord("mistica") || hasWord("mística") {
		return 1033513, true
	}

	// Yo! Son Goku and His Friends Return!! / ¡Hey! Goku y sus amigos regresan (63636)
	if hasWord("amigos") || hasWord("hey") || hasWord("regresan") {
		return 1063636, true
	}

	// A Hero's Legacy / 100 años después (39149)
	if hasWord("100") || hasWord("años") || hasWord("después") || hasWord("legacy") {
		return 1039149, true
	}

	// ── Series ──

	// 1. Dragon Ball Daima (240411)
	if hasWord("daima") || strings.Contains(t, "dragon ball daima") {
		return 240411, true
	}

	// 2. Dragon Ball Super (62715)
	if hasWord("super") || hasWord("dbs") || strings.Contains(t, "dragon ball super") {
		return 62715, true
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
		return 12971, true
	}

	// 7. Original Dragon Ball (12609)
	if hasWord("db") || strings.Contains(t, "dragon ball") || strings.Contains(t, "dragonball") {
		return 12609, true
	}

	return 0, false
}
