package handlers

import (
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestCurrentAccountID(t *testing.T) {
	newCtx := func() echo.Context {
		return echo.New().NewContext(httptest.NewRequest("GET", "/", nil), httptest.NewRecorder())
	}

	if got := currentAccountID(nil); got != localAccountID {
		t.Errorf("nil ctx = %d, want %d", got, localAccountID)
	}
	if got := currentAccountID(newCtx()); got != localAccountID {
		t.Errorf("sin user_id = %d, want %d", got, localAccountID)
	}

	c := newCtx()
	c.Set("user_id", uint(7))
	if got := currentAccountID(c); got != 7 {
		t.Errorf("user_id=7 -> %d", got)
	}

	c = newCtx()
	c.Set("user_id", uint(0))
	if got := currentAccountID(c); got != localAccountID {
		t.Errorf("user_id=0 debe caer a la cuenta local, got %d", got)
	}

	c = newCtx()
	c.Set("user_id", 7) // int, no uint
	if got := currentAccountID(c); got != localAccountID {
		t.Errorf("user_id de tipo incorrecto debe ignorarse, got %d", got)
	}
}
