package mediastream

import (
	"net/url"
	"regexp"
	"strings"
)

// uriAttrRe captura el atributo URI="..." de etiquetas como #EXT-X-MEDIA.
var uriAttrRe = regexp.MustCompile(`URI="([^"]*)"`)

// withClientID agrega clientId a cada URI relativa de una lista HLS. Los índices, las pistas de
// audio y los segmentos llegan sin más contexto que su ruta: sin el id el servidor cae al
// contenedor "actual" global, y dos reproducciones a la vez se servían el archivo una de la otra.
// Las URL absolutas no son de este servidor y se dejan como están.
func withClientID(playlist, clientID string) string {
	if clientID == "" {
		return playlist
	}
	param := "clientId=" + url.QueryEscape(clientID)

	// Una sola pasada escribiendo en un Builder del tamaño estimado: antes se partía la lista en
	// un []string, se corría la regexp en CADA etiqueta (#EXTINF incluidas, con 2 asignaciones
	// aunque no hubiera URI) y cada segmento hacía una concatenación nueva.
	var sb strings.Builder
	sb.Grow(len(playlist) + (strings.Count(playlist, "\n")/2+1)*(len(param)+1))
	for rest := playlist; ; {
		line, tail, more := strings.Cut(rest, "\n")
		body, cr := line, ""
		if strings.HasSuffix(body, "\r") {
			body, cr = body[:len(body)-1], "\r"
		}
		sep := byte(0) // separador del parámetro a sumar tras el cuerpo; 0 = nada
		switch {
		case body == "":
		case body[0] == '#':
			if strings.Contains(body, `URI="`) {
				body = uriAttrRe.ReplaceAllStringFunc(body, func(attr string) string {
					inner := attr[5 : len(attr)-1] // URI="<inner>"
					if inner == "" || strings.Contains(inner, "://") {
						return attr
					}
					return `URI="` + appendClientParam(inner, param) + `"`
				})
			}
		case strings.Contains(body, "://"):
		default:
			if !strings.Contains(body, "clientId=") {
				sep = '?'
				if strings.Contains(body, "?") {
					sep = '&'
				}
			}
		}
		sb.WriteString(body)
		if sep != 0 {
			sb.WriteByte(sep)
			sb.WriteString(param)
		}
		sb.WriteString(cr)
		if !more {
			break
		}
		sb.WriteByte('\n')
		rest = tail
	}
	return sb.String()
}

// appendClientParam suma el parámetro a una URI, sin repetirlo si ya está.
func appendClientParam(uri, param string) string {
	if strings.Contains(uri, "clientId=") {
		return uri
	}
	if strings.Contains(uri, "?") {
		return uri + "&" + param
	}
	return uri + "?" + param
}
