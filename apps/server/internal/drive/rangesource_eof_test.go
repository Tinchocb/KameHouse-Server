package drive

import (
	"context"
	"errors"
	"io"
	"testing"
)

func TestRangeSourceReadAtReportsPartialEOF(t *testing.T) {
	f := &quotaDrive{data: []byte("0123456789"), maxRange: 100}
	s := NewRangeSource(f.fetch, 10)
	p := make([]byte, 5)
	n, err := s.ReadAt(context.Background(), p, 8)
	if n != 2 || !errors.Is(err, io.EOF) || string(p[:n]) != "89" {
		t.Fatalf("partial ReadAt=(%d,%v,%q), want (2,EOF,89)", n, err, p[:n])
	}
}

func TestRangeSourceReadAtExactBoundaryAndEmpty(t *testing.T) {
	f := &quotaDrive{data: []byte("0123456789"), maxRange: 100}
	s := NewRangeSource(f.fetch, 10)
	p := make([]byte, 2)
	if n, err := s.ReadAt(context.Background(), p, 8); n != 2 || err != nil {
		t.Fatalf("exact boundary: %d,%v", n, err)
	}
	if n, err := s.ReadAt(context.Background(), nil, 10); n != 0 || err != nil {
		t.Fatalf("empty read: %d,%v", n, err)
	}
	if n, err := s.ReadAt(context.Background(), p, 10); n != 0 || !errors.Is(err, io.EOF) {
		t.Fatalf("past boundary: %d,%v", n, err)
	}
}
