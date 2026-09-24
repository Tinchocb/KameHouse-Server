package intelligence

import (
	"testing"
)

func TestCanonicalTimeline(t *testing.T) {
	if len(CanonicalTimeline) == 0 {
		t.Fatalf("expected CanonicalTimeline to have milestones, got 0")
	}

	// Verify timeline continuity and order
	for i, m := range CanonicalTimeline {
		if m.Order != i+1 {
			t.Errorf("milestone %q: expected order %d, got %d", m.ID, i+1, m.Order)
		}
		if m.Year == "" {
			t.Errorf("milestone %q has empty in-universe Year", m.ID)
		}
		if m.Title == "" {
			t.Errorf("milestone %q has empty Title", m.ID)
		}
		if m.MediaID == 0 {
			t.Errorf("milestone %q has 0 MediaID", m.ID)
		}
	}

	// Locks the Super/GT lapso splits (1:1 with the 35 story spans).
	wantIDs := []string{
		"m_dbs_u6",
		"m_dbs_copy_vegeta",
		"m_dbs_black",
		"m_dbs_exhibicion",
		"m_dbs_reclutamiento",
		"m_dbs_top",
		"m_db_gt_black_star",
		"m_db_gt_baby",
		"m_db_gt_super17",
		"m_db_gt_dragons",
	}
	byID := make(map[string]bool)
	for _, m := range CanonicalTimeline {
		byID[m.ID] = true
	}
	for _, id := range wantIDs {
		if !byID[id] {
			t.Errorf("expected split milestone %q in CanonicalTimeline", id)
		}
	}
}

func TestSearchSemanticEntities(t *testing.T) {
	tests := []struct {
		query       string
		minResults  int
		wantKeyword string
	}{
		{"ultra instinto", 1, "Ultra Instinto"},
		{"broly", 1, "Broly"},
		{"freezer", 1, "Saga de Freezer"},
		{"vegeta", 1, "Vegeta"},
		{"padre de goku", 1, "Bardock"},
	}

	for _, tt := range tests {
		results := SearchSemanticEntities(tt.query)
		if len(results) < tt.minResults {
			t.Errorf("query %q: got %d results, want >= %d", tt.query, len(results), tt.minResults)
		}
	}
}
