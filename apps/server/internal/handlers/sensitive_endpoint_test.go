package handlers

import (
	"net/http"
	"testing"
)

// El token comodín de streaming va en las URLs de video: solo debe servir para
// leer rutas de reproducción, nunca para ajustes, apagado o borrados.
func TestIsStreamTokenRequest(t *testing.T) {
	cases := []struct {
		method, path string
		want         bool
	}{
		{http.MethodGet, "/api/v1/mediastream/direct/play", true},
		{http.MethodGet, "/api/v1/mediastream/transcode/abc/master.m3u8", true},
		{http.MethodGet, "/api/v1/mediastream/hls/abc/seg-1.ts", true},
		{http.MethodGet, "/api/v1/mediastream/subs", true},
		{http.MethodGet, "/api/v1/mediastream/att/font.ttf", true},
		{http.MethodGet, "/api/v1/drive/play", true},
		{http.MethodHead, "/api/v1/drive/play", true},
		{http.MethodGet, "/api/v1/video-thumbnail", true},
		{http.MethodPost, "/api/v1/drive/play", false},
		{http.MethodPatch, "/api/v1/settings", false},
		{http.MethodPatch, "/api/v1/mediastream/settings", false},
		{http.MethodPost, "/api/v1/mediastream/request", false},
		{http.MethodGet, "/api/v1/settings", false},
		{http.MethodGet, "/api/v1/report", false},
		{http.MethodGet, "/api/v1/ws", false},
		{http.MethodPost, "/api/v1/shutdown", false},
		{http.MethodDelete, "/api/v1/library/local-files", false},
	}
	for _, tc := range cases {
		if got := isStreamTokenRequest(tc.method, tc.path); got != tc.want {
			t.Errorf("isStreamTokenRequest(%s, %s) = %v, want %v", tc.method, tc.path, got, tc.want)
		}
	}
}

func TestIsSensitiveEndpointByMethod(t *testing.T) {
	cases := []struct {
		method, path string
		want         bool
	}{
		{http.MethodDelete, "/api/v1/library/local-files", true},
		{http.MethodGet, "/api/v1/library/local-files", false}, // los clientes LAN listan la biblioteca
		{http.MethodPatch, "/api/v1/library/local-files", false},
		{http.MethodDelete, "/api/v1/library/empty-directories", true},
		{http.MethodPost, "/api/v1/system/cache/clear", true},
		{http.MethodDelete, "/api/v1/metadata/cache", true},
		{http.MethodGet, "/api/v1/report", true},
		{http.MethodGet, "/api/v1/library/local-files/dump", true},
		{http.MethodGet, "/api/v1/status", false},
		{http.MethodPatch, "/api/v1/settings", true},
		{http.MethodGet, "/api/v1/settings", false},
		{http.MethodPost, "/api/v1/start", true},
		{http.MethodPatch, "/api/v1/mediastream/settings", true},
		{http.MethodPost, "/api/v1/drive/callback", true},
		{http.MethodGet, "/api/v1/drive/callback", false}, // redirect de Google, validado por state
		{http.MethodPost, "/api/v1/drive/disconnect", true},
	}
	for _, tc := range cases {
		if got := isSensitiveEndpoint(tc.method, tc.path); got != tc.want {
			t.Errorf("isSensitiveEndpoint(%s, %s) = %v, want %v", tc.method, tc.path, got, tc.want)
		}
	}
}

// Sin contraseña, toda escritura que no figure en lanWriteRoutes queda
// restringida a localhost: una ruta nueva nace cerrada.
func TestIsRestrictedWrite(t *testing.T) {
	cases := []struct {
		method, path string
		want         bool
	}{
		// Escrituras que necesita un cliente de la LAN.
		{http.MethodPost, "/api/v1/mediastream/preload", false},
		{http.MethodPatch, "/api/v1/continuity/item", false},
		{http.MethodPost, "/api/v1/mediastream/request", false},
		{http.MethodPost, "/api/v1/library/anime-entry/progress", false},
		{http.MethodPost, "/api/v1/tmdb/search", false},
		// Lecturas: nunca se restringen por este camino.
		{http.MethodGet, "/api/v1/library/local-files", false},
		{http.MethodHead, "/api/v1/drive/play", false},
		{http.MethodOptions, "/api/v1/playback/sync", false},
		// Escrituras que solo se hacen desde este equipo.
		{http.MethodPost, "/api/v1/cache/thumbnails/warm", true},
		{http.MethodPost, "/api/v1/intelligence/chronology/overrides", true},
		{http.MethodPost, "/api/v1/intelligence/chronology/moment-times", true},
		{http.MethodDelete, "/api/v1/notifications", true},
		{http.MethodPost, "/api/v1/library/scan", true},
		{http.MethodPost, "/api/v1/drive/scan", true},
		{http.MethodPost, "/api/v1/mediastream/pretranscode", true},
		{http.MethodPost, "/api/v1/library/anime-entry/source", true},
		{http.MethodPut, "/api/v1/ruta-nueva-sin-registrar", true},
	}
	for _, tc := range cases {
		if got := isRestrictedWrite(tc.method, tc.path); got != tc.want {
			t.Errorf("isRestrictedWrite(%s, %s) = %v, want %v", tc.method, tc.path, got, tc.want)
		}
	}
}
