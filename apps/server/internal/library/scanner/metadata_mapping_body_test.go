package scanner

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type mappingBodyProbe struct {
	io.Reader
	closed bool
}

func (b *mappingBodyProbe) Close() error { b.closed = true; return nil }

type mappingErrorReader struct{ err error }

func (r mappingErrorReader) Read([]byte) (int, error) { return 0, r.err }

func TestMappingBodyLimitAndClosure(t *testing.T) {
	readFailure := errors.New("upstream read failed")
	for _, tc := range []struct {
		name    string
		reader  io.Reader
		wantLen int
		wantErr bool
	}{
		{"at limit", strings.NewReader(strings.Repeat("x", 1<<20)), 1 << 20, false},
		{"over limit", strings.NewReader(strings.Repeat("x", (1<<20)+1)), 0, true},
		{"read failure", mappingErrorReader{readFailure}, 0, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := &mappingBodyProbe{Reader: tc.reader}
			data, err := readBody(&http.Response{Body: body})
			if (err != nil) != tc.wantErr || len(data) != tc.wantLen {
				t.Fatalf("got %d bytes, err=%v", len(data), err)
			}
			if !body.closed {
				t.Fatal("response body was not closed")
			}
			if tc.name == "read failure" && !errors.Is(err, readFailure) {
				t.Fatalf("read failure lost: %v", err)
			}
		})
	}
	for _, response := range []*http.Response{nil, {}} {
		if _, err := readBody(response); err == nil {
			t.Fatal("missing body accepted")
		}
	}
}
