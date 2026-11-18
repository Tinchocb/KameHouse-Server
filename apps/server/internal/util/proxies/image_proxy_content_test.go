package util

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/imroc/req/v3"
	"github.com/labstack/echo/v4"
)

var pngBytes = []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01")

// originServing levanta un origen que declara `declared` y devuelve `body`. El
// cliente real rechaza loopback al conectar (SSRF), así que se cambia por uno común.
func originServing(t *testing.T, declared string, body []byte) string {
	t.Helper()
	oldClient := imageProxyClient
	imageProxyClient = req.C()
	t.Cleanup(func() { imageProxyClient = oldClient })

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", declared)
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return srv.URL + "/img"
}

// Un origen malicioso puede declarar image/* y entregar una página o un SVG con
// script: servirlo bajo nuestro origen ejecutaría código con los privilegios de la app.
func TestGetImageRechazaLoQueNoEsUnaImagenRaster(t *testing.T) {
	cases := []struct {
		name, declared string
		body           string
	}{
		{"HTML declarado como jpeg", "image/jpeg", "<html><script>fetch('/api/v1/shutdown',{method:'POST'})</script></html>"},
		{"HTML declarado como HTML", "text/html", "<!DOCTYPE html><script>alert(1)</script>"},
		{"SVG con script", "image/svg+xml", `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script></svg>`},
		{"JavaScript declarado como png", "image/png", "alert(document.cookie)"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			url := originServing(t, tc.declared, []byte(tc.body))
			ip := &ImageProxy{CacheDir: t.TempDir()}

			if body, ct, err := ip.GetImage(url, nil); err == nil {
				t.Fatalf("se aceptó contenido que no es imagen: tipo=%q cuerpo=%q", ct, body)
			}
			if _, err := os.Stat(ip.getCachePath(url)); err == nil {
				t.Fatal("no debe quedar cacheado contenido que no es una imagen")
			}
		})
	}
}

// El tipo lo decide el contenido: un PNG real se sirve como PNG aunque el
// origen lo declare text/html.
func TestGetImageUsaElTipoReal(t *testing.T) {
	url := originServing(t, "text/html", pngBytes)
	ip := &ImageProxy{CacheDir: t.TempDir()}

	_, ct, err := ip.GetImage(url, nil)
	if err != nil {
		t.Fatalf("un PNG real debe aceptarse: %v", err)
	}
	if ct != "image/png" {
		t.Errorf("tipo = %q, se esperaba image/png", ct)
	}
	if _, err := os.Stat(ip.getCachePath(url)); err != nil {
		t.Errorf("un PNG válido debe cachearse: %v", err)
	}
}

func serveProxyImage(t *testing.T, ip *ImageProxy, url string) *httptest.ResponseRecorder {
	t.Helper()
	e := echo.New()
	r := httptest.NewRequest(http.MethodGet, "/api/v1/image-proxy?url="+url, nil)
	rec := httptest.NewRecorder()
	if err := ip.ProxyImage(e.NewContext(r, rec)); err != nil {
		t.Fatal(err)
	}
	return rec
}

// Una caché escrita por una versión anterior (que no validaba) puede tener HTML
// adentro: no se sirve y se borra.
func TestProxyImageDescartaCacheEnvenenada(t *testing.T) {
	ip := &ImageProxy{CacheDir: t.TempDir()}
	const url = "http://127.0.0.1:1/x.html" // sin red: si llegara a pedirse, falla
	cachePath := ip.getCachePath(url)
	if err := os.WriteFile(cachePath, []byte("<html><script>alert(1)</script></html>"), 0o644); err != nil {
		t.Fatal(err)
	}

	rec := serveProxyImage(t, ip, url)

	if rec.Code == http.StatusOK || strings.Contains(rec.Body.String(), "<script>") {
		t.Fatalf("se sirvió contenido envenenado: %d %q", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(cachePath); err == nil {
		t.Error("la caché envenenada debe borrarse")
	}
}

func TestProxyImageDesdeCacheSirveElTipoRealYEndurece(t *testing.T) {
	ip := &ImageProxy{CacheDir: t.TempDir()}
	const url = "http://127.0.0.1:1/ok.png"
	if err := os.WriteFile(ip.getCachePath(url), pngBytes, 0o644); err != nil {
		t.Fatal(err)
	}

	rec := serveProxyImage(t, ip, url)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	h := rec.Header()
	if got := h.Get("Content-Type"); got != "image/png" {
		t.Errorf("Content-Type = %q", got)
	}
	if got := h.Get("X-Content-Type-Options"); got != "nosniff" {
		t.Errorf("X-Content-Type-Options = %q", got)
	}
	if got := h.Get("Content-Security-Policy"); !strings.Contains(got, "sandbox") {
		t.Errorf("Content-Security-Policy = %q", got)
	}
}

func TestProxyImageSirveDesdeMemoriaYPuedePurgarse(t *testing.T) {
	ip := &ImageProxy{CacheDir: t.TempDir()}
	const url = "http://127.0.0.1:1/ram.png"
	cachePath := ip.getCachePath(url)
	if err := os.WriteFile(cachePath, pngBytes, 0o644); err != nil {
		t.Fatal(err)
	}

	// Primera lectura carga disco en un open y puebla caché caliente en RAM.
	first := serveProxyImage(t, ip, url)
	if first.Code != http.StatusOK || first.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("primera lectura = %d (%q)", first.Code, first.Header().Get("Content-Type"))
	}

	// Incluso sin archivo en disco, la segunda lectura sale directo de RAM.
	if err := os.Remove(cachePath); err != nil {
		t.Fatal(err)
	}
	second := serveProxyImage(t, ip, url)
	if second.Code != http.StatusOK || second.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("lectura desde RAM = %d (%q)", second.Code, second.Header().Get("Content-Type"))
	}

	// Al purgar la RAM (ej. desde Ajustes), vuelve a intentar disco/red y ya no sirve el eliminado.
	ip.PurgeMemoryCache()
	third := serveProxyImage(t, ip, url)
	if third.Code == http.StatusOK {
		t.Fatalf("tras purgar memoria no debería seguir sirviendo un archivo borrado")
	}
}
