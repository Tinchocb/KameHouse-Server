package handlers

import (
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestCancelPreTranscodeRejectsInvalidHashBeforeManagerAccess(t *testing.T) {
	for _, hash := range []string{"", "..", `..\outside`, "%2e%2e", "bad"} {
		rec := httptest.NewRecorder()
		c := echo.New().NewContext(httptest.NewRequest("DELETE", "/", nil), rec)
		c.SetParamNames("hash")
		c.SetParamValues(hash)
		h := &Handler{}
		if err := h.HandleCancelPreTranscode(c); err != nil {
			t.Fatal(err)
		}
		if rec.Code != 400 {
			t.Fatalf("hash %q: status %d, want 400", hash, rec.Code)
		}
	}
}
