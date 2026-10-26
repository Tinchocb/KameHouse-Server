package util

import (
	"net/http"
	"testing"
)

func TestSafeImageContentType(t *testing.T) {
	png := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")
	jpeg := []byte("\xff\xd8\xff\xe0\x00\x10JFIF")
	gif := []byte("GIF89a\x01\x00\x01\x00")
	webp := []byte("RIFF\x24\x00\x00\x00WEBPVP8 ")
	avif := []byte("\x00\x00\x00\x1cftypavif\x00\x00\x00\x00avifmif1")
	heic := []byte("\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic")

	cases := []struct {
		name     string
		declared string
		body     []byte
		want     string
	}{
		{"png", "image/png", png, "image/png"},
		{"jpeg", "image/jpeg", jpeg, "image/jpeg"},
		{"gif", "image/gif", gif, "image/gif"},
		{"webp", "image/webp", webp, "image/webp"},
		{"avif declarado y con caja ftyp", "image/avif", avif, "image/avif"},
		{"manda el contenido, no lo declarado", "text/html", png, "image/png"},
		{"jpeg declarado como png sirve el real", "image/png", jpeg, "image/jpeg"},

		{"HTML declarado como imagen", "image/jpeg", []byte("<html><script>alert(1)</script></html>"), ""},
		{"HTML con espacios al inicio", "image/png", []byte("  \n<!DOCTYPE html><script>x</script>"), ""},
		{"SVG con script", "image/svg+xml", []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`), ""},
		{"SVG declarado como png", "image/png", []byte(`<?xml version="1.0"?><svg onload="alert(1)"/>`), ""},
		{"JavaScript", "image/gif", []byte("alert(document.domain)"), ""},
		{"texto plano", "image/png", []byte("hola"), ""},
		{"vacío", "image/png", nil, ""},
		{"avif declarado sin caja ftyp", "image/avif", []byte("<html>"), ""},
		{"heic declarado avif", "image/avif", heic, ""},
		{"octet-stream sin declarar avif", "application/octet-stream", avif, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := SafeImageContentType(tc.declared, tc.body); got != tc.want {
				t.Errorf("SafeImageContentType(%q) = %q, want %q", tc.declared, got, tc.want)
			}
		})
	}
}

func TestHardenProxyResponse(t *testing.T) {
	h := http.Header{}
	HardenProxyResponse(h)
	if h.Get("X-Content-Type-Options") != "nosniff" {
		t.Error("falta X-Content-Type-Options: nosniff")
	}
	if csp := h.Get("Content-Security-Policy"); csp != "default-src 'none'; sandbox" {
		t.Errorf("CSP inesperada: %q", csp)
	}
}
