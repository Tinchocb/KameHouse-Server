package metadata_provider

import (
	"strings"
	"testing"
)

// Un fallo de Jikan no debe repetir los reintentos con backoff en cada
// apertura: el segundo intento dentro de jikanFailureTTL corta en seco.
func TestJikanProviderRecuerdaFallosRecientes(t *testing.T) {
	p := NewJikanProviderImpl(nil, nil, nil, nil)

	if _, err := p.GetAnimeMetadata(42); err == nil {
		t.Fatal("se esperaba error sin base de datos")
	}
	_, err := p.GetAnimeMetadata(42)
	if err == nil || !strings.Contains(err.Error(), "falló recientemente") {
		t.Fatalf("se esperaba el error cacheado, llegó: %v", err)
	}

	p.ClearCache()
	if _, err := p.GetAnimeMetadata(42); err == nil || strings.Contains(err.Error(), "falló recientemente") {
		t.Fatalf("ClearCache debe olvidar los fallos, llegó: %v", err)
	}
}
