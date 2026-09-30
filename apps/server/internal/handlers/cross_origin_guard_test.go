package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestCrossOriginWriteGuard(t *testing.T) {
	allowed := []string{
		"http://127.0.0.1:43211",
		"http://localhost:43210",
		"http://tauri.localhost",
		"tauri://localhost",
	}

	cases := []struct {
		name   string
		method string
		origin string // vacío: sin cabecera
		host   string
		remote string
		want   int
	}{
		// Sin Origin: no es una página web (sidecar, curl, apps nativas).
		{"sin Origin", http.MethodPost, "", "127.0.0.1:43211", "127.0.0.1:5000", http.StatusOK},
		{"sin Origin desde la LAN", http.MethodPost, "", "192.168.1.5:43211", "192.168.1.9:5000", http.StatusOK},

		// Orígenes de la lista permitida.
		{"la propia interfaz", http.MethodPost, "http://127.0.0.1:43211", "127.0.0.1:43211", "127.0.0.1:5000", http.StatusOK},
		{"servidor de desarrollo", http.MethodPatch, "http://localhost:43210", "127.0.0.1:43212", "127.0.0.1:5000", http.StatusOK},
		{"webview de escritorio (http)", http.MethodPost, "http://tauri.localhost", "127.0.0.1:43211", "127.0.0.1:5000", http.StatusOK},
		{"webview de escritorio (tauri://)", http.MethodDelete, "tauri://localhost", "127.0.0.1:43211", "127.0.0.1:5000", http.StatusOK},
		{"comparación sin distinguir mayúsculas", http.MethodPost, "HTTP://LOCALHOST:43210", "127.0.0.1:43212", "127.0.0.1:5000", http.StatusOK},

		// Loopback en otro puerto, desde una conexión de loopback.
		{"dev en otro puerto", http.MethodPost, "http://localhost:43220", "127.0.0.1:43212", "127.0.0.1:5000", http.StatusOK},
		{"dev en 127.0.0.1 con otro puerto", http.MethodPost, "http://127.0.0.1:5173", "127.0.0.1:43212", "[::1]:5000", http.StatusOK},

		// Clientes de la LAN: mismo origen que el Host, que es una IP o un nombre local.
		{"cliente LAN por IP", http.MethodPost, "http://192.168.1.5:43211", "192.168.1.5:43211", "192.168.1.9:5000", http.StatusOK},
		{"cliente LAN por nombre .local", http.MethodPost, "http://minipc.local:43211", "minipc.local:43211", "192.168.1.9:5000", http.StatusOK},

		// Ataques.
		{"sitio ajeno dispara un POST", http.MethodPost, "https://evil.example", "127.0.0.1:43211", "127.0.0.1:5000", http.StatusForbidden},
		{"sitio ajeno borra", http.MethodDelete, "https://evil.example", "127.0.0.1:43211", "127.0.0.1:5000", http.StatusForbidden},
		{"sitio ajeno con PATCH", http.MethodPatch, "https://evil.example", "127.0.0.1:43211", "127.0.0.1:5000", http.StatusForbidden},
		{"Origin null (sandbox o file://)", http.MethodPost, "null", "127.0.0.1:43211", "127.0.0.1:5000", http.StatusForbidden},
		{"DNS rebinding: nombre público que resuelve a localhost", http.MethodPost, "http://evil.example:43211", "evil.example:43211", "127.0.0.1:5000", http.StatusForbidden},
		{"rebinding con otro puerto", http.MethodPost, "http://evil.example:43211", "127.0.0.1:43211", "127.0.0.1:5000", http.StatusForbidden},
		{"origen que solo se parece a uno permitido", http.MethodPost, "http://localhost.evil.example:43210", "127.0.0.1:43211", "127.0.0.1:5000", http.StatusForbidden},
		{"esquema raro", http.MethodPost, "ftp://127.0.0.1:43211", "127.0.0.1:43211", "127.0.0.1:5000", http.StatusForbidden},
		{"origen de loopback pero la conexión viene de la LAN", http.MethodPost, "http://localhost:9999", "192.168.1.5:43211", "192.168.1.9:5000", http.StatusForbidden},
		{"un tercero de la LAN suplanta un Host que no es suyo", http.MethodPost, "http://evil.example", "192.168.1.5:43211", "192.168.1.9:5000", http.StatusForbidden},

		// Las lecturas no se tocan: las protege el CORS.
		{"GET desde un sitio ajeno", http.MethodGet, "https://evil.example", "127.0.0.1:43211", "127.0.0.1:5000", http.StatusOK},
		{"HEAD desde un sitio ajeno", http.MethodHead, "https://evil.example", "127.0.0.1:43211", "127.0.0.1:5000", http.StatusOK},
		{"OPTIONS (preflight)", http.MethodOptions, "https://evil.example", "127.0.0.1:43211", "127.0.0.1:5000", http.StatusOK},
	}

	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler
	guard := crossOriginWriteGuard(allowed)
	handler := guard(func(c echo.Context) error { return c.String(http.StatusOK, "OK") })

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, "/api/v1/shutdown", nil)
			req.Host = tc.host
			req.RemoteAddr = tc.remote
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)
			if err := handler(c); err != nil {
				e.HTTPErrorHandler(err, c)
			}
			if rec.Code != tc.want {
				t.Errorf("%s desde Origin %q (Host %s, conexión %s): esperaba %d, obtuve %d",
					tc.method, tc.origin, tc.host, tc.remote, tc.want, rec.Code)
			}
		})
	}
}
