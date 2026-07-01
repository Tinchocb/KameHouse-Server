package handlers

import (
	"github.com/labstack/echo/v4"
)

// DragonballLore is the response shape consumed by the web client's
// CharacterDetailModal (loreData.characters_wiki).
type DragonballLore struct {
	CharactersWiki []DragonballLoreCharacter `json:"characters_wiki"`
}

type DragonballLoreCharacter struct {
	Name            string                       `json:"name"`
	Alias           []string                     `json:"alias,omitempty"`
	Race            string                       `json:"race,omitempty"`
	Origin          string                       `json:"origin,omitempty"`
	HeightCm        float64                      `json:"height_cm,omitempty"`
	WeightKg        float64                      `json:"weight_kg,omitempty"`
	Biography       string                       `json:"biography,omitempty"`
	Personality     string                       `json:"personality,omitempty"`
	Techniques      []string                     `json:"techniques,omitempty"`
	Transformations []DragonballLoreTransformation `json:"transformations,omitempty"`
}

type DragonballLoreTransformation struct {
	Name        string `json:"name"`
	Multiplier  string `json:"multiplier,omitempty"`
	Description string `json:"description,omitempty"`
}

// HandleGetDragonballLore returns the local Dragon Ball character wiki used to
// populate the character detail modal. No character data has been authored
// yet, so it currently returns an empty list — the client gates this query to
// Dragon Ball media only and treats an empty wiki as "no entry found".
func (h *Handler) HandleGetDragonballLore(c echo.Context) error {
	return JSONSuccess(c, DragonballLore{
		CharactersWiki: []DragonballLoreCharacter{},
	})
}
