package models

import "strings"

// SecretMaskPrefix encabeza todo secreto enmascarado. Ninguna API key ni token
// real empieza con estos caracteres, así que un valor que llega con este
// prefijo es el mismo enmascarado que devolvió el servidor, no uno nuevo.
const SecretMaskPrefix = "••••••••"

// MaskSecret devuelve el secreto oculto dejando visibles los últimos 4
// caracteres, para que la UI muestre que hay una clave y cuál es.
func MaskSecret(s string) string {
	if s == "" {
		return ""
	}
	r := []rune(s)
	if len(r) <= 8 {
		return SecretMaskPrefix
	}
	return SecretMaskPrefix + string(r[len(r)-4:])
}

// IsMaskedSecret indica si el valor es un secreto enmascarado que volvió del
// cliente (el formulario reenvía lo que recibió): hay que conservar el guardado.
func IsMaskedSecret(s string) bool {
	return strings.HasPrefix(s, SecretMaskPrefix)
}

// Redacted devuelve una copia con la API key de TMDB y las credenciales de
// Drive enmascaradas, para todo lo que sale hacia un cliente (HTTP y WS).
// GetSettings devuelve el puntero cacheado compartido: nunca se modifica.
func (s *Settings) Redacted() *Settings {
	if s == nil {
		return nil
	}
	c := *s
	c.Library.TmdbApiKey = MaskSecret(c.Library.TmdbApiKey)
	c.GoogleDrive.ClientSecret = MaskSecret(c.GoogleDrive.ClientSecret)
	c.GoogleDrive.RefreshToken = MaskSecret(c.GoogleDrive.RefreshToken)
	return &c
}
