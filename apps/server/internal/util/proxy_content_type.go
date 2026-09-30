package util

import (
	"mime"
	"net/http"
	"strings"
)

// Los proxies (VideoProxy e ImageProxy) sirven contenido de un origen remoto
// bajo el origen de la propia app. Si reenviaran el Content-Type tal cual, un
// enlace a /api/v1/image-proxy?url=https://sitio-malo/x.html ejecutaría esa
// página con el mismo origen que la interfaz y podría llamar a la API con los
// privilegios de localhost. Estas funciones deciden el tipo que se sirve.

// rasterImageTypes son los formatos que se reconocen por sus bytes. SVG queda
// afuera a propósito: abierto directamente ejecuta scripts.
var rasterImageTypes = map[string]bool{
	"image/jpeg":               true,
	"image/png":                true,
	"image/gif":                true,
	"image/webp":               true,
	"image/bmp":                true,
	"image/x-icon":             true,
	"image/vnd.microsoft.icon": true,
	"image/avif":               true,
}

// SafeImageContentType devuelve el tipo con el que se puede servir una imagen,
// o "" si el contenido no es una imagen ráster. Manda el contenido, no lo que
// declare el origen: el tipo declarado solo desempata AVIF, que Go no detecta.
func SafeImageContentType(declared string, body []byte) string {
	sniffed := http.DetectContentType(body)
	if i := strings.Index(sniffed, ";"); i >= 0 {
		sniffed = sniffed[:i]
	}
	if rasterImageTypes[sniffed] {
		return sniffed
	}
	if sniffed == "application/octet-stream" && mediaTypeOf(declared) == "image/avif" && isAVIF(body) {
		return "image/avif"
	}
	return ""
}

// isAVIF reconoce la caja ftyp de un AVIF (bytes 4-8 "ftyp", marca "avif"/"avis").
func isAVIF(b []byte) bool {
	if len(b) < 12 || string(b[4:8]) != "ftyp" {
		return false
	}
	brand := string(b[8:12])
	return brand == "avif" || brand == "avis"
}

// proxyMediaTypes son los tipos exactos permitidos además de video/*, audio/* e
// image/* (menos SVG). Ninguno se ejecuta en el navegador al abrirse.
var proxyMediaTypes = map[string]bool{
	"application/vnd.apple.mpegurl": true,
	"application/x-mpegurl":         true,
	"application/mpegurl":           true,
	"application/dash+xml":          true,
	"application/octet-stream":      true,
	"binary/octet-stream":           true,
	"application/mp4":               true,
	"application/ogg":               true,
	"text/vtt":                      true,
	"text/plain":                    true,
}

// SafeProxyContentType devuelve el Content-Type declarado si es de medios, o
// application/octet-stream si podría interpretarse como página (HTML, SVG,
// XML, JavaScript...). Un tipo ausente o ilegible también cae a octet-stream.
func SafeProxyContentType(declared string) string {
	mt := mediaTypeOf(declared)
	switch {
	case mt == "":
		return "application/octet-stream"
	case mt == "image/svg+xml":
		return "application/octet-stream"
	case strings.HasPrefix(mt, "video/"), strings.HasPrefix(mt, "audio/"), strings.HasPrefix(mt, "image/"):
		return declared
	case proxyMediaTypes[mt]:
		return declared
	}
	return "application/octet-stream"
}

// HardenProxyResponse añade las cabeceras que impiden que el navegador
// reinterprete o ejecute lo que devolvió el proxy.
func HardenProxyResponse(h http.Header) {
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Content-Security-Policy", "default-src 'none'; sandbox")
}

func mediaTypeOf(contentType string) string {
	mt, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		return ""
	}
	return strings.ToLower(mt)
}
