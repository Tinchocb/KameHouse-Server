package httprange

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func newServer(t *testing.T, data []byte) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeContent(w, r, "file.mkv", time.Time{}, bytes.NewReader(data))
	}))
}

func payload(n int) []byte {
	b := make([]byte, n)
	for i := range b {
		b[i] = byte(i % 251)
	}
	return b
}

func TestReaderReadsWholeResource(t *testing.T) {
	data := payload(defaultChunkSize*3 + 1234)
	srv := newServer(t, data)
	defer srv.Close()

	r, err := Open(context.Background(), srv.Client(), srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	if r.Size() != int64(len(data)) {
		t.Fatalf("size = %d, want %d", r.Size(), len(data))
	}
	got, err := io.ReadAll(r)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, data) {
		t.Fatal("el contenido leído no coincide")
	}
}

func TestReaderSeekReadsOnlyNeededChunks(t *testing.T) {
	data := payload(defaultChunkSize * 40)
	srv := newServer(t, data)
	defer srv.Close()

	r, err := Open(context.Background(), srv.Client(), srv.URL)
	if err != nil {
		t.Fatal(err)
	}

	// Leer 16 bytes cerca del final (como al saltar a los Cues del MKV).
	if _, err := r.Seek(-100, io.SeekEnd); err != nil {
		t.Fatal(err)
	}
	buf := make([]byte, 16)
	if _, err := io.ReadFull(r, buf); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(buf, data[len(data)-100:len(data)-84]) {
		t.Fatal("bytes incorrectos tras Seek desde el final")
	}

	// Volver al inicio y releer: cada bloque se pide una sola vez.
	if _, err := r.Seek(10, io.SeekStart); err != nil {
		t.Fatal(err)
	}
	if _, err := io.ReadFull(r, buf); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Seek(10, io.SeekStart); err != nil {
		t.Fatal(err)
	}
	if _, err := io.ReadFull(r, buf); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(buf, data[10:26]) {
		t.Fatal("bytes incorrectos al inicio")
	}
	if r.Requests != 2 {
		t.Fatalf("requests = %d, want 2 (un bloque al final y uno al inicio)", r.Requests)
	}
}

func TestReaderRejectsServerWithoutRange(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		_, _ = w.Write([]byte("sin soporte de rangos"))
	}))
	defer srv.Close()

	if _, err := Open(context.Background(), srv.Client(), srv.URL); err == nil {
		t.Fatal("se esperaba error si el servidor no soporta Range")
	}
}

func TestParseContentRangeTotal(t *testing.T) {
	if n, err := parseContentRangeTotal("bytes 0-0/12345"); err != nil || n != 12345 {
		t.Fatalf("got %d, %v", n, err)
	}
	if _, err := parseContentRangeTotal("bytes 0-0/*"); err == nil {
		t.Fatal("se esperaba error con total desconocido")
	}
}
