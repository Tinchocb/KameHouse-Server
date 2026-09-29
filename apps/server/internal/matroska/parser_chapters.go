package matroska

import (
	"bytes"
	"errors"
	"io"
)

// parseChapters parses chapter information from the Matroska file.
//
// The Chapters element contains information about the chapters in the file,
// such as chapter titles, timecodes, and other metadata. This information
// is typically used to provide navigation within the file, allowing users
// to jump to specific sections or chapters.
//
// This method parses the chapter information and stores it for later use, enabling chapter-based navigation.
//
// Parameters:
//   - size: The size of the Chapters element in bytes.
//
// Returns:
//   - error: An error if the Chapters element could not be parsed.
func (mp *MatroskaParser) parseChapters(size uint64) error {
	data := make([]byte, size)
	_, err := io.ReadFull(mp.reader, data)
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

		if element.ID == IDEditionEntry {
			chapters, errParseEditionEntry := mp.parseEditionEntry(element.Data)
			if errParseEditionEntry != nil {
				return errParseEditionEntry
			}
			mp.chapters = append(mp.chapters, chapters...)
		}
	}

	return nil
}

func (mp *MatroskaParser) parseEditionEntry(data []byte) ([]*Chapter, error) {
	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	var chapters []*Chapter
	for childReader.pos < int64(len(data)) {
		element, err := childReader.ReadElement()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, err
		}

		if element.ID == IDChapterAtom {
			chapter, errParseChapterAtom := mp.parseChapterAtom(element.Data)
			if errParseChapterAtom != nil {
				return nil, errParseChapterAtom
			}
			chapters = append(chapters, chapter)
		}
	}
	return chapters, nil
}

func (mp *MatroskaParser) parseChapterAtom(data []byte) (*Chapter, error) {
	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	chapter := &Chapter{
		Enabled: true, // Default value
	}

	for childReader.pos < int64(len(data)) {
		element, err := childReader.ReadElement()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, err
		}

		switch element.ID {
		case IDChapterUID:
			chapter.UID = element.ReadUInt()
		case IDChapterTimeStart:
			chapter.Start = element.ReadUInt()
		case IDChapterTimeEnd:
			chapter.End = element.ReadUInt()
		case IDChapterHidden:
			chapter.Hidden = element.ReadUInt() != 0
		case IDChapterEnabled:
			chapter.Enabled = element.ReadUInt() != 0
		case IDChapterDisplay:
			display, errParseChapterDisplay := mp.parseChapterDisplay(element.Data)
			if errParseChapterDisplay != nil {
				return nil, errParseChapterDisplay
			}
			chapter.Display = append(chapter.Display, display)
		case IDChapterAtom:
			childChapter, errParseChapterAtom := mp.parseChapterAtom(element.Data)
			if errParseChapterAtom != nil {
				return nil, errParseChapterAtom
			}
			chapter.Children = append(chapter.Children, childChapter)
		}
	}

	return chapter, nil
}

func (mp *MatroskaParser) parseChapterDisplay(data []byte) (ChapterDisplay, error) {
	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	display := ChapterDisplay{
		Language: "eng", // Default value
	}

	for childReader.pos < int64(len(data)) {
		element, err := childReader.ReadElement()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return display, err
		}

		switch element.ID {
		case IDChapterString:
			display.String = element.ReadString()
		case IDChapterLanguage:
			display.Language = element.ReadString()
		case IDChapterCountry:
			display.Country = element.ReadString()
		}
	}
	return display, nil
}
