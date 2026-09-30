package library_explorer

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"

	"kamehouse/internal/database/models/dto"

	"github.com/rs/zerolog"
)

func newTestExplorer() *LibraryExplorer {
	l := zerolog.Nop()
	return &LibraryExplorer{logger: &l}
}

func writeVideo(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func readFile(t *testing.T, path string) string {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("no se pudo leer %s: %v", path, err)
	}
	return string(b)
}

// rename ejecuta superUpdateFile y devuelve el error y el registro resultante.
func rename(t *testing.T, lib, from, newName string) (error, *dto.LocalFile) {
	t.Helper()
	lf := dto.NewLocalFileS(from, []string{lib})
	var mu sync.Mutex
	err := newTestExplorer().superUpdateFile(
		&SuperUpdateFileOptions{Path: from, NewName: newName},
		[]*dto.LocalFile{lf}, &mu, 1, []string{lib},
	)
	return err, lf
}

func TestSuperUpdateRenombraElArchivoYElRegistro(t *testing.T) {
	lib := t.TempDir()
	from := filepath.Join(lib, "Serie", "ep1.mkv")
	writeVideo(t, from, "uno")

	err, lf := rename(t, lib, from, "episodio-1.mkv")
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	to := filepath.Join(lib, "Serie", "episodio-1.mkv")
	if readFile(t, to) != "uno" {
		t.Error("el archivo renombrado debe conservar su contenido")
	}
	if _, statErr := os.Stat(from); statErr == nil {
		t.Error("el nombre viejo no debe seguir existiendo")
	}
	if !lf.HasSamePath(to) || lf.Name != "episodio-1.mkv" {
		t.Errorf("el registro no se actualizó: path=%q name=%q", lf.Path, lf.Name)
	}
}

// Renombrar a un nombre ya usado destruía el otro archivo (os.Rename reemplaza).
func TestSuperUpdateNoPisaUnArchivoExistente(t *testing.T) {
	lib := t.TempDir()
	from := filepath.Join(lib, "Serie", "ep1.mkv")
	other := filepath.Join(lib, "Serie", "ep2.mkv")
	writeVideo(t, from, "uno")
	writeVideo(t, other, "dos")

	err, lf := rename(t, lib, from, "ep2.mkv")

	if err == nil || !strings.Contains(err.Error(), "already exists") {
		t.Fatalf("se esperaba el error de destino existente, obtuve: %v", err)
	}
	if readFile(t, other) != "dos" {
		t.Fatal("se pisó el archivo de destino")
	}
	if readFile(t, from) != "uno" {
		t.Error("el archivo de origen debe quedar intacto")
	}
	if !lf.HasSamePath(from) {
		t.Errorf("el registro no debe cambiar si el renombrado se rechaza: %q", lf.Path)
	}
}

// Si el renombrado real falla, el registro no debe quedar apuntando a la ruta nueva.
func TestSuperUpdateNoTocaElRegistroSiFallaElRenombrado(t *testing.T) {
	lib := t.TempDir()
	missing := filepath.Join(lib, "Serie", "no-existe.mkv")

	err, lf := rename(t, lib, missing, "nuevo.mkv")

	if err == nil {
		t.Fatal("renombrar un archivo inexistente debe fallar")
	}
	if !lf.HasSamePath(missing) {
		t.Errorf("el registro quedó apuntando a una ruta inexistente: %q", lf.Path)
	}
}

func TestSuperUpdatePermiteCambiarSoloMayusculas(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("en sistemas sensibles a mayúsculas 'EP1.mkv' y 'ep1.mkv' son archivos distintos")
	}
	lib := t.TempDir()
	from := filepath.Join(lib, "Serie", "ep1.mkv")
	writeVideo(t, from, "uno")

	if err, _ := rename(t, lib, from, "EP1.mkv"); err != nil {
		t.Fatalf("un cambio solo de mayúsculas debe permitirse: %v", err)
	}
	entries, _ := os.ReadDir(filepath.Join(lib, "Serie"))
	if len(entries) != 1 || entries[0].Name() != "EP1.mkv" {
		t.Errorf("el nombre no cambió: %v", entries)
	}
}

func TestSuperUpdateNoSaleDeLaBiblioteca(t *testing.T) {
	lib := t.TempDir()
	from := filepath.Join(lib, "Serie", "ep1.mkv")
	writeVideo(t, from, "uno")

	// filepath.Base descarta cualquier ruta del nombre nuevo: no se puede mover afuera.
	err, _ := rename(t, lib, from, filepath.Join("..", "..", "afuera.mkv"))
	if err != nil {
		t.Fatalf("error inesperado: %v", err)
	}
	if _, statErr := os.Stat(filepath.Join(lib, "Serie", "afuera.mkv")); statErr != nil {
		t.Error("con un nombre con .., el archivo debe quedar en su misma carpeta")
	}
	if _, statErr := os.Stat(filepath.Join(filepath.Dir(lib), "afuera.mkv")); statErr == nil {
		t.Fatal("el archivo salió de la biblioteca")
	}
}

func TestSuperUpdateRechazaArchivosFueraDeLaBiblioteca(t *testing.T) {
	lib := t.TempDir()
	outside := filepath.Join(t.TempDir(), "ajeno.txt")
	writeVideo(t, outside, "ajeno")

	err, _ := rename(t, lib, outside, "otro.txt")

	if err == nil || !strings.Contains(err.Error(), "unauthorized") {
		t.Fatalf("se esperaba 'unauthorized', obtuve: %v", err)
	}
	if readFile(t, outside) != "ajeno" {
		t.Error("el archivo ajeno debe quedar intacto")
	}
}
