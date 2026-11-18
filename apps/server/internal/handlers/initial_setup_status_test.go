package handlers

import (
	"net/http/httptest"
	"testing"

	"kamehouse/internal/core"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
)

// /status pide el asistente inicial solo mientras el primer arranque no se haya
// completado: con la fila nueva sí, y después de guardarlo ya no.
func TestAsistenteInicialSoloEnPrimerArranque(t *testing.T) {
	app, _ := setupTestApp(t)
	l := zerolog.Nop()
	app.FeatureManager = core.NewFeatureManager(&l, core.KameHouseFlags{})
	h := &Handler{App: app}
	e := echo.New()
	status := func() *Status {
		t.Helper()
		return h.NewStatus(e.NewContext(httptest.NewRequest("GET", "/api/v1/status", nil), httptest.NewRecorder()))
	}

	if s := status(); !s.SetupRequired {
		t.Fatal("primer arranque: /status debía pedir el asistente inicial")
	}

	// Lo que hace HandleGettingStarted al terminar: guardar con SetupPending=false.
	stored, err := app.Database.GetStoredSettings()
	if err != nil {
		t.Fatal(err)
	}
	done := *stored
	done.SetupPending = false
	if _, err := app.Database.UpsertSettings(&done); err != nil {
		t.Fatal(err)
	}
	if s := status(); s.SetupRequired {
		t.Fatal("con el asistente ya completado, /status no debía pedirlo de nuevo")
	}
}

// Un cliente no autorizado recibe ajustes vacíos (ID 0): el asistente sigue pidiéndose.
func TestAsistenteInicialClienteNoAutorizado(t *testing.T) {
	app, _ := setupTestApp(t)
	l := zerolog.Nop()
	app.FeatureManager = core.NewFeatureManager(&l, core.KameHouseFlags{})
	app.Config.Server.Password = "secreto"
	h := &Handler{App: app}
	e := echo.New()

	s := h.NewStatus(e.NewContext(httptest.NewRequest("GET", "/api/v1/status", nil), httptest.NewRecorder()))
	if !s.SetupRequired {
		t.Fatal("cliente no autorizado: /status debía pedir el asistente inicial")
	}
}
