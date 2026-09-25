package videofile

import (
	"crypto/sha1"
	"encoding/hex"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

// Parámetros de query que autentican una URL pero no identifican el recurso.
// Se excluyen del hash: si no, la misma fuente remota (p. ej. un archivo de
// Drive servido por loopback) tendría un hash distinto por cada token y se
// perdería la caché de media info y keyframes.
var volatileURLParams = []string{"token", "internal"}

func isRemotePath(path string) bool {
	return strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://")
}

func GetHashFromPath(path string) (string, error) {
	if isRemotePath(path) {
		h := sha1.New()
		h.Write([]byte(stableURL(path)))
		return hex.EncodeToString(h.Sum(nil)), nil
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	h := sha1.New()
	h.Write([]byte(path))
	h.Write([]byte(info.ModTime().String()))
	sha := hex.EncodeToString(h.Sum(nil))
	return sha, nil
}

// stableURL devuelve la URL sin los parámetros de autenticación.
func stableURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	q := u.Query()
	for _, p := range volatileURLParams {
		q.Del(p)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

// PathExt devuelve la extensión (con punto, en minúsculas) de una ruta local o de
// una URL. En una URL la ruta no suele tener extensión (p. ej. /api/v1/drive/play),
// así que se respeta el parámetro `ext` si viene; si no, se usa la de la ruta.
func PathExt(path string) string {
	if isRemotePath(path) {
		u, err := url.Parse(path)
		if err != nil {
			return ""
		}
		if ext := u.Query().Get("ext"); ext != "" {
			if !strings.HasPrefix(ext, ".") {
				ext = "." + ext
			}
			return strings.ToLower(ext)
		}
		return strings.ToLower(filepath.Ext(u.Path))
	}
	return strings.ToLower(filepath.Ext(path))
}
