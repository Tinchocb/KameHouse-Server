package jikan

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func newTestClient(t *testing.T, handler http.HandlerFunc) (*Client, *int32) {
	t.Helper()
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		handler(w, r)
	}))
	t.Cleanup(srv.Close)
	c := NewClient(nil)
	c.baseURL = srv.URL
	return c, &calls
}

// Con Jikan caído (5xx) se intenta 2 veces y se falla sin dormir el último backoff.
func TestExecuteRequestFallaRapidoAnte5xx(t *testing.T) {
	c, calls := newTestClient(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusGatewayTimeout)
	})

	start := time.Now()
	_, err := c.GetAnimeFull(context.Background(), 223)
	elapsed := time.Since(start)

	if !errors.Is(err, ErrUnavailable) {
		t.Fatalf("se esperaba ErrUnavailable, llegó %v", err)
	}
	if got := atomic.LoadInt32(calls); got != maxServerErrorAttempts {
		t.Fatalf("se esperaban %d intentos, hubo %d", maxServerErrorAttempts, got)
	}
	// Un solo backoff (~1 s + jitter); antes eran 1 + 2 + 4 s.
	if elapsed > 2500*time.Millisecond {
		t.Fatalf("tardó demasiado: %s", elapsed)
	}
}

func TestExecuteRequestDevuelveDatosCuandoResponde(t *testing.T) {
	c, calls := newTestClient(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"data":{"mal_id":223,"title":"Dragon Ball","episodes":153}}`))
	})

	res, err := c.GetAnimeFull(context.Background(), 223)
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	if res.Data.Title != "Dragon Ball" || res.Data.Episodes != 153 {
		t.Fatalf("respuesta mal decodificada: %+v", res.Data)
	}
	if got := atomic.LoadInt32(calls); got != 1 {
		t.Fatalf("se esperaba 1 intento, hubo %d", got)
	}
}

func TestExecuteRequestNoReintentaUn404(t *testing.T) {
	c, calls := newTestClient(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})

	_, err := c.GetAnimeFull(context.Background(), 1)
	if err == nil || errors.Is(err, ErrUnavailable) {
		t.Fatalf("un 404 no es 'servicio caído': %v", err)
	}
	if got := atomic.LoadInt32(calls); got != 1 {
		t.Fatalf("un 404 no se reintenta; hubo %d intentos", got)
	}
}
