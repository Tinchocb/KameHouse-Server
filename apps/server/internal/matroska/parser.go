// Package matroska implements a parser for Matroska and WebM media container formats.
//
// Matroska is an open standard, free container format, a file format that can hold an
// unlimited number of video, audio, picture, or subtitle tracks in one file. It is
// intended to serve as a universal format for storing common multimedia content, like
// movies or TV shows.
//
// This package provides functionality to parse Matroska files, extract metadata, and
// read media packets. It builds upon the EBML (Extensible Binary Meta Language) parsing
// functionality to implement Matroska-specific parsing logic.
//
// The main entry point is the MatroskaParser type, which can be created using the
// NewMatroskaParser function. Once created, it can be used to read file information,
// track information, and media packets.
//
// Example usage:
//
//	file, err := os.Open("video.mkv")
//	if err != nil {
//	    log.Fatal(err)
//	}
//	defer file.Close()
//
//	parser, err := matroska.NewMatroskaParser(file, false)
//	if err != nil {
//	    log.Fatal(err)
//	}
//
//	// Get file information
//	fileInfo := parser.GetFileInfo()
//	fmt.Printf("Title: %s\n", fileInfo.Title)
//	fmt.Printf("Duration: %d\n", fileInfo.Duration)
//
//	// Get track information
//	numTracks := parser.GetNumTracks()
//	for i := uint(0); i < numTracks; i++ {
//	    track := parser.GetTrackInfo(i)
//	    fmt.Printf("Track %d: %s\n", track.Number, track.Name)
//	}
//
//	// Read packets
//	for {
//	    packet, err := parser.ReadPacket()
//	    if err != nil {
//	        if errors.Is(err, io.EOF {
//	            break
//	        }
//	        log.Fatal(err)
//	    }
//	    // Process packet...
//	}
package matroska

import (
	"bytes"
	"errors"
	"fmt"
	"io"
)

// MatroskaParser represents a parser for Matroska and WebM files.
//
// It provides functionality to parse Matroska container files, extract metadata,
// and read media packets. The parser maintains state information about the file
// structure, including the EBML header, segment information, tracks, and other
// metadata elements.
//
// The parser can operate in two modes:
//   - With seeking enabled (noSeeking=false): Allows for more efficient parsing
//     by seeking to specific positions in the file when needed.
//   - With seeking disabled (noSeeking=true): Parses the file sequentially,
//     which is useful for streaming or non-seekable input sources.
//
// After creating a parser with NewMatroskaParser, you can access file information,
// track information, and read media packets using the provided methods.
type MatroskaParser struct {
	reader      *EBMLReader
	header      *EBMLHeader
	segment     *SegmentElement
	tracks      []*TrackInfo
	fileInfo    *SegmentInfo
	chapters    []*Chapter
	tags        []*Tag
	cues        []*Cue
	attachments []*Attachment

	// Element IDs to parse
	elementsToParse map[uint32]struct{}

	// Position tracking
	segmentPos    uint64
	segmentTopPos uint64
	cuesPos       uint64
	cuesTopPos    uint64

	// Flags
	noSeeking bool
}

// SegmentElement represents the main segment element in a Matroska file.
//
// The segment is the top-level element in a Matroska file that contains all
// the actual data, including metadata, tracks, clusters, and other elements.
// It is the largest element in the file and contains all other elements except
// for the EBML header.
//
// The Position field indicates the byte offset from the beginning of the file
// where the segment element starts, and the Size field indicates the total size
// of the segment element in bytes.
type SegmentElement struct {
	Position uint64
	Size     uint64
}

// NewMatroskaParser creates a new Matroska parser for the given ReadSeeker.
//
// This function initializes a MatroskaParser and parses the EBML header and
// main segment of the Matroska file. It validates that the file is a valid
// Matroska or WebM file by checking the document type in the EBML header.
// If the file is already seeked, it will not attempt to read the EBML header.
//
// Parameters:
//   - r: An io.ReadSeeker that provides access to the Matroska file data.
//     This can be a file, network stream, or any other source that supports
//     both reading and seeking operations.
//   - noSeeking: A boolean flag that controls whether the parser should avoid
//     seeking operations. When set to true, the parser will parse the file
//     sequentially, which is useful for streaming or non-seekable input sources.
//     When set to false, the parser can seek to specific positions in the file
//     for more efficient parsing.
//   - elementsToParse: A variadic list of element IDs to selectively parse.
//     When no element IDs are provided, all top-level elements are parsed (default behavior).
//     When one or more element IDs are provided, only those specific elements will be parsed,
//     and all others will be skipped. This can significantly speed up parsing when you only
//     need specific information from the file.
//     Valid element IDs include: IDSegmentInfo, IDTracks, IDChapters, IDTags, IDAttachments.
//
// Returns:
//   - *MatroskaParser: A pointer to the initialized MatroskaParser.
//   - error: An error if the parser could not be created or if the file is not
//     a valid Matroska or WebM file.
//
// Example (parse all elements):
//
//	file, err := os.Open("video.mkv")
//	if err != nil {
//	    log.Fatal(err)
//	}
//	defer file.Close()
//
//	parser, err := matroska.NewMatroskaParser(file, false)
//	if err != nil {
//	    log.Fatal(err)
//	}
//
// Example (parse only tracks and attachments):
//
//	parser, err := matroska.NewMatroskaParser(file, false, IDTracks, IDAttachments)
//	if err != nil {
//	    log.Fatal(err)
//	}
func NewMatroskaParser(r io.ReadSeeker, noSeeking bool, elementsToParse ...uint32) (*MatroskaParser, error) {
	parser := &MatroskaParser{
		reader:          NewEBMLReader(r),
		noSeeking:       noSeeking,
		elementsToParse: make(map[uint32]struct{}),
	}

	if len(elementsToParse) > 0 {
		for _, id := range elementsToParse {
			parser.elementsToParse[id] = struct{}{}
		}
	}

	// Try to parse header and segment
	headerErr := parser.parseHeader()
	var segmentErr error
	if headerErr == nil {
		segmentErr = parser.parseSegment()
	}

	// If we failed to parse header or segment, we might be positioned at a cluster offset
	// Initialize with minimal defaults to allow packet reading from current position
	if headerErr != nil || segmentErr != nil {
		// Initialize with defaults for cluster-only parsing
		parser.header = &EBMLHeader{
			DocType:        "matroska",
			DocTypeVersion: 1,
		}

		parser.fileInfo = &SegmentInfo{
			TimecodeScale: 1000000, // Default timecode scale (1ms)
		}

		parser.tracks = make([]*TrackInfo, 0)
		parser.chapters = make([]*Chapter, 0)
		parser.tags = make([]*Tag, 0)
		parser.cues = make([]*Cue, 0)
		parser.attachments = make([]*Attachment, 0)

		// Set segment to unknown size since we're starting mid-stream
		currentPos := parser.reader.Position()
		parser.segment = &SegmentElement{
			Position: uint64(currentPos),
			Size:     (1 << (7 * 8)) - 1, // Unknown size marker
		}

		parser.segmentPos = uint64(currentPos)
		parser.segmentTopPos = parser.segmentPos + parser.segment.Size

		// Reader is already positioned at cluster data, ready for ReadPacket()
	}

	// Devnote: Enable cues scanning/direct parsing for seekable files to avoid slow ffprobe scanning.
	if !noSeeking && parser.cuesPos > 0 && len(parser.cues) == 0 {
		currentPos := parser.reader.Position()
		if _, err := parser.reader.Seek(int64(parser.cuesPos), io.SeekStart); err == nil {
			id, size, err := parser.reader.ReadElementHeader()
			if err == nil && id == IDCues {
				parser.cuesTopPos = parser.cuesPos + size
				_ = parser.parseCues(size)
			}
		}
		// Restore position
		_, _ = parser.reader.Seek(currentPos, io.SeekStart)
	}

	if !noSeeking && parser.cuesPos == 0 {
		// Cues not found in initial scan (e.g. no SeekHead), scan the whole segment
		currentPos := parser.reader.Position()
		if _, err := parser.reader.Seek(int64(parser.segmentPos), io.SeekStart); err == nil {
			segmentEnd := parser.segmentPos + parser.segment.Size
			for parser.reader.Position() < int64(segmentEnd) {
				id, size, err := parser.reader.ReadElementHeader()
				if err != nil {
					if errors.Is(err, io.EOF) {
						break
					}
					break
				}

				if id == IDCues {
					parser.cuesPos = uint64(parser.reader.Position())
					parser.cuesTopPos = uint64(parser.reader.Position()) + size
					_ = parser.parseCues(size)
					break
				} else {
					if _, err = parser.reader.Seek(int64(size), io.SeekCurrent); err != nil {
						break
					}
				}
			}
		}
		// Restore position
		_, _ = parser.reader.Seek(currentPos, io.SeekStart)
	}

	return parser, nil
}

// parseHeader parses the EBML header from the Matroska file.
//
// This method reads and validates the EBML (Extensible Binary Meta Language) header
// at the beginning of the Matroska file. The EBML header contains metadata about
// the file, including the document type, version, and other identification information.
//
// The method validates that the document type is either "matroska" or "webm",
// ensuring that the file is a valid Matroska or WebM file. If the document type
// is not recognized, an error is returned.
//
// Returns:
//   - error: An error if the header could not be read or if the document type
//     is not supported.
func (mp *MatroskaParser) parseHeader() error {
	header, err := mp.reader.ReadEBMLHeader()
	if err != nil {
		return err
	}

	// Validate it's a Matroska/WebM file
	if header.DocType != "matroska" && header.DocType != "webm" {
		return fmt.Errorf("unsupported document type: %s", header.DocType)
	}

	mp.header = header
	return nil
}

// parseSegment parses the main segment from the Matroska file.
//
// The segment is the top-level element in a Matroska file that contains all
// the actual data, including metadata, tracks, clusters, and other elements.
// This method reads the segment element header, validates that it is indeed
// a segment element, and stores its position and size for later use.
//
// After parsing the segment header, this method calls parseSegmentChildren()
// to parse the children of the segment element, which includes the segment
// information, tracks, cues, chapters, tags, and attachments.
//
// Returns:
//   - error: An error if the segment header could not be read or if the element
//     is not a valid segment element.
func (mp *MatroskaParser) parseSegment() error {
	// Read segment element header
	id, size, err := mp.reader.ReadElementHeader()
	if err != nil {
		return fmt.Errorf("failed to read segment header: %w", err)
	}

	if id != IDSegment {
		return fmt.Errorf("expected segment element, got ID 0x%X", id)
	}

	mp.segment = &SegmentElement{
		Position: uint64(mp.reader.Position()),
		Size:     size,
	}

	mp.segmentPos = mp.segment.Position
	mp.segmentTopPos = mp.segment.Position + mp.segment.Size

	// Parse segment children
	if err = mp.parseSegmentChildren(); err != nil {
		return fmt.Errorf("failed to parse segment children: %w", err)
	}

	return nil
}

// shouldParseElement returns true if the given element ID should be parsed.
// If no specific elements were configured via elementsToParse, all elements are parsed.
func (mp *MatroskaParser) shouldParseElement(id uint32) bool {
	// If elementsToParse is empty, parse everything
	if len(mp.elementsToParse) == 0 {
		return true
	}
	// Otherwise, only parse if the element is in the map
	_, ok := mp.elementsToParse[id]
	return ok
}

// parseSegmentChildren parses the children of the segment element.
//
// This method iterates through all child elements of the segment and dispatches
// them to appropriate parsing methods based on their element ID. The segment can
// contain various types of child elements, including:
//
//   - SegmentInfo: Contains metadata about the file, such as title, duration,
//     and timestamp scale.
//   - Tracks: Contains information about the media tracks in the file.
//   - Cues: Contains indexing information for seeking (currently skipped).
//   - Chapters: Contains chapter information (currently skipped).
//   - Tags: Contains metadata tags (currently skipped).
//   - Attachments: Contains attached files (currently skipped).
//   - Cluster: Contains the actual media data, which is handled during packet reading.
//
// If the parser is configured to avoid seeks (noSeeking=true), it will parse
// the entire segment sequentially. Otherwise, it will stop parsing when it
// encounters the first cluster element, as clusters are handled during packet reading.
//
// Returns:
//   - error: An error if any of the child elements could not be parsed.
func (mp *MatroskaParser) parseSegmentChildren() error {
	segmentEnd := mp.segment.Position + mp.segment.Size

	for mp.reader.Position() < int64(segmentEnd) {
		id, size, err := mp.reader.ReadElementHeader()
		if err != nil {
			if errors.Is(err, io.EOF) {
				// If the segment uses unknown size (streaming), EOF is a natural terminator.
				// Otherwise, hitting EOF before the declared end means the segment is truncated.
				if mp.segment != nil && mp.segment.Size == (1<<(7*8))-1 {
					break
				}
				return fmt.Errorf("failed to read element header: %w", io.ErrUnexpectedEOF)
			}
			return fmt.Errorf("failed to read element header: %w", err)
		}

		currentPos := mp.reader.Position()

		switch id {
		case IDSeekHead:
			if err = mp.parseSeekHead(size); err != nil {
				return fmt.Errorf("failed to parse seek head: %w", err)
			}
		case IDSegmentInfo:
			if mp.shouldParseElement(IDSegmentInfo) {
				if err = mp.parseSegmentInfo(size); err != nil {
					return fmt.Errorf("failed to parse segment info: %w", err)
				}
			} else {
				// Skip this element
				if err = mp.reader.SeekOrSkip(mp.noSeeking, int64(size)); err != nil {
					return fmt.Errorf("failed to skip element: %w", err)
				}
			}
		case IDTracks:
			if mp.shouldParseElement(IDTracks) {
				if err = mp.parseTracks(size); err != nil {
					return fmt.Errorf("failed to parse tracks: %w", err)
				}
			} else {
				// Skip this element
				if err = mp.reader.SeekOrSkip(mp.noSeeking, int64(size)); err != nil {
					return fmt.Errorf("failed to skip element: %w", err)
				}
			}
		case IDCues:
			if mp.shouldParseElement(IDCues) {
				mp.cuesPos = uint64(currentPos)
				mp.cuesTopPos = uint64(currentPos) + size
				if err = mp.parseCues(size); err != nil {
					return fmt.Errorf("failed to parse cues: %w", err)
				}
			} else {
				// Skip this element
				if err = mp.reader.SeekOrSkip(mp.noSeeking, int64(size)); err != nil {
					return fmt.Errorf("failed to skip element: %w", err)
				}
			}
		case IDChapters:
			if mp.shouldParseElement(IDChapters) {
				if err = mp.parseChapters(size); err != nil {
					return fmt.Errorf("failed to parse chapters: %w", err)
				}
			} else {
				// Skip this element
				if err = mp.reader.SeekOrSkip(mp.noSeeking, int64(size)); err != nil {
					return fmt.Errorf("failed to skip element: %w", err)
				}
			}
		case IDTags:
			if mp.shouldParseElement(IDTags) {
				if err = mp.parseTags(size); err != nil {
					return fmt.Errorf("failed to parse tags: %w", err)
				}
			} else {
				// Skip this element
				if err = mp.reader.SeekOrSkip(mp.noSeeking, int64(size)); err != nil {
					return fmt.Errorf("failed to skip element: %w", err)
				}
			}
		case IDAttachments:
			if mp.shouldParseElement(IDAttachments) {
				if err = mp.parseAttachments(size); err != nil {
					return fmt.Errorf("failed to parse attachments: %w", err)
				}
			} else {
				// Skip this element
				if err = mp.reader.SeekOrSkip(mp.noSeeking, int64(size)); err != nil {
					return fmt.Errorf("failed to skip element: %w", err)
				}
			}
		case IDCluster:
			// We'll handle clusters during packet reading
			// For now, just skip to end of parsing metadata
			if !mp.noSeeking {
				return nil
			}
			// Fall through to skip if avoiding seeks
			fallthrough
		default:
			// Skip unknown elements
			if mp.noSeeking {
				if _, err = mp.reader.Skip(int64(size)); err != nil {
					return fmt.Errorf("failed to skip element: %w", err)
				}
			} else {
				if _, err = mp.reader.Seek(int64(size), io.SeekCurrent); err != nil {
					return fmt.Errorf("failed to skip element: %w", err)
				}
			}
		}
	}

	return nil
}

// parseSegmentInfo parses segment information from the Matroska file.
//
// The SegmentInfo element contains metadata about the file, such as the title,
// duration, timestamp scale, and other information. This method reads the
// SegmentInfo element and populates the fileInfo field of the MatroskaParser
// with the parsed data.
//
// The SegmentInfo element can contain the following child elements:
//   - SegmentUID: A unique identifier for the segment.
//   - SegmentFilename: The filename of the segment.
//   - PrevUID: The unique identifier of the previous segment.
//   - PrevFilename: The filename of the previous segment.
//   - NextUID: The unique identifier of the next segment.
//   - NextFilename: The filename of the next segment.
//   - TimestampScale: The scale factor for timestamps in nanoseconds.
//   - Duration: The duration of the segment in timestamp units.
//   - DateUTC: The date and time the file was created.
//   - Title: The title of the segment.
//   - MuxingApp: The name of the application used to create the file.
//   - WritingApp: The name of the application used to write the file.
//
// Parameters:
//   - size: The size of the SegmentInfo element in bytes.
//
// Returns:
//   - error: An error if the SegmentInfo element could not be read or parsed.
func (mp *MatroskaParser) parseSegmentInfo(size uint64) error {
	data := make([]byte, size)
	_, err := io.ReadFull(mp.reader, data)
	if err != nil {
		return err
	}

	mp.fileInfo = &SegmentInfo{
		TimecodeScale: 1000000, // Default timecode scale
	}

	reader := bytes.NewReader(data)
	childReader := NewEBMLReader(&seekableReader{reader})

	var durationInTimecodeScale float64

	for childReader.pos < int64(size) {
		element, errReadElement := childReader.ReadElement()
		if errReadElement != nil {
			if errors.Is(errReadElement, io.EOF) {
				break
			}
			return errReadElement
		}

		switch element.ID {
		case IDSegmentUID:
			if len(element.Data) >= 16 {
				copy(mp.fileInfo.UID[:], element.Data[:16])
			}
		case IDSegmentFilename:
			mp.fileInfo.Filename = element.ReadString()
		case IDPrevUID:
			if len(element.Data) >= 16 {
				copy(mp.fileInfo.PrevUID[:], element.Data[:16])
			}
		case IDPrevFilename:
			mp.fileInfo.PrevFilename = element.ReadString()
		case IDNextUID:
			if len(element.Data) >= 16 {
				copy(mp.fileInfo.NextUID[:], element.Data[:16])
			}
		case IDNextFilename:
			mp.fileInfo.NextFilename = element.ReadString()
		case IDTimestampScale:
			mp.fileInfo.TimecodeScale = element.ReadUInt()
		case IDDuration:
			// Duration is stored as a float in timecode scale units
			durationInTimecodeScale = element.ReadFloat()
		case IDDateUTC:
			mp.fileInfo.DateUTC = element.ReadInt()
			mp.fileInfo.DateUTCValid = true
		case IDTitle:
			mp.fileInfo.Title = element.ReadString()
		case IDMuxingApp:
			mp.fileInfo.MuxingApp = element.ReadString()
		case IDWritingApp:
			mp.fileInfo.WritingApp = element.ReadString()
		}
	}

	// Convert duration to nanoseconds after all elements are parsed
	if durationInTimecodeScale > 0 {
		mp.fileInfo.Duration = uint64(durationInTimecodeScale * float64(mp.fileInfo.TimecodeScale))
	}

	return nil
}

// GetNumTracks returns the number of tracks
func (mp *MatroskaParser) GetNumTracks() uint {
	return uint(len(mp.tracks))
}

// GetTrackInfo returns information about a specific track
func (mp *MatroskaParser) GetTrackInfo(track uint) *TrackInfo {
	if track >= uint(len(mp.tracks)) {
		return nil
	}
	return mp.tracks[track]
}

// GetFileInfo returns file-level information
func (mp *MatroskaParser) GetFileInfo() *SegmentInfo {
	return mp.fileInfo
}

// GetAttachments returns all attachments
func (mp *MatroskaParser) GetAttachments() []*Attachment {
	return mp.attachments
}

// GetChapters returns all chapters
func (mp *MatroskaParser) GetChapters() []*Chapter {
	return mp.chapters
}

// GetTags returns all tags
func (mp *MatroskaParser) GetTags() []*Tag {
	return mp.tags
}

// GetCues returns all cues
func (mp *MatroskaParser) GetCues() []*Cue {
	return mp.cues
}

func (mp *MatroskaParser) parseSeekHead(size uint64) error {
	// Leer a través del EBMLReader (con buffer), no de mp.reader.r: el bufio ya
	// adelantó hasta 64 KB del lector de abajo, así que leer directo de r
	// devolvía bytes de otra posición y la apertura caía al modo sin pistas.
	// EBMLReader.Read ya avanza mp.reader.pos.
	data := make([]byte, size)
	if _, err := io.ReadFull(mp.reader, data); err != nil {
		return err
	}

	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	for childReader.pos < int64(size) {
		element, errReadElement := childReader.ReadElement()
		if errReadElement != nil {
			if errors.Is(errReadElement, io.EOF) {
				break
			}
			return errReadElement
		}

		if element.ID == IDSeek {
			if err := mp.parseSeek(element.Data); err != nil {
				return err
			}
		}
	}

	return nil
}

func (mp *MatroskaParser) parseSeek(data []byte) error {
	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	var seekID uint32
	var seekPos uint64

	for childReader.pos < int64(len(data)) {
		element, err := childReader.ReadElement()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return err
		}

		switch element.ID {
		case IDSeekID:
			seekID = uint32(element.ReadUInt())
		case IDSeekPos:
			seekPos = element.ReadUInt()
		}
	}

	if seekID == IDCues {
		mp.cuesPos = mp.segmentPos + seekPos
	}
	return nil
}
