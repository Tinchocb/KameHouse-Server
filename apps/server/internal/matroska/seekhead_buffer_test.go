package matroska

import (
	"bytes"
	"testing"
)

func writeElement(buf *bytes.Buffer, id []byte, data []byte) {
	buf.Write(id)
	buf.Write(vintEncode(uint64(len(data))))
	buf.Write(data)
}

// buildFileWithSeekHead arma un MKV con la estructura típica de mkvmerge:
// SeekHead (apuntando a los Cues) + Tracks + relleno grande + Cues.
func buildFileWithSeekHead(t *testing.T, padding int) (file []byte, cuesOffset int64) {
	t.Helper()

	trackEntry, err := createMockTrackEntry(1, TypeVideo, "V_MPEGH/ISO/HEVC", "Video", "und")
	if err != nil {
		t.Fatal(err)
	}
	tracks := new(bytes.Buffer)
	writeElement(tracks, []byte{0xAE}, trackEntry)

	trackPos := new(bytes.Buffer)
	writeElement(trackPos, []byte{0xF7}, []byte{0x01})       // CueTrack
	writeElement(trackPos, []byte{0xF1}, []byte{0x10, 0x00}) // CueClusterPosition
	cuePoint := new(bytes.Buffer)
	writeElement(cuePoint, []byte{0xB3}, []byte{0x00}) // CueTime
	writeElement(cuePoint, []byte{0xB7}, trackPos.Bytes())
	cues := new(bytes.Buffer)
	writeElement(cues, []byte{0xBB}, cuePoint.Bytes())

	// SeekHead de tamaño fijo: la posición de los Cues ocupa 4 bytes, así el
	// largo del SeekHead no depende del valor que se calcula después.
	buildSeekHead := func(cuesRel uint32) []byte {
		seek := new(bytes.Buffer)
		writeElement(seek, []byte{0x53, 0xAB}, []byte{0x1C, 0x53, 0xBB, 0x6B})
		writeElement(seek, []byte{0x53, 0xAC}, []byte{byte(cuesRel >> 24), byte(cuesRel >> 16), byte(cuesRel >> 8), byte(cuesRel)})
		sh := new(bytes.Buffer)
		writeElement(sh, []byte{0x4D, 0xBB}, seek.Bytes())
		out := new(bytes.Buffer)
		writeElement(out, []byte{0x11, 0x4D, 0x9B, 0x74}, sh.Bytes())
		return out.Bytes()
	}

	tail := new(bytes.Buffer)
	writeElement(tail, []byte{0x16, 0x54, 0xAE, 0x6B}, tracks.Bytes())
	writeElement(tail, []byte{0xEC}, make([]byte, padding)) // Void
	cuesRel := uint32(len(buildSeekHead(0)) + tail.Len())
	writeElement(tail, []byte{0x1C, 0x53, 0xBB, 0x6B}, cues.Bytes())

	segment := new(bytes.Buffer)
	segment.Write(buildSeekHead(cuesRel))
	segment.Write(tail.Bytes())

	out := new(bytes.Buffer)
	writeElement(out, []byte{0x1A, 0x45, 0xDF, 0xA3}, []byte{0x42, 0x82, 0x88, 'm', 'a', 't', 'r', 'o', 's', 'k', 'a'})
	out.Write([]byte{0x18, 0x53, 0x80, 0x67})
	out.Write(vintEncode(uint64(segment.Len())))
	segmentStart := int64(out.Len())
	out.Write(segment.Bytes())
	return out.Bytes(), segmentStart + int64(cuesRel)
}

// Regresión: parseSeekHead leía de mp.reader.r salteando el bufio, que ya
// había adelantado hasta 64 KB. El SeekHead se decodificaba con bytes de otra
// posición, la apertura caía al modo "solo clusters" sin pistas y los keyframes
// terminaban saliendo de ffprobe (o de cientos de pedidos a Drive).
func TestSeekHeadReadsThroughBuffer(t *testing.T) {
	for _, padding := range []int{16, 200 * 1024} {
		file, cuesOffset := buildFileWithSeekHead(t, padding)

		d, err := NewDemuxer(bytes.NewReader(file), IDSegmentInfo, IDTracks, IDCues)
		if err != nil {
			t.Fatalf("padding=%d: NewDemuxer: %v", padding, err)
		}
		n, err := d.GetNumTracks()
		if err != nil || n != 1 {
			t.Fatalf("padding=%d: pistas = %d (%v), se esperaba 1", padding, n, err)
		}
		// cuesPos apunta al inicio del elemento (vía SeekHead) o a sus datos
		// (lectura secuencial); cualquiera de los dos sirve.
		if got := d.parser.cuesPos; got < uint64(cuesOffset) || got > uint64(cuesOffset)+8 {
			t.Fatalf("padding=%d: cuesPos = %d, se esperaba ~%d", padding, got, cuesOffset)
		}
		if cues := d.GetCues(); len(cues) != 1 || cues[0].Track != 1 {
			t.Fatalf("padding=%d: cues = %+v, se esperaba 1 cue de la pista 1", padding, cues)
		}
	}
}
