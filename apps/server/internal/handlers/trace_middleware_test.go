package handlers

import (
	"net/http/httptest"
	"testing"
)

func TestIsLongLivedRequest(t *testing.T) {
	ws := httptest.NewRequest("GET", "/api/v1/ws?id=x", nil)
	ws.Header.Set("Upgrade", "websocket")
	sse := httptest.NewRequest("GET", "/api/v1/events", nil)
	sse.Header.Set("Accept", "text/event-stream")

	if !isLongLivedRequest(ws) {
		t.Error("un WebSocket es de larga duración")
	}
	if !isLongLivedRequest(sse) {
		t.Error("SSE es de larga duración")
	}
	if !isLongLivedRequest(httptest.NewRequest("GET", "/api/v1/drive/play?fileId=1", nil)) {
		t.Error("el streaming de Drive es de larga duración")
	}
	if isLongLivedRequest(httptest.NewRequest("GET", "/api/v1/library/anime-entry/1", nil)) {
		t.Error("una petición normal no debe excluirse del aviso de lentitud")
	}
}
