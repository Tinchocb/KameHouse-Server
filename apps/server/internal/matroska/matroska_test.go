package matroska

import (
	"bytes"
	"encoding/binary"
	"math"
	"os"
	"testing"
)

const testDemuxerFile = "testdata/test.mkv"

// vintEncode encodes a uint64 value into a variable-length integer (VINT) format.
// This is a helper function for creating test data.
func vintEncode(value uint64) []byte {
	// Determine the number of bytes needed
	var length int
	switch {
	case value < 0x80:
		length = 1
	case value < 0x4000:
		length = 2
	case value < 0x200000:
		length = 3
	case value < 0x10000000:
		length = 4
	case value < 0x800000000:
		length = 5
	case value < 0x40000000000:
		length = 6
	case value < 0x2000000000000:
		length = 7
	case value < 0x100000000000000:
		length = 8
	default:
		length = 9
	}

	// Create the buffer
	buf := make([]byte, length)

	// Encode the value
	switch length {
	case 1:
		buf[0] = byte(value) | 0x80
	case 2:
		buf[0] = byte(value>>8) | 0x40
		buf[1] = byte(value)
	case 3:
		buf[0] = byte(value>>16) | 0x20
		buf[1] = byte(value >> 8)
		buf[2] = byte(value)
	case 4:
		buf[0] = byte(value>>24) | 0x10
		buf[1] = byte(value >> 16)
		buf[2] = byte(value >> 8)
		buf[3] = byte(value)
	case 5:
		buf[0] = byte(value>>32) | 0x08
		buf[1] = byte(value >> 24)
		buf[2] = byte(value >> 16)
		buf[3] = byte(value >> 8)
		buf[4] = byte(value)
	case 6:
		buf[0] = byte(value>>40) | 0x04
		buf[1] = byte(value >> 32)
		buf[2] = byte(value >> 24)
		buf[3] = byte(value >> 16)
		buf[4] = byte(value >> 8)
		buf[5] = byte(value)
	case 7:
		buf[0] = byte(value>>48) | 0x02
		buf[1] = byte(value >> 40)
		buf[2] = byte(value >> 32)
		buf[3] = byte(value >> 24)
		buf[4] = byte(value >> 16)
		buf[5] = byte(value >> 8)
		buf[6] = byte(value)
	case 8:
		buf[0] = byte(value>>56) | 0x01
		buf[1] = byte(value >> 48)
		buf[2] = byte(value >> 40)
		buf[3] = byte(value >> 32)
		buf[4] = byte(value >> 24)
		buf[5] = byte(value >> 16)
		buf[6] = byte(value >> 8)
		buf[7] = byte(value)
	case 9:
		buf[0] = 0x00 // Reserved for future use
		buf[1] = byte(value >> 56)
		buf[2] = byte(value >> 48)
		buf[3] = byte(value >> 40)
		buf[4] = byte(value >> 32)
		buf[5] = byte(value >> 24)
		buf[6] = byte(value >> 16)
		buf[7] = byte(value >> 8)
		buf[8] = byte(value)
	}

	return buf
}

// createMockTrackEntry creates a mock TrackEntry element for testing.
// This is a helper function for creating test data.
func createMockTrackEntry(trackNum uint8, trackType uint8, codecID string, trackName string, language string) ([]byte, error) {
	buf := new(bytes.Buffer)

	// TrackNumber
	buf.Write([]byte{0xD7, 0x81, trackNum})

	// TrackUID
	buf.Write([]byte{0x73, 0xC5, 0x88})
	uid := make([]byte, 8)
	binary.BigEndian.PutUint64(uid, uint64(trackNum))
	buf.Write(uid)

	// TrackType
	buf.Write([]byte{0x83, 0x81, trackType})

	// CodecID
	buf.WriteByte(0x86)
	buf.Write(vintEncode(uint64(len(codecID))))
	buf.WriteString(codecID)

	// TrackName
	buf.WriteByte(0x53)
	buf.WriteByte(0x6E)
	buf.Write(vintEncode(uint64(len(trackName))))
	buf.WriteString(trackName)

	// Language
	buf.Write([]byte{0x22, 0xB5, 0x9C})
	buf.Write(vintEncode(uint64(len(language))))
	buf.WriteString(language)

	// For video track, add some basic video info
	if trackType == TypeVideo {
		// Video element
		videoBuf := new(bytes.Buffer)
		// PixelWidth = 1920
		videoBuf.Write([]byte{0xB0, 0x82, 0x07, 0x80})
		// PixelHeight = 1080
		videoBuf.Write([]byte{0xBA, 0x82, 0x04, 0x38})

		buf.WriteByte(0xE0) // IDVideo
		buf.Write(vintEncode(uint64(videoBuf.Len())))
		buf.Write(videoBuf.Bytes())
	}

	// For audio track, add some basic audio info
	if trackType == TypeAudio {
		// Audio element
		audioBuf := new(bytes.Buffer)
		// SamplingFrequency = 44100.0 (as float64)
		samplingFreq := math.Float64bits(44100.0)
		audioBuf.Write([]byte{0xB5, 0x88})
		_ = binary.Write(audioBuf, binary.BigEndian, samplingFreq)
		// Channels = 1
		audioBuf.Write([]byte{0x9F, 0x81, 0x01})

		buf.WriteByte(0xE1) // IDAudio
		buf.Write(vintEncode(uint64(audioBuf.Len())))
		buf.Write(audioBuf.Bytes())
	}

	return buf.Bytes(), nil
}

// TestDemuxer tests the high-level Demuxer API with a real file.
func TestDemuxer(t *testing.T) {
	file, err := os.Open(testDemuxerFile)
	if err != nil {
		t.Skipf("Skipping demuxer test: could not open test file %s: %v", testDemuxerFile, err)
	}
	defer func() {
		_ = file.Close()
	}()

	demuxer, err := NewDemuxer(file)
	if err != nil {
		t.Fatalf("NewDemuxer() failed: %v", err)
	}
	defer demuxer.Close()

	// Test GetFileInfo
	fileInfo, err := demuxer.GetFileInfo()
	if err != nil {
		t.Fatalf("GetFileInfo() failed: %v", err)
	}
	if fileInfo == nil {
		t.Fatal("GetFileInfo() returned nil info")
	}
	if fileInfo.Title == "" {
		t.Log("Warning: File info title is empty")
	}

	// Test GetNumTracks and GetTrackInfo
	numTracks, err := demuxer.GetNumTracks()
	if err != nil {
		t.Fatalf("GetNumTracks() failed: %v", err)
	}
	if numTracks == 0 {
		t.Fatal("Expected at least one track")
	}

	for i := uint(0); i < numTracks; i++ {
		trackInfo, errGetTrackInfo := demuxer.GetTrackInfo(i)
		if errGetTrackInfo != nil {
			t.Fatalf("GetTrackInfo(%d) failed: %v", i, errGetTrackInfo)
		}
		if trackInfo == nil {
			t.Fatalf("GetTrackInfo(%d) returned nil info", i)
		}
	}

}


// createMockMatroskaFile creates a minimal valid Matroska file in memory.
func createMockMatroskaFile() ([]byte, error) {
	buf := new(bytes.Buffer)

	// EBML Header
	ebmlHeader := new(bytes.Buffer)
	ebmlHeader.Write([]byte{0x42, 0x82, 0x88, 'm', 'a', 't', 'r', 'o', 's', 'k', 'a'}) // DocType
	buf.Write([]byte{0x1A, 0x45, 0xDF, 0xA3})                                          // EBML Header ID
	buf.Write(vintEncode(uint64(ebmlHeader.Len())))
	buf.Write(ebmlHeader.Bytes())

	// Segment
	segment := new(bytes.Buffer)

	// -- SegmentInfo
	segInfo := new(bytes.Buffer)
	segInfo.Write([]byte{0x7B, 0xA9, 0x8A, 'T', 'e', 's', 't', ' ', 'T', 'i', 't', 'l', 'e'}) // Title
	segInfo.Write([]byte{0x2A, 0xD7, 0xB1, 0x83, 0x0F, 0x42, 0x40})                           // TimestampScale 1,000,000
	segment.Write([]byte{0x15, 0x49, 0xA9, 0x66})                                             // SegmentInfo ID
	segment.Write(vintEncode(uint64(segInfo.Len())))
	segment.Write(segInfo.Bytes())

	// -- Tracks
	trackEntry, _ := createMockTrackEntry(1, TypeVideo, "V_TEST", "TestVideo", "und")
	tracks := new(bytes.Buffer)
	tracks.Write([]byte{0xAE}) // TrackEntry ID
	tracks.Write(vintEncode(uint64(len(trackEntry))))
	tracks.Write(trackEntry)
	segment.Write([]byte{0x16, 0x54, 0xAE, 0x6B}) // Tracks ID
	segment.Write(vintEncode(uint64(tracks.Len())))
	segment.Write(tracks.Bytes())

	// -- Cluster
	cluster := new(bytes.Buffer)
	cluster.Write([]byte{0xE7, 0x81, 0x00}) // Timestamp 0
	// SimpleBlock: Track 1, Timecode 0, Flags 0x80 (Keyframe), Data "frame"
	blockData := []byte{0x81, 0x00, 0x00, 0x80, 'f', 'r', 'a', 'm', 'e'}
	cluster.Write([]byte{0xA3, byte(0x80 | len(blockData))})
	cluster.Write(blockData)
	segment.Write([]byte{0x1F, 0x43, 0xB6, 0x75}) // Cluster ID
	segment.Write(vintEncode(uint64(cluster.Len())))
	segment.Write(cluster.Bytes())

	buf.Write([]byte{0x18, 0x53, 0x80, 0x67}) // Segment ID
	// Unknown size for streaming
	buf.Write([]byte{0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF})
	buf.Write(segment.Bytes())

	return buf.Bytes(), nil
}

// TestNewDemuxer tests the NewDemuxer function with various inputs.
func TestNewDemuxer(t *testing.T) {
	t.Run("Valid Matroska file", func(t *testing.T) {
		// Create a mock Matroska file
		mockFile, err := createMockMatroskaFile()
		if err != nil {
			t.Fatalf("Failed to create mock matroska file: %v", err)
		}

		reader := bytes.NewReader(mockFile)
		demuxer, err := NewDemuxer(reader)
		if err != nil {
			t.Fatalf("NewDemuxer() failed: %v", err)
		}
		defer demuxer.Close()

		if demuxer == nil {
			t.Fatal("NewDemuxer() returned nil demuxer")
		}
		if demuxer.parser == nil {
			t.Fatal("Demuxer parser is nil")
		}
		if demuxer.reader == nil {
			t.Fatal("Demuxer reader is nil")
		}
	})

	t.Run("Invalid reader - empty", func(t *testing.T) {
		reader := bytes.NewReader([]byte{})
		d, err := NewDemuxer(reader)
		if err != nil {
			t.Fatalf("expected cluster-only fallback, got error: %v", err)
		}
		assertNoTracks(t, d)
	})

	t.Run("Invalid reader - non-Matroska format", func(t *testing.T) {
		// Create some random data that's not a valid Matroska file
		invalidData := []byte("This is not a Matroska file")
		reader := bytes.NewReader(invalidData)
		d, err := NewDemuxer(reader)
		if err != nil {
			t.Fatalf("expected cluster-only fallback, got error: %v", err)
		}
		assertNoTracks(t, d)
	})
}

// The demuxer does not reject non-Matroska input: NewMatroskaParser falls back
// to cluster-only parsing (it may be positioned mid-stream), so garbage input
// yields a demuxer with no tracks rather than an error.
func assertNoTracks(t *testing.T, d *Demuxer) {
	t.Helper()
	n, err := d.GetNumTracks()
	if err != nil {
		t.Fatalf("GetNumTracks: %v", err)
	}
	if n != 0 {
		t.Errorf("fallback demuxer has %d tracks, want 0", n)
	}
}



// TestDemuxer_Close tests the Close method.
func TestDemuxer_Close(t *testing.T) {
	t.Run("Close successful demuxer", func(t *testing.T) {
		mockFile, err := createMockMatroskaFile()
		if err != nil {
			t.Fatalf("Failed to create mock matroska file: %v", err)
		}

		reader := bytes.NewReader(mockFile)
		demuxer, err := NewDemuxer(reader)
		if err != nil {
			t.Fatalf("NewDemuxer() failed: %v", err)
		}

		demuxer.Close() // Close should not fail
	})

	t.Run("Close multiple times", func(t *testing.T) {
		mockFile, err := createMockMatroskaFile()
		if err != nil {
			t.Fatalf("Failed to create mock matroska file: %v", err)
		}

		reader := bytes.NewReader(mockFile)
		demuxer, err := NewDemuxer(reader)
		if err != nil {
			t.Fatalf("NewDemuxer() failed: %v", err)
		}

		// Close multiple times should not cause errors
		demuxer.Close()
		demuxer.Close() // Should be safe to call multiple times
	})
}

// TestDemuxer_GetTrackInfo tests the GetTrackInfo method.
func TestDemuxer_GetTrackInfo(t *testing.T) {
	mockFile, err := createMockMatroskaFile()
	if err != nil {
		t.Fatalf("Failed to create mock matroska file: %v", err)
	}

	reader := bytes.NewReader(mockFile)
	demuxer, err := NewDemuxer(reader)
	if err != nil {
		t.Fatalf("NewDemuxer() failed: %v", err)
	}
	defer demuxer.Close()

	t.Run("Valid track", func(t *testing.T) {
		trackInfo, errGetTrackInfo := demuxer.GetTrackInfo(0)
		if errGetTrackInfo != nil {
			t.Fatalf("GetTrackInfo(0) failed: %v", errGetTrackInfo)
		}
		if trackInfo == nil {
			t.Fatal("GetTrackInfo(0) returned nil")
		}
		if trackInfo.Number != 1 {
			t.Errorf("Expected track number 1, got %d", trackInfo.Number)
		}
		if trackInfo.Type != TypeVideo {
			t.Errorf("Expected track type %d, got %d", TypeVideo, trackInfo.Type)
		}
	})

	t.Run("Invalid track number", func(t *testing.T) {
		_, err = demuxer.GetTrackInfo(999)
		if err == nil {
			t.Errorf("Expected error for invalid track number, but got nil")
		}
	})
}

// TestDemuxer_GetFileInfo tests the GetFileInfo method.
func TestDemuxer_GetFileInfo(t *testing.T) {
	t.Run("Valid file info", func(t *testing.T) {
		mockFile, err := createMockMatroskaFile()
		if err != nil {
			t.Fatalf("Failed to create mock matroska file: %v", err)
		}

		reader := bytes.NewReader(mockFile)
		demuxer, err := NewDemuxer(reader)
		if err != nil {
			t.Fatalf("NewDemuxer() failed: %v", err)
		}
		defer demuxer.Close()

		fileInfo, err := demuxer.GetFileInfo()
		if err != nil {
			t.Fatalf("GetFileInfo() failed: %v", err)
		}
		if fileInfo == nil {
			t.Fatal("GetFileInfo() returned nil")
		}
		if fileInfo.Title != "Test Title" {
			t.Errorf("Expected title 'Test Title', got %q", fileInfo.Title)
		}
	})

	t.Run("No file info available", func(t *testing.T) {
		// Create a minimal Matroska file without SegmentInfo
		buf := new(bytes.Buffer)

		// EBML Header
		ebmlHeader := new(bytes.Buffer)
		ebmlHeader.Write([]byte{0x42, 0x82, 0x88, 'm', 'a', 't', 'r', 'o', 's', 'k', 'a'}) // DocType
		buf.Write([]byte{0x1A, 0x45, 0xDF, 0xA3})                                          // EBML Header ID
		buf.Write(vintEncode(uint64(ebmlHeader.Len())))
		buf.Write(ebmlHeader.Bytes())

		// Segment without SegmentInfo
		segment := new(bytes.Buffer)
		// Just add an empty Tracks element
		tracks := new(bytes.Buffer)
		segment.Write([]byte{0x16, 0x54, 0xAE, 0x6B}) // Tracks ID
		segment.Write(vintEncode(uint64(tracks.Len())))
		segment.Write(tracks.Bytes())

		buf.Write([]byte{0x18, 0x53, 0x80, 0x67}) // Segment ID
		buf.Write(vintEncode(uint64(segment.Len())))
		buf.Write(segment.Bytes())

		reader := bytes.NewReader(buf.Bytes())
		demuxer, err := NewDemuxer(reader)
		if err != nil {
			t.Fatalf("NewDemuxer() failed: %v", err)
		}
		defer demuxer.Close()

		_, err = demuxer.GetFileInfo()
		if err == nil {
			t.Errorf("Expected error when no file info available, but got nil")
		}
	})
}

// createMockMatroskaFileWithAttachments creates a mock Matroska file with attachments.
func createMockMatroskaFileWithAttachments() ([]byte, error) {
	buf := new(bytes.Buffer)

	// EBML Header
	ebmlHeader := new(bytes.Buffer)
	ebmlHeader.Write([]byte{0x42, 0x82, 0x88, 'm', 'a', 't', 'r', 'o', 's', 'k', 'a'}) // DocType
	buf.Write([]byte{0x1A, 0x45, 0xDF, 0xA3})                                          // EBML Header ID
	buf.Write(vintEncode(uint64(ebmlHeader.Len())))
	buf.Write(ebmlHeader.Bytes())

	// Segment
	segment := new(bytes.Buffer)

	// -- SegmentInfo
	segInfo := new(bytes.Buffer)
	segInfo.Write([]byte{0x7B, 0xA9, 0x8A, 'T', 'e', 's', 't', ' ', 'T', 'i', 't', 'l', 'e'}) // Title
	segInfo.Write([]byte{0x2A, 0xD7, 0xB1, 0x83, 0x0F, 0x42, 0x40})                           // TimestampScale 1,000,000
	segment.Write([]byte{0x15, 0x49, 0xA9, 0x66})                                             // SegmentInfo ID
	segment.Write(vintEncode(uint64(segInfo.Len())))
	segment.Write(segInfo.Bytes())

	// -- Tracks
	trackEntry, _ := createMockTrackEntry(1, TypeVideo, "V_TEST", "TestVideo", "und")
	tracks := new(bytes.Buffer)
	tracks.Write([]byte{0xAE}) // TrackEntry ID
	tracks.Write(vintEncode(uint64(len(trackEntry))))
	tracks.Write(trackEntry)
	segment.Write([]byte{0x16, 0x54, 0xAE, 0x6B}) // Tracks ID
	segment.Write(vintEncode(uint64(tracks.Len())))
	segment.Write(tracks.Bytes())

	// -- Attachments
	attachments := new(bytes.Buffer)

	// AttachedFile 1
	attachedFile1 := new(bytes.Buffer)
	attachedFile1.Write([]byte{0x46, 0x6E, 0x88, 't', 'e', 's', 't', '.', 't', 'x', 't'})           // FileName
	attachedFile1.Write([]byte{0x46, 0x60, 0x8A, 't', 'e', 'x', 't', '/', 'p', 'l', 'a', 'i', 'n'}) // FileMimeType
	attachedFile1.Write([]byte{0x46, 0x5C, 0x85, 'h', 'e', 'l', 'l', 'o'})                          // FileData
	attachedFile1.Write([]byte{0x46, 0xAE, 0x81, 0x01})                                             // FileUID

	attachments.Write([]byte{0x61, 0xA7}) // AttachedFile ID
	attachments.Write(vintEncode(uint64(attachedFile1.Len())))
	attachments.Write(attachedFile1.Bytes())

	segment.Write([]byte{0x19, 0x41, 0xA4, 0x69}) // Attachments ID
	segment.Write(vintEncode(uint64(attachments.Len())))
	segment.Write(attachments.Bytes())

	buf.Write([]byte{0x18, 0x53, 0x80, 0x67}) // Segment ID
	buf.Write(vintEncode(uint64(segment.Len())))
	buf.Write(segment.Bytes())

	return buf.Bytes(), nil
}

// TestDemuxer_GetAttachments tests the GetAttachments method.
func TestDemuxer_GetAttachments(t *testing.T) {
	t.Run("File with attachments", func(t *testing.T) {
		mockFile, err := createMockMatroskaFileWithAttachments()
		if err != nil {
			t.Fatalf("Failed to create mock matroska file with attachments: %v", err)
		}

		reader := bytes.NewReader(mockFile)
		demuxer, err := NewDemuxer(reader)
		if err != nil {
			t.Fatalf("NewDemuxer() failed: %v", err)
		}
		defer demuxer.Close()

		attachments := demuxer.GetAttachments()
		if len(attachments) == 0 {
			t.Fatal("Expected at least one attachment, got none")
		}

		attachment := attachments[0]
		if attachment.Name != "test.txt" {
			t.Errorf("Expected attachment name 'test.txt', got %q", attachment.Name)
		}
		if attachment.MimeType != "text/plain" {
			t.Errorf("Expected MIME type 'text/plain', got %q", attachment.MimeType)
		}
		if attachment.UID != 1 {
			t.Errorf("Expected UID 1, got %d", attachment.UID)
		}
	})

	t.Run("File without attachments", func(t *testing.T) {
		mockFile, err := createMockMatroskaFile()
		if err != nil {
			t.Fatalf("Failed to create mock matroska file: %v", err)
		}

		reader := bytes.NewReader(mockFile)
		demuxer, err := NewDemuxer(reader)
		if err != nil {
			t.Fatalf("NewDemuxer() failed: %v", err)
		}
		defer demuxer.Close()

		attachments := demuxer.GetAttachments()
		if len(attachments) != 0 {
			t.Errorf("Expected no attachments, got %d", len(attachments))
		}
	})
}

// createMockMatroskaFileWithChapters creates a mock Matroska file with chapters.
func createMockMatroskaFileWithChapters() ([]byte, error) {
	buf := new(bytes.Buffer)

	// EBML Header
	ebmlHeader := new(bytes.Buffer)
	ebmlHeader.Write([]byte{0x42, 0x82, 0x88, 'm', 'a', 't', 'r', 'o', 's', 'k', 'a'}) // DocType
	buf.Write([]byte{0x1A, 0x45, 0xDF, 0xA3})                                          // EBML Header ID
	buf.Write(vintEncode(uint64(ebmlHeader.Len())))
	buf.Write(ebmlHeader.Bytes())

	// Segment
	segment := new(bytes.Buffer)

	// -- SegmentInfo
	segInfo := new(bytes.Buffer)
	segInfo.Write([]byte{0x7B, 0xA9, 0x8A, 'T', 'e', 's', 't', ' ', 'T', 'i', 't', 'l', 'e'}) // Title
	segInfo.Write([]byte{0x2A, 0xD7, 0xB1, 0x83, 0x0F, 0x42, 0x40})                           // TimestampScale 1,000,000
	segment.Write([]byte{0x15, 0x49, 0xA9, 0x66})                                             // SegmentInfo ID
	segment.Write(vintEncode(uint64(segInfo.Len())))
	segment.Write(segInfo.Bytes())

	// -- Tracks
	trackEntry, _ := createMockTrackEntry(1, TypeVideo, "V_TEST", "TestVideo", "und")
	tracks := new(bytes.Buffer)
	tracks.Write([]byte{0xAE}) // TrackEntry ID
	tracks.Write(vintEncode(uint64(len(trackEntry))))
	tracks.Write(trackEntry)
	segment.Write([]byte{0x16, 0x54, 0xAE, 0x6B}) // Tracks ID
	segment.Write(vintEncode(uint64(tracks.Len())))
	segment.Write(tracks.Bytes())

	// -- Chapters
	chapters := new(bytes.Buffer)

	// EditionEntry
	editionEntry := new(bytes.Buffer)

	// ChapterAtom
	chapterAtom := new(bytes.Buffer)
	// ChapterUID: 1
	chapterAtom.Write([]byte{0x73, 0xC4, 0x81, 0x01})
	// ChapterTimeStart: 0 (0 nanoseconds)
	chapterAtom.Write([]byte{0x91, 0x81, 0x00})
	// ChapterDisplay
	chapterDisplay := new(bytes.Buffer)
	// ChapterString: "Chapter 1"
	chapterDisplay.Write([]byte{0x85, 0x89, 'C', 'h', 'a', 'p', 't', 'e', 'r', ' ', '1'})
	// ChapterLanguage: "eng"
	chapterDisplay.Write([]byte{0x43, 0x7C, 0x83, 'e', 'n', 'g'})

	chapterAtom.Write([]byte{0x80}) // ChapterDisplay ID
	chapterAtom.Write(vintEncode(uint64(chapterDisplay.Len())))
	chapterAtom.Write(chapterDisplay.Bytes())

	editionEntry.Write([]byte{0xB6}) // ChapterAtom ID
	editionEntry.Write(vintEncode(uint64(chapterAtom.Len())))
	editionEntry.Write(chapterAtom.Bytes())

	chapters.Write([]byte{0x45, 0xB9}) // EditionEntry ID
	chapters.Write(vintEncode(uint64(editionEntry.Len())))
	chapters.Write(editionEntry.Bytes())

	segment.Write([]byte{0x10, 0x43, 0xA7, 0x70}) // Chapters ID
	segment.Write(vintEncode(uint64(chapters.Len())))
	segment.Write(chapters.Bytes())

	buf.Write([]byte{0x18, 0x53, 0x80, 0x67}) // Segment ID
	buf.Write(vintEncode(uint64(segment.Len())))
	buf.Write(segment.Bytes())

	return buf.Bytes(), nil
}

// TestDemuxer_GetChapters tests the GetChapters method.
func TestDemuxer_GetChapters(t *testing.T) {
	t.Run("File with chapters", func(t *testing.T) {
		mockFile, err := createMockMatroskaFileWithChapters()
		if err != nil {
			t.Fatalf("Failed to create mock matroska file with chapters: %v", err)
		}

		reader := bytes.NewReader(mockFile)
		demuxer, err := NewDemuxer(reader)
		if err != nil {
			t.Fatalf("NewDemuxer() failed: %v", err)
		}
		defer demuxer.Close()

		chapters := demuxer.GetChapters()
		if len(chapters) == 0 {
			t.Fatal("Expected at least one chapter, got none")
		}

		chapter := chapters[0]
		if chapter.UID != 1 {
			t.Errorf("Expected chapter UID 1, got %d", chapter.UID)
		}
		if chapter.Start != 0 {
			t.Errorf("Expected chapter start time 0, got %d", chapter.Start)
		}
		if len(chapter.Display) == 0 {
			t.Fatal("Expected chapter display information, got none")
		}
		if chapter.Display[0].String != "Chapter 1" {
			t.Errorf("Expected chapter string 'Chapter 1', got %q", chapter.Display[0].String)
		}
		if chapter.Display[0].Language != "eng" {
			t.Errorf("Expected chapter language 'eng', got %q", chapter.Display[0].Language)
		}
	})

	t.Run("File without chapters", func(t *testing.T) {
		mockFile, err := createMockMatroskaFile()
		if err != nil {
			t.Fatalf("Failed to create mock matroska file: %v", err)
		}

		reader := bytes.NewReader(mockFile)
		demuxer, err := NewDemuxer(reader)
		if err != nil {
			t.Fatalf("NewDemuxer() failed: %v", err)
		}
		defer demuxer.Close()

		chapters := demuxer.GetChapters()
		if len(chapters) != 0 {
			t.Errorf("Expected no chapters, got %d", len(chapters))
		}
	})
}

// createMockMatroskaFileWithTags creates a mock Matroska file with tags.
func createMockMatroskaFileWithTags() ([]byte, error) {
	buf := new(bytes.Buffer)

	// EBML Header
	ebmlHeader := new(bytes.Buffer)
	ebmlHeader.Write([]byte{0x42, 0x82, 0x88, 'm', 'a', 't', 'r', 'o', 's', 'k', 'a'}) // DocType
	buf.Write([]byte{0x1A, 0x45, 0xDF, 0xA3})                                          // EBML Header ID
	buf.Write(vintEncode(uint64(ebmlHeader.Len())))
	buf.Write(ebmlHeader.Bytes())

	// Segment
	segment := new(bytes.Buffer)

	// -- SegmentInfo
	segInfo := new(bytes.Buffer)
	segInfo.Write([]byte{0x7B, 0xA9, 0x8A, 'T', 'e', 's', 't', ' ', 'T', 'i', 't', 'l', 'e'}) // Title
	segInfo.Write([]byte{0x2A, 0xD7, 0xB1, 0x83, 0x0F, 0x42, 0x40})                           // TimestampScale 1,000,000
	segment.Write([]byte{0x15, 0x49, 0xA9, 0x66})                                             // SegmentInfo ID
	segment.Write(vintEncode(uint64(segInfo.Len())))
	segment.Write(segInfo.Bytes())

	// -- Tracks
	trackEntry, _ := createMockTrackEntry(1, TypeVideo, "V_TEST", "TestVideo", "und")
	tracks := new(bytes.Buffer)
	tracks.Write([]byte{0xAE}) // TrackEntry ID
	tracks.Write(vintEncode(uint64(len(trackEntry))))
	tracks.Write(trackEntry)
	segment.Write([]byte{0x16, 0x54, 0xAE, 0x6B}) // Tracks ID
	segment.Write(vintEncode(uint64(tracks.Len())))
	segment.Write(tracks.Bytes())

	// -- Tags
	tags := new(bytes.Buffer)

	// Tag 1
	tag1 := new(bytes.Buffer)

	// Targets
	targets := new(bytes.Buffer)
	targets.Write([]byte{0x68, 0xCA, 0x81, 0x32}) // TargetTypeValue = 50 (ALBUM)
	tag1.Write([]byte{0x63, 0xC0})                // Targets ID
	tag1.Write(vintEncode(uint64(targets.Len())))
	tag1.Write(targets.Bytes())

	// SimpleTag
	simpleTag := new(bytes.Buffer)
	simpleTag.Write([]byte{0x45, 0xA3, 0x85, 'T', 'I', 'T', 'L', 'E'})                          // TagName = "TITLE"
	simpleTag.Write([]byte{0x44, 0x87, 0x8A, 'T', 'e', 's', 't', ' ', 'A', 'l', 'b', 'u', 'm'}) // TagString = "Test Album"
	tag1.Write([]byte{0x67, 0xC8})                                                              // SimpleTag ID
	tag1.Write(vintEncode(uint64(simpleTag.Len())))
	tag1.Write(simpleTag.Bytes())

	tags.Write([]byte{0x73, 0x73}) // Tag ID
	tags.Write(vintEncode(uint64(tag1.Len())))
	tags.Write(tag1.Bytes())

	segment.Write([]byte{0x12, 0x54, 0xC3, 0x67}) // Tags ID
	segment.Write(vintEncode(uint64(tags.Len())))
	segment.Write(tags.Bytes())

	buf.Write([]byte{0x18, 0x53, 0x80, 0x67}) // Segment ID
	buf.Write(vintEncode(uint64(segment.Len())))
	buf.Write(segment.Bytes())

	return buf.Bytes(), nil
}

// TestDemuxer_GetTags tests the GetTags method.
func TestDemuxer_GetTags(t *testing.T) {
	t.Run("File with tags", func(t *testing.T) {
		mockFile, err := createMockMatroskaFileWithTags()
		if err != nil {
			t.Fatalf("Failed to create mock matroska file with tags: %v", err)
		}

		reader := bytes.NewReader(mockFile)
		demuxer, err := NewDemuxer(reader)
		if err != nil {
			t.Fatalf("NewDemuxer() failed: %v", err)
		}
		defer demuxer.Close()

		tags := demuxer.GetTags()
		if len(tags) == 0 {
			t.Fatal("Expected at least one tag, got none")
		}

		tag := tags[0]
		if len(tag.Targets) == 0 {
			t.Fatal("Expected tag targets, got none")
		}
		if tag.Targets[0].Type != 50 {
			t.Errorf("Expected target type 50, got %d", tag.Targets[0].Type)
		}
		if len(tag.SimpleTags) == 0 {
			t.Fatal("Expected simple tags, got none")
		}
		if tag.SimpleTags[0].Name != "TITLE" {
			t.Errorf("Expected tag name 'TITLE', got %q", tag.SimpleTags[0].Name)
		}
		if tag.SimpleTags[0].Value != "Test Album" {
			t.Errorf("Expected tag value 'Test Album', got %q", tag.SimpleTags[0].Value)
		}
	})

	t.Run("File without tags", func(t *testing.T) {
		mockFile, err := createMockMatroskaFile()
		if err != nil {
			t.Fatalf("Failed to create mock matroska file: %v", err)
		}

		reader := bytes.NewReader(mockFile)
		demuxer, err := NewDemuxer(reader)
		if err != nil {
			t.Fatalf("NewDemuxer() failed: %v", err)
		}
		defer demuxer.Close()

		tags := demuxer.GetTags()
		if len(tags) != 0 {
			t.Errorf("Expected no tags, got %d", len(tags))
		}
	})
}

// createMockMatroskaFileWithCues creates a mock Matroska file with cues.
func createMockMatroskaFileWithCues() ([]byte, error) {
	buf := new(bytes.Buffer)

	// EBML Header
	ebmlHeader := new(bytes.Buffer)
	ebmlHeader.Write([]byte{0x42, 0x82, 0x88, 'm', 'a', 't', 'r', 'o', 's', 'k', 'a'}) // DocType
	buf.Write([]byte{0x1A, 0x45, 0xDF, 0xA3})                                          // EBML Header ID
	buf.Write(vintEncode(uint64(ebmlHeader.Len())))
	buf.Write(ebmlHeader.Bytes())

	// Segment
	segment := new(bytes.Buffer)

	// -- SegmentInfo
	segInfo := new(bytes.Buffer)
	segInfo.Write([]byte{0x7B, 0xA9, 0x8A, 'T', 'e', 's', 't', ' ', 'T', 'i', 't', 'l', 'e'}) // Title
	segInfo.Write([]byte{0x2A, 0xD7, 0xB1, 0x83, 0x0F, 0x42, 0x40})                           // TimestampScale 1,000,000
	segment.Write([]byte{0x15, 0x49, 0xA9, 0x66})                                             // SegmentInfo ID
	segment.Write(vintEncode(uint64(segInfo.Len())))
	segment.Write(segInfo.Bytes())

	// -- Tracks
	trackEntry, _ := createMockTrackEntry(1, TypeVideo, "V_TEST", "TestVideo", "und")
	tracks := new(bytes.Buffer)
	tracks.Write([]byte{0xAE}) // TrackEntry ID
	tracks.Write(vintEncode(uint64(len(trackEntry))))
	tracks.Write(trackEntry)
	segment.Write([]byte{0x16, 0x54, 0xAE, 0x6B}) // Tracks ID
	segment.Write(vintEncode(uint64(tracks.Len())))
	segment.Write(tracks.Bytes())

	// -- Cues
	cues := new(bytes.Buffer)

	// CuePoint 1
	cuePoint1 := new(bytes.Buffer)
	// CueTime: 1000
	cuePoint1.Write([]byte{0xB3, 0x82, 0x03, 0xE8})
	// CueTrackPositions
	cueTrackPositions := new(bytes.Buffer)
	// CueTrack: 1
	cueTrackPositions.Write([]byte{0xF7, 0x81, 0x01})
	// CueClusterPosition: 100
	cueTrackPositions.Write([]byte{0xF1, 0x81, 0x64})
	cuePoint1.Write([]byte{0xB7}) // CueTrackPositions ID
	cuePoint1.Write(vintEncode(uint64(cueTrackPositions.Len())))
	cuePoint1.Write(cueTrackPositions.Bytes())

	cues.Write([]byte{0xBB}) // CuePoint ID
	cues.Write(vintEncode(uint64(cuePoint1.Len())))
	cues.Write(cuePoint1.Bytes())

	segment.Write([]byte{0x1C, 0x53, 0xBB, 0x6B}) // Cues ID
	segment.Write(vintEncode(uint64(cues.Len())))
	segment.Write(cues.Bytes())

	buf.Write([]byte{0x18, 0x53, 0x80, 0x67}) // Segment ID
	buf.Write(vintEncode(uint64(segment.Len())))
	buf.Write(segment.Bytes())

	return buf.Bytes(), nil
}

// TestDemuxer_GetCues tests the GetCues method.
func TestDemuxer_GetCues(t *testing.T) {
	t.Run("File with cues", func(t *testing.T) {
		mockFile, err := createMockMatroskaFileWithCues()
		if err != nil {
			t.Fatalf("Failed to create mock matroska file with cues: %v", err)
		}

		reader := bytes.NewReader(mockFile)
		demuxer, err := NewDemuxer(reader)
		if err != nil {
			t.Fatalf("NewDemuxer() failed: %v", err)
		}
		defer demuxer.Close()

		cues := demuxer.GetCues()
		if len(cues) == 0 {
			t.Fatal("Expected at least one cue, got none")
		}

		cue := cues[0]
		if cue.Time != 1000000000 {
			t.Errorf("Expected cue time 1000000000, got %d", cue.Time)
		}
		if cue.Track != 1 {
			t.Errorf("Expected cue track 1, got %d", cue.Track)
		}
		if cue.Position != 100 {
			t.Errorf("Expected cue position 100, got %d", cue.Position)
		}
	})

	t.Run("File without cues", func(t *testing.T) {
		mockFile, err := createMockMatroskaFile()
		if err != nil {
			t.Fatalf("Failed to create mock matroska file: %v", err)
		}

		reader := bytes.NewReader(mockFile)
		demuxer, err := NewDemuxer(reader)
		if err != nil {
			t.Fatalf("NewDemuxer() failed: %v", err)
		}
		defer demuxer.Close()

		cues := demuxer.GetCues()
		if len(cues) != 0 {
			t.Errorf("Expected no cues, got %d", len(cues))
		}
	})
}




