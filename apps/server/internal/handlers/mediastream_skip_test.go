package handlers

import (
	"testing"

	"kamehouse/internal/database/models"
)

func TestFillForwardHeuristic(t *testing.T) {
	siblings := []models.EpisodeSkipTime{
		{
			MediaID:       10,
			EpisodeNumber: 1,
			OpStart:       60.0,
			OpEnd:         150.0,
			EdOffset:      1320.0,
			EdEnd:         1410.0,
		},
		{
			MediaID:       10,
			EpisodeNumber: 2,
			OpStart:       61.0,
			OpEnd:         150.0,
			EdOffset:      1321.0,
			EdEnd:         1410.0,
		},
	}

	// Caso: episodio 3 sin marcas pero con 2 episodios previos consistentes en OP y ED
	res := fillForwardHeuristic(siblings, 3)
	if res == nil {
		t.Fatalf("se esperaba heurística fill-forward para episodio 3")
	}
	if res.Source != "heuristic" {
		t.Errorf("fuente esperada 'heuristic', got '%s'", res.Source)
	}
	if res.OpStart == 0 || res.OpEnd == 0 {
		t.Errorf("se esperaba OP propagado, got OpStart=%v, OpEnd=%v", res.OpStart, res.OpEnd)
	}
	if res.EdOffset == 0 {
		t.Errorf("se esperaba ED propagado, got EdOffset=%v", res.EdOffset)
	}

	// Caso: menos de 2 episodios
	single := []models.EpisodeSkipTime{siblings[0]}
	if fillForwardHeuristic(single, 2) != nil {
		t.Errorf("no debería propagar con menos de 2 episodios")
	}

	// Caso: episodios previos con offsets inconsistentes de ED (> 3s)
	inconsistent := []models.EpisodeSkipTime{
		{
			MediaID:       10,
			EpisodeNumber: 1,
			OpStart:       60.0,
			OpEnd:         150.0,
			EdOffset:      1200.0,
		},
		{
			MediaID:       10,
			EpisodeNumber: 2,
			OpStart:       60.5,
			OpEnd:         150.0,
			EdOffset:      1350.0, // 150s de diferencia
		},
	}
	resInc := fillForwardHeuristic(inconsistent, 3)
	if resInc == nil {
		t.Fatalf("se esperaba propagar OP consistente")
	}
	if resInc.EdOffset != 0 {
		t.Errorf("no debería haber propagado ED inconsistente, got EdOffset=%v", resInc.EdOffset)
	}
}
