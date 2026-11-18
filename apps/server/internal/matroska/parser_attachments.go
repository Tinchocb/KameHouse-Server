package matroska

import (
	"bytes"
	"errors"
	"io"
)

// parseAttachments parses attachment information from the Matroska file.
//
// The Attachments element contains files that are attached to the Matroska file,
// such as cover art, fonts, or other related files. These attachments are
// embedded within the Matroska container and can be extracted for use by
// media players or other applications.
//
// This method parses the attachment information and stores it for later use, enabling applications to extract
// and utilize these attached files.
//
// Parameters:
//   - size: The size of the Attachments element in bytes.
//
// Returns:
//   - error: An error if the Attachments element could not be parsed.
func (mp *MatroskaParser) parseAttachments(size uint64) error {
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

		if element.ID == IDAttachedFile {
			attachment, errParseAttachedFile := mp.parseAttachedFile(element.Data)
			if errParseAttachedFile != nil {
				return errParseAttachedFile
			}
			mp.attachments = append(mp.attachments, attachment)
		}
	}

	return nil
}

func (mp *MatroskaParser) parseAttachedFile(data []byte) (*Attachment, error) {
	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	attachment := &Attachment{
		Position: uint64(mp.reader.Position()),
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
		case IDFileDescription:
			attachment.Description = element.ReadString()
		case IDFileName:
			attachment.Name = element.ReadString()
		case IDFileMimeType:
			attachment.MimeType = element.ReadString()
		case IDFileUID:
			attachment.UID = element.ReadUInt()
		case IDFileData:
			attachment.Length = uint64(len(element.Data))
			attachment.Data = element.Data
		}
	}

	return attachment, nil
}
