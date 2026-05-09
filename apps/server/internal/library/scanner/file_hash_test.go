package scanner

import (
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestCalculateOpenSubtitlesHashSmallFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sample.mkv")
	content := []byte{
		0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	}
	if err := os.WriteFile(path, content, 0o600); err != nil {
		t.Fatal(err)
	}

	expected := uint64(len(content))
	expected += binary.LittleEndian.Uint64(content[:8])
	expected += binary.LittleEndian.Uint64(content[8:16])

	got, err := CalculateOpenSubtitlesHash(path)
	if err != nil {
		t.Fatal(err)
	}
	if got != fmt.Sprintf("%016x", expected) {
		t.Fatalf("expected %016x, got %s", expected, got)
	}
}
