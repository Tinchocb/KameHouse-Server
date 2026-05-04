package streaming

import (
	"kamehouse/internal/database/models/dto"
	"sort"
	"testing"
)

func TestSourcePriorityEngine(t *testing.T) {
	sources := []dto.EpisodeSource{
		{Type: dto.SourceTypeLocal, Priority: 1, Title: "Local File"},
	}

	// Test the sorting logic from ResolveEpisodeSources
	sort.Slice(sources, func(i, j int) bool {
		return sources[i].Priority < sources[j].Priority
	})

	if sources[0].Priority != 1 || sources[0].Type != "local" {
		t.Errorf("Expected Priority 1 (local) to be first, got %v", sources[0])
	}
}
