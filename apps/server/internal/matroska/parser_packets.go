package matroska

import (
	"bytes"
	"errors"
	"fmt"
	"io"
)

// ReadPacket reads the next packet from the Matroska stream.
//
// This method reads and parses the next media packet from the Matroska file.
// A packet represents a unit of media data, such as a video frame or audio
// samples, along with metadata about the packet, such as the track number,
// timestamp, and flags.
//
// The method iterates through the elements in the file, looking for Cluster,
// SimpleBlock, and BlockGroup elements, which contain the actual media data.
// When it encounters a Cluster element, it parses the cluster header to update
// the cluster timestamp. When it encounters a SimpleBlock or BlockGroup element,
// it parses the block and returns a Packet struct containing the media data
// and metadata.
//
// If the method encounters a Timestamp element within a cluster, it updates
// the cluster timestamp accordingly. Unknown elements are skipped.
//
// Returns:
//   - *Packet: A pointer to the parsed Packet struct containing the media data
//     and metadata. Returns nil when the end of the file is reached.
//   - error: An error if a packet could not be read or parsed. When the end
//     of the file is reached, the error will be io.EOF.
//
// Example:
//
//	for {
//	    packet, err := parser.ReadPacket()
//	    if err != nil {
//	        if errors.Is(err, io.EOF {
//	            break
//	        }
//	        log.Fatal(err)
//	    }
//	    // Process packet...
//	    fmt.Printf("Track: %d, Timestamp: %d\n", packet.Track, packet.StartTime)
//	}
func (mp *MatroskaParser) ReadPacket() (*Packet, error) {
	for {
		// Try to read next element
		id, size, err := mp.reader.ReadElementHeader()
		if err != nil {
			return nil, err
		}

		var packet *Packet
		var parseErr error

		switch id {
		case IDCluster:
			// Start of a new cluster, reset timestamp and parse its children
			mp.clusterTimestamp = 0
			clusterEnd := mp.reader.Position() + int64(size)
			for mp.reader.Position() < clusterEnd {
				childID, childSize, childErr := mp.reader.ReadElementHeader()
				if childErr != nil {
					return nil, childErr
				}
				switch childID {
				case IDTimestamp:
					data := make([]byte, childSize)
					if _, errReadFull := io.ReadFull(mp.reader, data); errReadFull != nil {
						return nil, errReadFull
					}
					element := &EBMLElement{ID: childID, Size: childSize, Data: data}
					mp.clusterTimestamp = element.ReadUInt()
				case IDSimpleBlock:
					packet, parseErr = mp.parseSimpleBlock(childSize)
					if parseErr != nil {
						return nil, parseErr
					}
					if packet != nil {
						if mp.currentTrackMask == 0 || (1<<(packet.Track-1))&mp.currentTrackMask == 0 {
							return packet, nil
						}
					}
				case IDBlockGroup:
					packet, parseErr = mp.parseBlockGroup(childSize)
					if parseErr != nil {
						return nil, parseErr
					}
					if packet != nil {
						if mp.currentTrackMask == 0 || (1<<(packet.Track-1))&mp.currentTrackMask == 0 {
							return packet, nil
						}
					}
				default:
					if _, err = mp.reader.Seek(int64(childSize), io.SeekCurrent); err != nil {
						return nil, err
					}
				}
			}
			continue

		case IDSimpleBlock:
			packet, parseErr = mp.parseSimpleBlock(size)

		case IDBlockGroup:
			packet, parseErr = mp.parseBlockGroup(size)

		case IDTimestamp:
			// Update cluster timestamp
			data := make([]byte, size)
			if _, errReadFull := io.ReadFull(mp.reader, data); errReadFull != nil {
				return nil, errReadFull
			}
			element := &EBMLElement{ID: id, Size: size, Data: data}
			mp.clusterTimestamp = element.ReadUInt()
			continue

		case IDSegmentInfo, IDTracks, IDCues, IDChapters, IDTags, IDAttachments:
			// Skip metadata elements if encountered mid-stream
			// This can happen when starting from a cluster offset
			if _, err = mp.reader.Seek(int64(size), io.SeekCurrent); err != nil {
				return nil, err
			}
			continue

		default:
			// Skip unknown elements
			if _, err = mp.reader.Seek(int64(size), io.SeekCurrent); err != nil {
				return nil, err
			}
			continue
		}

		if parseErr != nil {
			return nil, parseErr
		}

		if packet != nil {
			if mp.currentTrackMask != 0 && (1<<(packet.Track-1))&mp.currentTrackMask != 0 {
				continue
			}
			return packet, nil
		}
	}
}

// parseClusterHeader parses the header of a Cluster element.
//
// A Cluster is a top-level element that contains a group of blocks (media data)
// that are related to each other, typically by time. The cluster header contains
// metadata about the cluster, such as the timestamp.
//
// This method currently only resets the cluster timestamp to zero when a new cluster
// is encountered. A more complete implementation would parse the cluster
// header elements, such as the timestamp, and update the parser's state accordingly.
//
// Parameters:
//   - size: The size of the Cluster element in bytes.
//
// Returns:
//   - error: An error if the cluster header could not be parsed.
func (mp *MatroskaParser) parseClusterHeader(size uint64) error {
	// We need to find the timestamp of the cluster.
	data := make([]byte, size)
	_, err := io.ReadFull(mp.reader, data)
	if err != nil {
		return err
	}

	reader := bytes.NewReader(data)
	childReader := NewEBMLReader(&seekableReader{reader})

	for childReader.pos < int64(len(data)) {
		element, errReadElement := childReader.ReadElement()
		if errReadElement != nil {
			if errors.Is(errReadElement, io.EOF) {
				break
			}
			return errReadElement
		}

		if element.ID == IDTimestamp {
			mp.clusterTimestamp = element.ReadUInt()
			// We found the timestamp, but we need to continue parsing the rest of the cluster
			// so we have to seek back.
			if _, err = mp.reader.Seek(int64(-size), io.SeekCurrent); err != nil {
				return err
			}
			return nil
		}
	}

	// Timestamp not found, which is weird, but let's seek back to where we were.
	if _, err = mp.reader.Seek(int64(-size), io.SeekCurrent); err != nil {
		return err
	}
	mp.clusterTimestamp = 0
	return nil
}

// parseSimpleBlock parses a simple block element from the Matroska file.
//
// A SimpleBlock element contains a single frame of media data along with metadata
// about the frame, such as the track number, timestamp, and flags. SimpleBlocks
// are the most common way to store media data in a Matroska file.
//
// This method parses the SimpleBlock element and returns a Packet struct containing
// the media data and metadata. The parsing process includes:
//   - Reading the track number (as a variable-length integer)
//   - Reading the timestamp (relative to the cluster timestamp)
//   - Reading the flags (which indicate keyframe status, discardable status, etc.)
//   - Extracting the frame data, handling different lacing types if present
//
// Matroska supports three types of lacing for storing multiple frames in a single block:
//   - Fixed-size lacing: All frames have the same size.
//   - EBML lacing: Frame sizes are encoded as EBML variable-length integers.
//   - Xiph lacing: Frame sizes are encoded similarly to Xiph's lacing method.
//
// Parameters:
//   - size: The size of the SimpleBlock element in bytes.
//
// Returns:
//   - *Packet: A pointer to the parsed Packet struct containing the media data
//     and metadata.
//   - error: An error if the SimpleBlock element could not be parsed.
func (mp *MatroskaParser) parseSimpleBlock(size uint64) (*Packet, error) {
	data := make([]byte, size)
	_, err := io.ReadFull(mp.reader, data)
	if err != nil {
		return nil, err
	}

	if len(data) < 4 {
		return nil, fmt.Errorf("block too short")
	}

	// Parse track number (VINT)
	trackNum, trackBytes := mp.parseVInt(data)
	if trackBytes == 0 {
		return nil, fmt.Errorf("invalid track number")
	}

	// Parse timestamp (2 bytes, signed)
	if len(data) < trackBytes+2 {
		return nil, fmt.Errorf("block too short for timestamp")
	}

	timestamp := int16(data[trackBytes])<<8 | int16(data[trackBytes+1])

	// Parse flags
	if len(data) < trackBytes+3 {
		return nil, fmt.Errorf("block too short for flags")
	}

	flags := data[trackBytes+2]

	// Extract frame data, handling lacing
	frameData := data[trackBytes+3:]

	// Check lacing flags (bits 1-0)
	lacingType := flags & 0x06
	if lacingType != 0 {
		// Handle laced frames
		if len(frameData) < 1 {
			return nil, fmt.Errorf("laced block too short")
		}

		frameCount := int(frameData[0]) + 1
		frameData = frameData[1:] // Skip frame count byte

		switch lacingType {
		case 0x02: // Fixed-size lacing
			if frameCount > 1 {
				frameSize := len(frameData) / frameCount
				frameData = frameData[:frameSize]
			}
		case 0x04: // EBML lacing
			// Con EBML lacing se conserva todo el flujo, incluida la información de
			// tamaños: es lo que produce la referencia. No se recorta nada.
		case 0x06: // Xiph lacing
			// Parse Xiph lacing sizes
			if frameCount > 1 {
				frameSizes := make([]int, frameCount)
				offset := 0

				// Parse sizes for all frames except the last one
				for i := 0; i < frameCount-1; i++ {
					dataSize := 0
					// Xiph lacing: sizes are encoded as a series of 255 bytes
					// followed by the remainder
					for offset < len(frameData) && frameData[offset] == 0xFF {
						dataSize += 255
						offset++
					}
					if offset < len(frameData) {
						dataSize += int(frameData[offset])
						offset++
					}
					frameSizes[i] = dataSize
				}

				// Last frame size is the remainder
				totalPrevFrames := 0
				for i := 0; i < frameCount-1; i++ {
					totalPrevFrames += frameSizes[i]
				}
				frameSizes[frameCount-1] = len(frameData) - offset - totalPrevFrames

				// Extract the first frame (for simplicity, just return the first frame)
				// In a full implementation, you'd want to return all frames
				if frameSizes[0] > 0 && offset+frameSizes[0] <= len(frameData) {
					frameData = frameData[offset : offset+frameSizes[0]]
				} else {
					// If parsing failed, take remaining data after size headers
					frameData = frameData[offset:]
				}
			}
		}
	}

	scaledTime := uint64(0)
	{
		scale := uint64(1000000)
		if mp.fileInfo != nil && mp.fileInfo.TimecodeScale != 0 {
			scale = mp.fileInfo.TimecodeScale
		}
		// timestamp int16 con signo: aritmética int64 para no wrappear a 2^64.
		t := int64(mp.clusterTimestamp) + int64(timestamp)
		if t < 0 {
			t = 0
		}
		scaledTime = uint64(t) * scale
	}
	packet := &Packet{
		Track:     uint8(trackNum),
		StartTime: scaledTime,
		EndTime:   scaledTime, // Will be updated if duration is known
		FilePos:   uint64(mp.reader.Position()) - size,
		Data:      frameData,
		Flags:     uint32(flags),
	}

	// Set keyframe flag if present
	if flags&0x80 != 0 {
		packet.Flags |= KF
	}

	return packet, nil
}

// parseBlockGroup parses a block group element from the Matroska file.
//
// A BlockGroup element contains a block along with additional metadata, such as
// duration, reference frames, and other information. BlockGroups are more complex
// than SimpleBlocks and can contain multiple blocks and additional metadata elements.
//
// This method parses the BlockGroup element and returns a Packet struct containing
// the media data and metadata. The parsing process includes:
//   - Reading the Block element, which contains the actual media data
//   - Reading the BlockDuration element, which specifies the duration of the block
//   - Extracting the frame data and metadata
//
// Unlike SimpleBlocks, BlockGroups do not have flags in the block header itself,
// but they can contain additional metadata elements that provide similar information.
//
// Parameters:
//   - size: The size of the BlockGroup element in bytes.
//
// Returns:
//   - *Packet: A pointer to the parsed Packet struct containing the media data
//     and metadata.
//   - error: An error if the BlockGroup element could not be parsed.
func (mp *MatroskaParser) parseBlockGroup(size uint64) (*Packet, error) {
	data := make([]byte, size)
	_, err := io.ReadFull(mp.reader, data)
	if err != nil {
		return nil, err
	}

	reader := bytes.NewReader(data)
	childReader := NewEBMLReader(&seekableReader{reader})

	var packet *Packet
	var duration uint64

	for childReader.pos < int64(len(data)) {
		element, errReadElement := childReader.ReadElement()
		if errReadElement != nil {
			if errors.Is(errReadElement, io.EOF) {
				break
			}
			return nil, errReadElement
		}

		switch element.ID {
		case IDBlock:
			// Parse block similar to simple block but without flags
			blockData := element.Data
			if len(blockData) < 4 {
				return nil, fmt.Errorf("block too short")
			}

			trackNum, trackBytes := mp.parseVInt(blockData)
			if trackBytes == 0 {
				return nil, fmt.Errorf("invalid track number")
			}

			timestamp := int16(blockData[trackBytes])<<8 | int16(blockData[trackBytes+1])
			frameData := blockData[trackBytes+3:] // Skip flags byte

			scaledTime := uint64(0)
			{
				scale := uint64(1000000)
				if mp.fileInfo != nil && mp.fileInfo.TimecodeScale != 0 {
					scale = mp.fileInfo.TimecodeScale
				}
				t := int64(mp.clusterTimestamp) + int64(timestamp)
				if t < 0 {
					t = 0
				}
				scaledTime = uint64(t) * scale
			}
			packet = &Packet{
				Track:     uint8(trackNum),
				StartTime: scaledTime,
				EndTime:   scaledTime,
				FilePos:   uint64(mp.reader.Position()) - size,
				Data:      frameData,
				Flags:     KF, // Block groups are typically keyframes
			}

		case 0x9B: // BlockDuration
			duration = element.ReadUInt()
		}
	}

	if packet != nil && duration > 0 {
		scale := uint64(1000000)
		if mp.fileInfo != nil && mp.fileInfo.TimecodeScale != 0 {
			scale = mp.fileInfo.TimecodeScale
		}
		packet.EndTime = packet.StartTime + (duration * scale)
	}

	return packet, nil
}

// parseVInt parses a variable-length integer (VINT) from the given data.
//
// Variable-length integers are used throughout Matroska and EBML to encode
// element IDs and sizes in a space-efficient manner. The length of the integer
// is encoded in the first byte, allowing for integers of different sizes to be
// represented compactly.
//
// The VINT format works as follows:
//   - The first byte contains both the length information and the most significant
//     bits of the value.
//   - The length is determined by the position of the first '1' bit in the first byte.
//     For example, if the first bit is '1', the VINT is 1 byte long; if the second
//     bit is the first '1', the VINT is 2 bytes long, and so on.
//   - The remaining bits in the first byte (after the length marker) and all bits
//     in subsequent bytes form the actual value.
//
// Parameters:
//   - data: A byte slice containing the VINT to be parsed.
//
// Returns:
//   - uint64: The parsed value.
//   - int: The number of bytes consumed from the input data. Returns 0 if the
//     VINT is invalid or if the data is too short.
func (mp *MatroskaParser) parseVInt(data []byte) (uint64, int) {
	if len(data) == 0 {
		return 0, 0
	}

	firstByte := data[0]
	if firstByte == 0 {
		return 0, 0
	}

	// Find length by counting leading zeros
	var length int
	mask := uint8(0x80)
	for i := 0; i < 8; i++ {
		if firstByte&mask != 0 {
			length = i + 1
			break
		}
		mask >>= 1
	}

	if length == 0 || len(data) < length {
		return 0, 0
	}

	// Extract value
	result := uint64(firstByte & (mask - 1))
	for i := 1; i < length; i++ {
		result = (result << 8) | uint64(data[i])
	}

	return result, length
}
