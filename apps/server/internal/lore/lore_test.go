package lore

import (
	"testing"
)

func TestGetLore(t *testing.T) {
	l := GetLore()
	if l == nil {
		t.Fatal("Expected lore to be parsed, got nil")
	}
	if l.Universe != "Dragon Ball" {
		t.Errorf("Expected universe to be 'Dragon Ball', got '%s'", l.Universe)
	}
	if len(l.SagasWiki) == 0 {
		t.Error("Expected at least one series in sagas_wiki")
	}
}

func TestGetSagaRanges(t *testing.T) {
	// Test Dragon Ball Z (TMDB 12971)
	sagas := GetSagaRanges(12971)
	if len(sagas) != 8 {
		t.Fatalf("Expected exactly 8 sagas for DBZ, got %d", len(sagas))
	}

	expected := []struct {
		id    string
		title string
		start int
		end   int
	}{
		{"saiyajin", "Saga Saiyajin", 1, 35},
		{"freezer", "Saga de Freezer", 36, 107},
		{"garlic-jr", "Saga de Garlic Jr.", 108, 117},
		{"androides", "Saga de los Androides", 118, 139},
		{"cell", "Saga de Cell", 140, 194},
		{"torneo-otro-mundo", "Saga del Torneo del Otro Mundo", 195, 199},
		{"gran-saiyaman", "Saga del Gran Saiyaman", 200, 209},
		{"majin-buu", "Saga de Majin Buu", 210, 291},
	}

	for i, exp := range expected {
		actual := sagas[i]
		if actual.ID != exp.id {
			t.Errorf("Index %d: expected ID %s, got %s", i, exp.id, actual.ID)
		}
		if actual.Title != exp.title {
			t.Errorf("Index %d: expected Title '%s', got '%s'", i, exp.title, actual.Title)
		}
		if actual.StartEp != exp.start {
			t.Errorf("Index %d: expected StartEp %d, got %d", i, exp.start, actual.StartEp)
		}
		if actual.EndEp != exp.end {
			t.Errorf("Index %d: expected EndEp %d, got %d", i, exp.end, actual.EndEp)
		}
	}
}
