package util

import (
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"

	"github.com/imroc/req/v3"
)

func TestPrewarmBajaUnaVezOmiteCacheadasYNoGuardaErrores(t *testing.T) {
	old := prewarmURLValid
	prewarmURLValid = func(string) bool { return true }
	defer func() { prewarmURLValid = old }()
	// El cliente real rechaza loopback al conectar (SSRF); el origen de prueba
	// vive en 127.0.0.1.
	oldClient := imageProxyClient
	imageProxyClient = req.C()
	defer func() { imageProxyClient = oldClient }()

	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		if r.URL.Path == "/missing.jpg" {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "image/jpeg")
		_, _ = w.Write([]byte("\xff\xd8\xff fake jpeg"))
	}))
	defer srv.Close()

	ip := &ImageProxy{CacheDir: t.TempDir()}
	urls := []string{srv.URL + "/a.jpg", srv.URL + "/b.jpg", srv.URL + "/a.jpg", srv.URL + "/missing.jpg", ""}

	if n := ip.Prewarm(urls, 2); n != 2 {
		t.Fatalf("descargadas = %d, se esperaban 2", n)
	}
	if hits.Load() != 3 { // a, b y el 404 (a repetida no se pide dos veces)
		t.Fatalf("pedidos al origen = %d, se esperaban 3", hits.Load())
	}
	if _, err := os.Stat(ip.getCachePath(srv.URL + "/missing.jpg")); err == nil {
		t.Fatal("un 404 no debe quedar cacheado como imagen")
	}

	// Segunda pasada: todo lo válido ya está en disco.
	hits.Store(0)
	if n := ip.Prewarm(urls, 2); n != 0 {
		t.Fatalf("segunda pasada descargó %d, se esperaban 0", n)
	}
	if hits.Load() != 1 { // solo reintenta el que falló
		t.Fatalf("segunda pasada: pedidos = %d, se esperaba 1 (el 404)", hits.Load())
	}
}
