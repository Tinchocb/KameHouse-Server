package matroska

import (
	"bytes"
	"math"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMetadataSectionsRejectUnboundedAllocation(t *testing.T) {
	parser := &MatroskaParser{reader: NewEBMLReader(bytes.NewReader(nil))}
	for name, parse := range map[string]func(uint64) error{
		"info": parser.parseSegmentInfo, "seek": parser.parseSeekHead,
		"tracks": parser.parseTracks, "cues": parser.parseCues,
		"chapters": parser.parseChapters, "tags": parser.parseTags,
		"attachments": parser.parseAttachments,
	} {
		t.Run(name, func(t *testing.T) {
			require.NotPanics(t, func() { require.Error(t, parse(math.MaxUint64)) })
		})
	}
}
