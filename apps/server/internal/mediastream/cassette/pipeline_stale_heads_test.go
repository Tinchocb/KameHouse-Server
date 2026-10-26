package cassette

import "testing"

// Un timeout de espera no debe reiniciar la cabeza que produce el segmento pedido: esa
// conserva su progreso. Sólo caen las cabezas que no lo cubren (liberan slots del governor).
func TestKillStaleHeadsKeepsHeadProducingSegment(t *testing.T) {
	p := &Pipeline{killCh: make(chan struct{})}

	covering := p.claimHeadSlotLocked(head{segment: 300, end: 400, gen: 1})
	stale := p.claimHeadSlotLocked(head{segment: 10, end: 110, gen: 2})

	p.killStaleHeads(350)

	if p.heads[covering].dying || p.heads[covering].segment != 300 {
		t.Fatalf("la cabeza que cubre el segmento fue tocada: %+v", p.heads[covering])
	}
	if !p.heads[stale].dying {
		t.Fatalf("la cabeza que no cubre el segmento debía marcarse como muerta: %+v", p.heads[stale])
	}
}
