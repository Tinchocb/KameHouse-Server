package drive

import (
	"context"
	"net/http"
	"testing"
)

type endlessErrorBody struct {
	bytes  int
	closed bool
}

func (b *endlessErrorBody) Read(p []byte) (int, error) {
	for i := range p {
		p[i] = 'x'
	}
	b.bytes += len(p)
	return len(p), nil
}
func (b *endlessErrorBody) Close() error { b.closed = true; return nil }

func TestGetFileLimitsAndClosesUpstreamErrorBody(t *testing.T) {
	body := &endlessErrorBody{}
	c := &Client{httpClient: &http.Client{Transport: reloadTransport(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusBadRequest, Header: make(http.Header), Body: body}, nil
	})}}
	if _, err := c.GetFile(context.Background(), "fixture"); err == nil {
		t.Fatal("upstream failure was accepted")
	}
	if body.bytes > 64<<10 || !body.closed {
		t.Fatalf("read %d bytes, closed=%v", body.bytes, body.closed)
	}
}
