package matroska

import (
	"bytes"
	"errors"
	"io"
)

// parseTags parses tag information from the Matroska file.
//
// The Tags element contains metadata tags that provide additional information
// about the file, such as artist, album, genre, and other descriptive metadata.
// This information is similar to ID3 tags in MP3 files and can be used to
// enrich the user experience by providing more context about the media content.
//
// This method parses the tag information and stores it for later use, enabling applications to display
// or utilize this metadata.
//
// Parameters:
//   - size: The size of the Tags element in bytes.
//
// Returns:
//   - error: An error if the Tags element could not be parsed.
func (mp *MatroskaParser) parseTags(size uint64) error {
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

		if element.ID == IDTag {
			tag, errParseTag := mp.parseTag(element.Data)
			if errParseTag != nil {
				return errParseTag
			}
			mp.tags = append(mp.tags, tag)
		}
	}

	return nil
}

func (mp *MatroskaParser) parseTag(data []byte) (*Tag, error) {
	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	tag := &Tag{}

	for childReader.pos < int64(len(data)) {
		element, err := childReader.ReadElement()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, err
		}

		switch element.ID {
		case IDTargets:
			target, errParseTarget := mp.parseTarget(element.Data)
			if errParseTarget != nil {
				return nil, errParseTarget
			}
			tag.Targets = append(tag.Targets, target)
		case IDSimpleTag:
			simpleTag, errParseSimpleTag := mp.parseSimpleTag(element.Data)
			if errParseSimpleTag != nil {
				return nil, errParseSimpleTag
			}
			tag.SimpleTags = append(tag.SimpleTags, simpleTag)
		}
	}

	return tag, nil
}

func (mp *MatroskaParser) parseTarget(data []byte) (Target, error) {
	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	target := Target{}

	for childReader.pos < int64(len(data)) {
		element, err := childReader.ReadElement()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return target, err
		}

		switch element.ID {
		case IDTargetTypeValue:
			target.Type = uint32(element.ReadUInt())
		case IDTagTrackUID:
			target.UID = element.ReadUInt()
		case IDTagEditionUID:
			target.UID = element.ReadUInt()
		case IDTagChapterUID:
			target.UID = element.ReadUInt()
		case IDTagAttachmentUID:
			target.UID = element.ReadUInt()
		}
	}

	return target, nil
}

func (mp *MatroskaParser) parseSimpleTag(data []byte) (SimpleTag, error) {
	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	simpleTag := SimpleTag{
		Language: "eng", // Default language
		Default:  true,  // Default value
	}

	for childReader.pos < int64(len(data)) {
		element, err := childReader.ReadElement()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return simpleTag, err
		}

		switch element.ID {
		case IDTagName:
			simpleTag.Name = element.ReadString()
		case IDTagString:
			simpleTag.Value = element.ReadString()
		case IDTagLanguage:
			simpleTag.Language = element.ReadString()
		case IDTagDefault:
			simpleTag.Default = element.ReadUInt() != 0
		}
	}

	return simpleTag, nil
}
