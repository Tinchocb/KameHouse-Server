package jikan

import "testing"

// Regresión: el corte por caída vive en el cliente. Si cada pedido creaba uno nuevo, el corte
// nunca se acumulaba y cada consulta esperaba el timeout completo con Jikan caído.
func TestSharedKeepsOutageState(t *testing.T) {
	a := Shared(nil)
	t.Cleanup(func() { a.outageUntil.Store(0) })

	if Shared(nil) != a {
		t.Fatal("Shared debe devolver siempre el mismo cliente")
	}

	a.markOutage()
	if !Shared(nil).inOutage() {
		t.Fatal("el corte por caída debe verse desde el cliente compartido")
	}
	if NewClient(nil).inOutage() {
		t.Fatal("un cliente nuevo arranca sin corte")
	}
}
