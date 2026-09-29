package scanner

import (
	"strings"
)

// animeAliases maps canonical Dragon Ball series titles to their commonly used alternative names.
// These aliases help the matcher find the correct media when file names use non-standard
// or abbreviated titles.
//
// Keys are lowercase canonical titles; values are lowercase alternative names.
var animeAliases = map[string][]string{
	// Dragon Ball franchise (6 main official series)
	"dragon ball": {
		"db", "dragonball", "dragon ball clasico", "dragon ball clásico", "dragon ball original",
		"db clasico", "db clásico", "db original",
	},
	"dragon ball z": {
		"dbz", "dragonball z", "dragon ball zet", "db z", "dragonballz",
	},
	"dragon ball gt": {
		"dbgt", "dragonball gt", "db gt", "dragonballgt",
	},
	"dragon ball super": {
		"dbs", "dragonball super", "db super", "dragonballsuper",
	},
	"dragon ball daima": {
		"db daima", "dragonball daima", "daima", "dbdaima",
	},
	"dragon ball kai": {
		"db kai", "dragonball kai", "dragon ball z kai", "dbz kai", "dragonball z kai",
		"dbkai", "dbzkai", "dragon ball kai the final chapters",
	},
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

// normalizeForAliasLookup normalizes a string for alias lookup by lowercasing
// and trimming whitespace.
func normalizeForAliasLookup(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}
