package scanner

import (
	"regexp"
	"strings"
)

// customIDOverrides maps normalized fan-edit/custom release titles directly to Platform IDs.
// Matched titles short-circuit the Bayesian engine and skip external API calls entirely.
var customIDOverrides = map[string]int{
	// Dragon Ball Kai fan-edits
	"dragon ball kai ultimate":         6033,
	"dragon ball kai seldion":          6033,
	"dragon ball kai ultimate seldion": 6033,
	"dragon ball z kai":                6033,
	"dragon ball kai saga saiyajin":    6033,
	"dragon ball kai saga saiyan":      6033,
	"dragon ball kai saga bu":          6033,
	"dragon ball kai saga buu":         6033,
	"dragon ball kai saga cell":        6033,
	"dragon ball kai saga freezer":     6033,
	"dragon ball kai saga frieza":      6033,
	"dragon ball kai saga namek":       6033,
	// Dragon Ball GT
	"dragon ball gt": 534,
}

// reFanEditTokens strips fan-edit markers (release groups, saga labels) from titles
// so the core title remains clean for Dice/Bayesian matching.
// Pre-compiled at init to avoid per-file allocation.
var reFanEditTokens = regexp.MustCompile(`(?i)\b(?:ultimate\s+by\s+\w+|by\s+seldion|saga\s+(?:saiyajin|saiyan|bu+|cell|freez?e?r?|frieza|namek))\b`)

// LookupCustomOverride checks if a cleaned title matches a hardcoded Platform ID override.
// Returns the Platform media ID and true if found; 0 and false otherwise.
func LookupCustomOverride(cleanTitle string) (int, bool) {
	normalized := normalizeForAliasLookup(cleanTitle)
	// Strip fan-edit tokens for a second-pass lookup
	stripped := normalizeForAliasLookup(StripFanEditTokens(normalized))

	if id, ok := customIDOverrides[normalized]; ok {
		return id, true
	}
	if id, ok := customIDOverrides[stripped]; ok {
		return id, true
	}
	return 0, false
}

// StripFanEditTokens removes fan-edit markers from a title string,
// returning a clean version suitable for upstream Platform matching.
func StripFanEditTokens(title string) string {
	cleaned := reFanEditTokens.ReplaceAllString(title, " ")
	// Collapse any resulting double spaces
	for strings.Contains(cleaned, "  ") {
		cleaned = strings.ReplaceAll(cleaned, "  ", " ")
	}
	return strings.TrimSpace(cleaned)
}

// animeAliases maps canonical anime titles to their commonly used alternative names.
// These aliases help the matcher find the correct media when file names use non-standard
// or abbreviated titles that don't appear in Platform databases (MAL/TMDB/AniDB).
//
// Keys are lowercase canonical titles; values are lowercase alternative names.
var animeAliases = map[string][]string{
	// Dragon Ball franchise
	"dragon ball":       {"db", "dragonball"},
	"dragon ball z":     {"dbz", "dragonball z", "dragon ball zet"},
	"dragon ball super": {"dbs", "dragonball super"},
	"dragon ball gt":    {"dbgt", "dragonball gt"},
	"dragon ball kai":   {"dbk", "dbkai", "dragon ball z kai", "dragonball kai"},
	"dragon ball daima": {"db daima", "dragonball daima"},
	"dragon ball z kai": {"dbz kai", "dragonball z kai"},

	// Naruto franchise
	"naruto":                         {"naruto original"},
	"naruto shippuuden":              {"naruto shippuden", "naruto shippuuden", "naruto shippuden"},
	"boruto naruto next generations": {"boruto", "boruto next gen"},

	// One Piece
	"one piece": {"onepiece", "op"},

	// Attack on Titan / Shingeki no Kyojin
	"shingeki no kyojin":                         {"attack on titan", "aot", "snk", "shingeki"},
	"shingeki no kyojin season 2":                {"attack on titan season 2", "aot s2", "snk s2"},
	"shingeki no kyojin season 3":                {"attack on titan season 3", "aot s3", "snk s3"},
	"shingeki no kyojin the final season":        {"attack on titan the final season", "aot final", "snk final", "aot s4", "snk s4"},
	"shingeki no kyojin the final season part 2": {"aot final part 2", "attack on titan final part 2"},

	// My Hero Academia / Boku no Hero Academia
	"boku no hero academia":            {"my hero academia", "bnha", "mha"},
	"boku no hero academia 2nd season": {"my hero academia season 2", "bnha s2", "mha s2"},
	"boku no hero academia 3rd season": {"my hero academia season 3", "bnha s3", "mha s3"},
	"boku no hero academia 4th season": {"my hero academia season 4", "bnha s4", "mha s4"},
	"boku no hero academia 5th season": {"my hero academia season 5", "bnha s5", "mha s5"},
	"boku no hero academia 6th season": {"my hero academia season 6", "bnha s6", "mha s6"},
	"boku no hero academia 7th season": {"my hero academia season 7", "bnha s7", "mha s7"},

	// Demon Slayer / Kimetsu no Yaiba
	"kimetsu no yaiba":                        {"demon slayer", "kny"},
	"kimetsu no yaiba mugen ressha-hen":       {"demon slayer mugen train", "kny mugen train"},
	"kimetsu no yaiba yuukaku-hen":            {"demon slayer entertainment district", "kny s2"},
	"kimetsu no yaiba katanakaji no sato-hen": {"demon slayer swordsmith village", "kny s3"},
	"kimetsu no yaiba hashira geiko-hen":      {"demon slayer hashira training", "kny s4"},

	// Jujutsu Kaisen
	"jujutsu kaisen":            {"jjk"},
	"jujutsu kaisen 2nd season": {"jjk s2", "jujutsu kaisen season 2"},

	// Fullmetal Alchemist
	"hagane no renkinjutsushi":                     {"fullmetal alchemist", "fma"},
	"hagane no renkinjutsushi fullmetal alchemist": {"fma 2003"},
	"hagane no renkinjutsushi brotherhood":         {"fullmetal alchemist brotherhood", "fmab", "fma brotherhood"},

	// Death Note
	"death note": {"dn"},

	// Sword Art Online
	"sword art online":                               {"sao"},
	"sword art online ii":                            {"sao 2", "sao ii"},
	"sword art online alicization":                   {"sao alicization", "sao s3"},
	"sword art online alicization war of underworld": {"sao alicization wou", "sao s4"},

	// Re:Zero
	"re zero kara hajimeru isekai seikatsu":            {"re zero", "rezero", "re:zero"},
	"re zero kara hajimeru isekai seikatsu 2nd season": {"re zero s2", "rezero s2", "re:zero season 2"},

	// Steins;Gate
	"steins gate":   {"steinsgate", "steins;gate", "sg"},
	"steins gate 0": {"steinsgate 0", "steins;gate 0", "sg0"},

	// Hunter x Hunter
	"hunter x hunter":      {"hxh"},
	"hunter x hunter 2011": {"hxh 2011"},

	// Mob Psycho 100
	"mob psycho 100":     {"mob psycho", "mp100"},
	"mob psycho 100 ii":  {"mob psycho s2", "mp100 s2"},
	"mob psycho 100 iii": {"mob psycho s3", "mp100 s3"},

	// Spy x Family
	"spy x family":          {"spy family", "spyxfamily", "sxf"},
	"spy x family season 2": {"spy family s2", "sxf s2"},

	// Chainsaw Man
	"chainsaw man": {"csm"},

	// Tokyo Ghoul
	"tokyo ghoul":    {"tg"},
	"tokyo ghoul re": {"tg re", "tokyo ghoul:re"},

	// Bleach
	"bleach":                   {"bleach original"},
	"bleach sennen kessen-hen": {"bleach thousand year blood war", "bleach tybw"},
	"bleach sennen kessen-hen ketsubetsu-tan": {"bleach tybw part 2", "bleach tybw s2"},

	// Neon Genesis Evangelion
	"shin seiki evangelion": {"neon genesis evangelion", "nge", "evangelion", "eva"},

	// Code Geass
	"code geass hangyaku no lelouch":    {"code geass", "code geass r1"},
	"code geass hangyaku no lelouch r2": {"code geass r2", "code geass season 2"},

	// Cowboy Bebop
	"cowboy bebop": {"cb"},

	// Konosuba
	"kono subarashii sekai ni shukufuku wo":   {"konosuba", "konosuba s1"},
	"kono subarashii sekai ni shukufuku wo 2": {"konosuba s2", "konosuba 2"},
	"kono subarashii sekai ni shukufuku wo 3": {"konosuba s3", "konosuba 3"},

	// Overlord
	"overlord":     {"overlord s1"},
	"overlord ii":  {"overlord s2", "overlord 2"},
	"overlord iii": {"overlord s3", "overlord 3"},
	"overlord iv":  {"overlord s4", "overlord 4"},

	// Mushoku Tensei
	"mushoku tensei isekai ittara honki dasu":        {"mushoku tensei", "mt", "jobless reincarnation"},
	"mushoku tensei isekai ittara honki dasu part 2": {"mushoku tensei part 2", "mt part 2"},
	"mushoku tensei ii isekai ittara honki dasu":     {"mushoku tensei s2", "mushoku tensei season 2"},

	// Solo Leveling
	"ore dake level up na ken":                                {"solo leveling"},
	"ore dake level up na ken season 2 arise from the shadow": {"solo leveling s2", "solo leveling season 2"},

	// Oshi no Ko
	"oshi no ko":            {"oshinoko", "my star"},
	"oshi no ko 2nd season": {"oshi no ko s2"},

	// Frieren
	"sousou no frieren": {"frieren", "frieren beyond journeys end"},

	// Vinland Saga
	"vinland saga":          {"vs"},
	"vinland saga season 2": {"vs s2"},

	// Bocchi the Rock
	"bocchi the rock": {"bocchi", "btr"},

	// Ranking of Kings
	"ousama ranking": {"ranking of kings"},

	// Mob classics
	"gintama":   {"gintama s1"},
	"gintama'":  {"gintama s2"},
	"gintama''": {"gintama s3"},
	"gintama.":  {"gintama s4", "gintama enchousen"},

	// Monogatari series
	"bakemonogatari":                  {"monogatari s1"},
	"nisemonogatari":                  {"monogatari s2"},
	"monogatari series second season": {"monogatari ss"},

	// Fate series
	"fate stay night":                       {"fsn", "fate sn"},
	"fate stay night unlimited blade works": {"fate ubw", "fsn ubw"},
	"fate zero":                             {"fz", "fate/zero"},
	"fate grand order":                      {"fgo"},

	// Tensei shitara Slime
	"tensei shitara slime datta ken":            {"that time i got reincarnated as a slime", "tensura", "slime"},
	"tensei shitara slime datta ken 2nd season": {"tensura s2", "slime s2"},
	"tensei shitara slime datta ken 3rd season": {"tensura s3", "slime s3"},

	// Danmachi
	"dungeon ni deai wo motomeru no wa machigatteiru darou ka": {"danmachi", "is it wrong to pick up girls in a dungeon"},
	"danmachi": {"is it wrong to pick up girls in a dungeon"},

	// Blue Lock
	"blue lock":               {"bl"},
	"blue lock vs u-20 japan": {"blue lock s2"},

	// Isekai Quartet related
	"tate no yuusha no nariagari":          {"shield hero", "rising of the shield hero"},
	"tate no yuusha no nariagari season 2": {"shield hero s2"},
	"tate no yuusha no nariagari season 3": {"shield hero s3"},

	// Classroom of the Elite
	"youkoso jitsuryoku shijou shugi no kyoushitsu e":            {"classroom of the elite", "cote"},
	"youkoso jitsuryoku shijou shugi no kyoushitsu e 2nd season": {"classroom of the elite s2", "cote s2"},
	"youkoso jitsuryoku shijou shugi no kyoushitsu e 3rd season": {"classroom of the elite s3", "cote s3"},

	// Miscellaneous popular series
	"shokugeki no souma":              {"food wars", "food wars shokugeki no soma"},
	"kaguya-sama wa kokurasetai":      {"kaguya sama", "love is war", "kaguya sama love is war"},
	"sono bisque doll wa koi wo suru": {"my dress up darling", "dress up darling"},
	"86 eighty six":                   {"86", "eighty six"},
	"summertime render":               {"summer time rendering", "summertime rendering"},
	"made in abyss":                   {"mia"},
	"dr stone":                        {"dr. stone", "doctor stone"},
	"yahari ore no seishun love comedy wa machigatteiru": {"oregairu", "snafu", "my teen romantic comedy"},
	"toradora":            {"toradora!"},
	"k-on":                {"k-on!", "keion"},
	"clannad":             {"clannad s1"},
	"clannad after story": {"clannad s2"},
}

// commonAbbreviations maps short abbreviations to their expanded forms.
// These are used during title normalization to expand abbreviations found in file names.
var commonAbbreviations = map[string]string{
	"dbz":   "dragon ball z",
	"dbs":   "dragon ball super",
	"dbgt":  "dragon ball gt",
	"aot":   "attack on titan",
	"snk":   "shingeki no kyojin",
	"bnha":  "boku no hero academia",
	"mha":   "my hero academia",
	"kny":   "kimetsu no yaiba",
	"jjk":   "jujutsu kaisen",
	"fma":   "fullmetal alchemist",
	"fmab":  "fullmetal alchemist brotherhood",
	"sao":   "sword art online",
	"hxh":   "hunter x hunter",
	"mp100": "mob psycho 100",
	"csm":   "chainsaw man",
	"nge":   "neon genesis evangelion",
	"tybw":  "bleach thousand year blood war",
	"sxf":   "spy x family",
	"fgo":   "fate grand order",
	"cote":  "classroom of the elite",
	"mia":   "made in abyss",
	"op":    "one piece",
}

// GetAliasesForTitle returns all known aliases for a given title (case-insensitive).
// The result includes the original title itself.
func GetAliasesForTitle(title string) []string {
	lower := normalizeForAliasLookup(title)

	// Direct match
	if aliases, ok := animeAliases[lower]; ok {
		return aliases
	}

	// Reverse lookup: Check if the title is an alias of something
	for canonical, aliases := range animeAliases {
		for _, alias := range aliases {
			if alias == lower {
				// Return the canonical title plus all other aliases
				result := make([]string, 0, len(aliases)+1)
				result = append(result, canonical)
				for _, a := range aliases {
					if a != lower {
						result = append(result, a)
					}
				}
				return result
			}
		}
	}

	return nil
}

// ExpandAbbreviation attempts to expand a short abbreviation into its full title.
// Returns the expanded form and true if found, or the original and false if not.
func ExpandAbbreviation(abbr string) (string, bool) {
	lower := normalizeForAliasLookup(abbr)
	if expanded, ok := commonAbbreviations[lower]; ok {
		return expanded, true
	}
	return abbr, false
}

// normalizeForAliasLookup normalizes a string for alias lookup by lowercasing
// and trimming whitespace.
func normalizeForAliasLookup(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}
