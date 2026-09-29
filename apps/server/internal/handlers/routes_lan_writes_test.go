package handlers

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

var (
	groupDeclRe = regexp.MustCompile(`(\w+)\s*:=\s*(\w+)\.Group\("([^"]*)"`)
	routeDeclRe = regexp.MustCompile(`(\w+)\.(GET|POST|PUT|PATCH|DELETE)\("([^"]*)"`)
)

// registeredRoutes lee routes*.go y devuelve "MÉTODO /ruta/completa" para cada
// ruta declarada, resolviendo los prefijos de los grupos (v1.Group("/drive")...).
// Evita levantar toda la app: InitRoutes necesita base de datos, eventos y WS.
func registeredRoutes(t *testing.T) []string {
	t.Helper()
	files, err := filepath.Glob("routes*.go")
	if err != nil || len(files) == 0 {
		t.Fatalf("no se encontraron archivos de rutas: %v", err)
	}
	var out []string
	for _, f := range files {
		if strings.HasSuffix(f, "_test.go") {
			continue
		}
		src, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		text := string(src)
		prefixes := map[string]string{"v1": "/api/v1"} // v1 llega como parámetro en los archivos secundarios
		for _, m := range groupDeclRe.FindAllStringSubmatch(text, -1) {
			name, parent, p := m[1], m[2], m[3]
			base, ok := prefixes[parent]
			if !ok {
				if parent == "e" {
					base = ""
				} else {
					t.Fatalf("%s: grupo %q con padre desconocido %q", f, name, parent)
				}
			}
			prefixes[name] = base + p
		}
		for _, m := range routeDeclRe.FindAllStringSubmatch(text, -1) {
			base, ok := prefixes[m[1]]
			if !ok {
				continue // e.GET("/api/health"...) y similares fuera de un grupo
			}
			out = append(out, m[2]+" "+base+m[3])
		}
	}
	sort.Strings(out)
	return out
}

// Cada entrada de lanWriteRoutes debe apuntar a una ruta de escritura real: un
// error de tipeo o una ruta renombrada dejaría a los clientes de la LAN
// bloqueados sin ningún aviso.
func TestLANWriteRoutesExist(t *testing.T) {
	routes := registeredRoutes(t)
	if len(routes) < 50 {
		t.Fatalf("el lector de rutas encontró solo %d; revisar las expresiones regulares", len(routes))
	}
	writePaths := map[string]bool{}
	for _, r := range routes {
		method, path, _ := strings.Cut(r, " ")
		if method != "GET" {
			writePaths[path] = true
		}
	}
	for p := range lanWriteRoutes {
		if !writePaths[p] {
			t.Errorf("lanWriteRoutes[%q] no coincide con ninguna ruta de escritura registrada", p)
		}
	}
}
