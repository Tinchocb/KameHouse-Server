package util

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/rs/zerolog"
)

func TestAttachLogFileEscribeInfoYOmiteTrace(t *testing.T) {
	dir := t.TempDir()
	logger := NewLogger()

	// Antes de AttachLogFile solo hay consola: esta línea no debe aparecer en ningún archivo.
	logger.Info().Msg("antes-de-adjuntar")

	path, err := AttachLogFile(dir)
	if err != nil {
		t.Fatalf("AttachLogFile: %v", err)
	}
	t.Cleanup(func() {
		fileSink.mu.Lock()
		if fileSink.f != nil {
			_ = fileSink.f.Close()
			fileSink.f = nil
		}
		fileSink.mu.Unlock()
	})

	if filepath.Dir(path) != dir || !strings.HasPrefix(filepath.Base(path), "KameHouse-") || filepath.Ext(path) != ".log" {
		t.Fatalf("nombre de archivo inesperado: %s", path)
	}

	logger.Info().Msg("registro-info")
	logger.Trace().Msg("registro-trace")
	logger.Warn().Msg("registro-warn")

	fileSink.mu.Lock()
	_ = fileSink.f.Sync()
	fileSink.mu.Unlock()

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("leer archivo: %v", err)
	}
	content := string(raw)

	if !strings.Contains(content, "registro-info") || !strings.Contains(content, "registro-warn") {
		t.Errorf("faltan líneas INF/WRN en el archivo:\n%s", content)
	}
	if strings.Contains(content, "registro-trace") {
		t.Errorf("el archivo no debería incluir TRC:\n%s", content)
	}
	if strings.Contains(content, "antes-de-adjuntar") {
		t.Errorf("las líneas previas a AttachLogFile no deberían estar en el archivo:\n%s", content)
	}
	if strings.Contains(content, "\x1b[") {
		t.Errorf("el archivo no debería llevar códigos de color:\n%q", content)
	}
}

func TestLevelFilterWriterDescartaPorDebajoDelMinimo(t *testing.T) {
	var sink strings.Builder
	w := levelFilterWriter{min: zerolog.DebugLevel, w: &sink}

	if _, err := w.WriteLevel(zerolog.TraceLevel, []byte("trace\n")); err != nil {
		t.Fatal(err)
	}
	if _, err := w.WriteLevel(zerolog.DebugLevel, []byte("debug\n")); err != nil {
		t.Fatal(err)
	}
	if sink.String() != "debug\n" {
		t.Fatalf("salida inesperada: %q", sink.String())
	}
}
