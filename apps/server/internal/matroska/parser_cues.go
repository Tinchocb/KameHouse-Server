package matroska

import (
	"bytes"
	"errors"
	"io"
	"sort"
)

// parseCues parses cue information for seeking from the Matroska file.
//
// The Cues element contains indexing information that enables efficient seeking
// to specific positions in the file. This information is particularly useful
// for media players that need to quickly jump to different timecodes in the file.
//
// This method parses the cue points and stores them for later use during seeking operations.
//
// Parameters:
//   - size: The size of the Cues element in bytes.
//
// Returns:
//   - error: An error if the Cues element could not be parsed.
func (mp *MatroskaParser) parseCues(size uint64) error {
	data, err := mp.reader.readMetadata(size)
	if err != nil {
		return err
	}

	reader := bytes.NewReader(data)
	childReader := NewEBMLReader(&seekableReader{reader})

	for childReader.pos < int64(size) {
		element, errReadElement := childReader.ReadElement()
		if errReadElement != nil {
			if errors.Is(errReadElement, io.EOF) {
				break
			}
			return errReadElement
		}

		if element.ID == IDCuePoint {
			cuePoints, errParseCuePoint := mp.parseCuePoint(element.Data)
			if errParseCuePoint != nil {
				return errParseCuePoint
			}
			mp.cues = append(mp.cues, cuePoints...)
		}
	}

	// Cues should be sorted by time for efficient searching
	sort.Slice(mp.cues, func(i, j int) bool {
		return mp.cues[i].Time < mp.cues[j].Time
	})

	return nil
}

func (mp *MatroskaParser) parseCuePoint(data []byte) ([]*Cue, error) {
	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	var cueTime uint64
	var cues []*Cue

	for childReader.pos < int64(len(data)) {
		element, err := childReader.ReadElement()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, err
		}

		switch element.ID {
		case IDCueTime:
			cueTime = element.ReadUInt()
		case IDCueTrackPosition:
			cue, errParseCueTrackPositions := mp.parseCueTrackPositions(element.Data)
			if errParseCueTrackPositions != nil {
				return nil, errParseCueTrackPositions
			}
			scale := uint64(1000000)
			if mp.fileInfo != nil && mp.fileInfo.TimecodeScale != 0 {
				scale = mp.fileInfo.TimecodeScale
			}
			cue.Time = cueTime * scale
			cues = append(cues, cue)
		}
	}
	return cues, nil
}

func (mp *MatroskaParser) parseCueTrackPositions(data []byte) (*Cue, error) {
	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	cue := &Cue{}

	for childReader.pos < int64(len(data)) {
		element, err := childReader.ReadElement()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, err
		}

		switch element.ID {
		case IDCueTrack:
			cue.Track = uint8(element.ReadUInt())
		case IDCueClusterPos:
			cue.Position = element.ReadUInt()
		case IDCueRelativePos:
			cue.RelativePosition = element.ReadUInt()
		case IDCueBlockNum:
			cue.Block = element.ReadUInt()
		case IDCueDuration:
			scale := uint64(1000000)
			if mp.fileInfo != nil && mp.fileInfo.TimecodeScale != 0 {
				scale = mp.fileInfo.TimecodeScale
			}
			cue.Duration = element.ReadUInt() * scale
		}
	}
	return cue, nil
}
