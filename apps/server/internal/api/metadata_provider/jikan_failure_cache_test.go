package metadata_provider

import (
	"errors"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	apiMetadata "kamehouse/internal/api/metadata"
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

// Con Jikan lento (caído con 504 y backoff), la apertura no espera más que
// jikanInlineWait; la consulta termina en segundo plano, se deduplica y su
// resultado sirve para la próxima apertura.
func TestJikanProviderNoBloqueaConJikanLento(t *testing.T) {
	old := jikanInlineWait
	jikanInlineWait = 20 * time.Millisecond
	defer func() { jikanInlineWait = old }()

	p := NewJikanProviderImpl(nil, nil, nil, nil)
	release := make(chan struct{})
	var calls atomic.Int32
	p.fetchFn = func(id int) (*apiMetadata.AnimeMetadata, error) {
		calls.Add(1)
		<-release
		return &apiMetadata.AnimeMetadata{EpisodeCount: 12}, nil
	}

	start := time.Now()
	if _, err := p.GetAnimeMetadata(7); !errors.Is(err, errJikanSlow) {
		t.Fatalf("se esperaba errJikanSlow, llegó: %v", err)
	}
	if _, err := p.GetAnimeMetadata(7); !errors.Is(err, errJikanSlow) {
		t.Fatalf("segunda apertura: se esperaba errJikanSlow, llegó: %v", err)
	}
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("la apertura esperó %s", elapsed)
	}

	close(release)
	deadline := time.Now().Add(2 * time.Second)
	for {
		res, err := p.GetAnimeMetadata(7)
		if err == nil && res != nil && res.EpisodeCount == 12 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("el resultado en segundo plano no llegó: %v", err)
		}
		time.Sleep(5 * time.Millisecond)
	}
	// Las dos primeras aperturas compartieron la misma consulta en curso.
	if n := calls.Load(); n > 2 {
		t.Fatalf("consultas a Jikan = %d, se esperaba deduplicación", n)
	}
}

// Un panic en la consulta de fondo no debe tirar el servidor: vuelve como error.
func TestJikanProviderRecuperaPanicEnSegundoPlano(t *testing.T) {
	p := NewJikanProviderImpl(nil, nil, nil, nil)
	p.fetchFn = func(id int) (*apiMetadata.AnimeMetadata, error) { panic("boom") }
	if _, err := p.GetAnimeMetadata(9); err == nil || !strings.Contains(err.Error(), "panic") {
		t.Fatalf("se esperaba el panic convertido en error, llegó: %v", err)
	}
}
