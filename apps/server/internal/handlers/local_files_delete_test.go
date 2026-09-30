package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"kamehouse/internal/database/models"

	"github.com/labstack/echo/v4"
)

// deleteLocalFiles llama a DELETE /library/local-files con una biblioteca en libDir.
func deleteLocalFiles(t *testing.T, libDir string, paths []string) int {
	t.Helper()
	app, _ := setupTestApp(t)
	if _, err := app.Database.UpsertSettings(&models.Settings{
		BaseModel: models.BaseModel{ID: 1},
		Library:   models.LibrarySettings{SeriesPaths: []string{libDir}},
	}); err != nil {
		t.Fatalf("no se pudieron guardar los ajustes: %v", err)
	}
	h := &Handler{App: app}

	body, _ := json.Marshal(map[string]any{"paths": paths})
	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/library/local-files", strings.NewReader(string(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	if err := h.HandleDeleteLocalFiles(c); err != nil {
		e.HTTPErrorHandler(err, c)
	}
	return rec.Code
}

func writeFile(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("video"), 0o644); err != nil {
		t.Fatal(err)
	}
}

func exists(path string) bool { _, err := os.Lstat(path); return err == nil }

func TestDeleteLocalFilesBorraDentroDeLaBiblioteca(t *testing.T) {
	lib := t.TempDir()
	f := filepath.Join(lib, "Serie", "ep1.mkv")
	writeFile(t, f)

	if code := deleteLocalFiles(t, lib, []string{f}); code != http.StatusOK {
		t.Fatalf("status = %d, se esperaba 200", code)
	}
	if exists(f) {
		t.Error("el archivo de la biblioteca debía borrarse")
	}
}

func TestDeleteLocalFilesNoTocaLoQueEstaFuera(t *testing.T) {
	lib := t.TempDir()
	outside := filepath.Join(t.TempDir(), "importante.txt")
	writeFile(t, outside)

	cases := map[string][]string{
		"archivo fuera de la biblioteca": {outside},
		"con ..":                         {filepath.Join(lib, "..", filepath.Base(filepath.Dir(outside)), "importante.txt")},
		"junto con uno válido":           {filepath.Join(lib, "ok.mkv"), outside},
	}
	writeFile(t, filepath.Join(lib, "ok.mkv"))

	for name, paths := range cases {
		t.Run(name, func(t *testing.T) {
			if code := deleteLocalFiles(t, lib, paths); code != http.StatusForbidden {
				t.Errorf("status = %d, se esperaba 403", code)
			}
			if !exists(outside) {
				t.Fatal("se borró un archivo fuera de la biblioteca")
			}
			// La validación es previa a cualquier borrado: nada se toca si una ruta falla.
			if !exists(filepath.Join(lib, "ok.mkv")) {
				t.Error("se borró un archivo válido aunque otra ruta del pedido era inválida")
			}
		})
	}
}

func TestDeleteLocalFilesNoBorraCarpetas(t *testing.T) {
	lib := t.TempDir()
	sub := filepath.Join(lib, "Serie")
	if err := os.MkdirAll(sub, 0o755); err != nil {
		t.Fatal(err)
	}

	if code := deleteLocalFiles(t, lib, []string{lib}); code != http.StatusForbidden {
		t.Errorf("la carpeta de la biblioteca: status = %d, se esperaba 403", code)
	}
	if !exists(lib) {
		t.Fatal("se borró la carpeta de la biblioteca")
	}
	if code := deleteLocalFiles(t, lib, []string{sub}); code != http.StatusBadRequest {
		t.Errorf("una subcarpeta: status = %d, se esperaba 400", code)
	}
	if !exists(sub) {
		t.Error("se borró una subcarpeta (vacía)")
	}
}

func TestDeleteLocalFilesRechazaRutasVacias(t *testing.T) {
	lib := t.TempDir()
	for _, p := range []string{"", "   "} {
		if code := deleteLocalFiles(t, lib, []string{p}); code != http.StatusBadRequest {
			t.Errorf("ruta %q: status = %d, se esperaba 400", p, code)
		}
	}
}

// Un enlace simbólico dentro de la biblioteca que apunta afuera no debe servir
// para borrar el archivo real de afuera.
func TestDeleteLocalFilesNoSigueEnlacesFueraDeLaBiblioteca(t *testing.T) {
	lib := t.TempDir()
	outsideDir := t.TempDir()
	victim := filepath.Join(outsideDir, "documento.txt")
	writeFile(t, victim)

	link := filepath.Join(lib, "enlace")
	if err := os.Symlink(outsideDir, link); err != nil {
		t.Skipf("no se pueden crear enlaces simbólicos en este equipo: %v", err)
	}

	if code := deleteLocalFiles(t, lib, []string{filepath.Join(link, "documento.txt")}); code != http.StatusForbidden {
		t.Errorf("status = %d, se esperaba 403", code)
	}
	if !exists(victim) {
		t.Fatal("se borró un archivo fuera de la biblioteca a través de un enlace simbólico")
	}
}
