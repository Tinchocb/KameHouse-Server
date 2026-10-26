package handlers

import (
	"strings"
	"testing"

	"kamehouse/internal/core"
)

// Los episodios de Drive se huellan y se prueban por la URL interna de loopback: el resolver
// tiene que mandar gdrive:// ahí y dejar intactas las rutas locales.
func TestDriveInputURLResolvesGdriveToLoopback(t *testing.T) {
	cfg := &core.Config{}
	cfg.Server.Host = "127.0.0.1"
	cfg.Server.Port = 43212
	h := &Handler{App: &core.App{CoreServices: core.CoreServices{Config: cfg}}}

	got := h.driveInputURL("gdrive://FILE123/Serie/ep01.mkv")
	for _, want := range []string{
		"http://127.0.0.1:43212" + drivePlayPath + "?",
		"fileId=FILE123",
		"ext=.mkv",
		"internal=",
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("driveInputURL = %q, falta %q", got, want)
		}
	}

	const local = "/media/ep01.mkv"
	if out := h.driveInputURL(local); out != local {
		t.Fatalf("una ruta local debe quedar igual: %q", out)
	}
}
