package videofile

import (
	"fmt"
	"strings"
)

// AudioRenditionName labels an HLS rendition by title or its one-based position.
// Undefined language tags from muxers are placeholders, not track titles.
func AudioRenditionName(title string, position int) string {
	name := strings.TrimSpace(title)
	base := strings.FieldsFunc(strings.ToLower(name), func(r rune) bool { return r == '-' || r == '_' })
	if name == "" || (len(base) > 0 && (base[0] == "und" || base[0] == "unknown")) {
		name = fmt.Sprintf("Audio %d", position+1)
	}
	return strings.NewReplacer(`"`, "'", "\r", " ", "\n", " ").Replace(name)
}
