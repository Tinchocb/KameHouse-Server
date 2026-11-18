package matroska

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"sort"
)

// parseTracks parses track information from the Matroska file.
//
// The Tracks element contains information about all media tracks in the file,
// including video, audio, and subtitle tracks. This method reads the Tracks
// element and populates the tracks field of the MatroskaParser with the parsed
// track information.
//
// Each track is represented by a TrackEntry element, which contains detailed
// information about the track, such as its number, type, codec, and other
// properties. This method calls parseTrackEntry() for each TrackEntry element
// to parse the individual track information.
//
// After parsing all tracks, this method sorts them by track number to ensure
// they are in the correct order.
//
// Parameters:
//   - size: The size of the Tracks element in bytes.
//
// Returns:
//   - error: An error if the Tracks element could not be read or parsed.
func (mp *MatroskaParser) parseTracks(size uint64) error {
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

		if element.ID != IDTrackEntry {
			continue
		}

		trackInfo, errParseTrackEntry := mp.parseTrackEntry(element.Data)
		if errParseTrackEntry != nil {
			return fmt.Errorf("failed to parse track entry: %w", errParseTrackEntry)
		}
		mp.tracks = append(mp.tracks, trackInfo)
	}

	// Sort tracks by track number
	sort.Slice(mp.tracks, func(i, j int) bool {
		return mp.tracks[i].Number < mp.tracks[j].Number
	})

	return nil
}

// parseTrackEntry parses a single track entry from the Matroska file.
//
// A TrackEntry element contains detailed information about a single media track,
// such as its number, type, codec, and other properties. This method reads the
// TrackEntry element and returns a TrackInfo struct populated with the parsed data.
//
// The TrackEntry element can contain the following child elements:
//   - TrackNumber: The track number used to identify the track.
//   - TrackUID: A unique identifier for the track.
//   - TrackType: The type of the track (video, audio, subtitle, etc.).
//   - TrackName: A human-readable name for the track.
//   - Language: The language of the track (e.g., "eng" for English).
//   - CodecID: The identifier for the codec used to encode the track.
//   - CodecPrivate: Private data for the codec.
//   - Video: Video-specific information (parsed by parseVideoTrack).
//   - Audio: Audio-specific information (parsed by parseAudioTrack).
//
// This method initializes a TrackInfo struct with default values and then updates
// it with the values found in the TrackEntry element. If the track is a video
// or audio track, it calls the appropriate parsing method to handle the
// track-specific information.
//
// Parameters:
//   - data: The raw data of the TrackEntry element.
//
// Returns:
//   - *TrackInfo: A pointer to the parsed TrackInfo struct.
//   - error: An error if the TrackEntry element could not be parsed.
func (mp *MatroskaParser) parseTrackEntry(data []byte) (*TrackInfo, error) {
	track := &TrackInfo{
		Enabled:       true, // Default values
		Default:       true,
		Lacing:        true,
		TimecodeScale: 1.0,
		Language:      "eng",
	}

	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	for childReader.pos < int64(len(data)) {
		element, err := childReader.ReadElement()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, err
		}

		switch element.ID {
		case IDTrackNum:
			track.Number = uint8(element.ReadUInt())
		case IDTrackUID:
			track.UID = element.ReadUInt()
		case IDTrackType:
			track.Type = uint8(element.ReadUInt())
		case IDTrackName:
			track.Name = element.ReadString()
		case IDLanguage:
			if len(element.Data) >= 3 {
				track.Language = string(element.Data[:3])
			}
		case IDLanguageIETF:
			track.LanguageIETF = element.ReadString()
		case IDCodecID:
			track.CodecID = element.ReadString()
		case IDCodecPriv:
			track.CodecPrivate = element.ReadBytes()
		case IDVideo:
			if err = mp.parseVideoTrack(element.Data, track); err != nil {
				return nil, err
			}
		case IDAudio:
			if err = mp.parseAudioTrack(element.Data, track); err != nil {
				return nil, err
			}
		case IDDefaultDuration:
			track.DefaultDuration = element.ReadUInt()
		case IDContentEncodings:
			if err = mp.parseContentEncodings(element.Data, track); err != nil {
				return nil, err
			}
		}
	}

	return track, nil
}

// parseContentEncodings parses content encoding information from the Matroska file.
//
// The ContentEncodings element contains information about any transformations
// that have been applied to the track data, such as compression or encryption.
// This method parses the ContentEncodings element and extracts compression
// information, which is stored in the TrackInfo struct.
//
// The ContentEncodings element can contain one or more ContentEncoding elements.
// Each ContentEncoding can specify:
//   - ContentEncodingOrder: The order in which to apply the encoding
//   - ContentEncodingScope: What kind of data to apply the encoding to
//   - ContentEncodingType: The type of encoding (compression or encryption)
//   - ContentCompression: Compression settings
//   - ContentCompAlgo: The compression algorithm used
//   - ContentCompSettings: Private data for the compression algorithm
//   - ContentEncryption: Encryption settings (currently not parsed)
//
// Currently, this implementation only handles compression encodings and extracts
// the compression algorithm and any private data required by the decompressor.
//
// Parameters:
//   - data: The raw data of the ContentEncodings element.
//   - track: A pointer to the TrackInfo struct to be updated with the parsed data.
//
// Returns:
//   - error: An error if the ContentEncodings element could not be parsed.
func (mp *MatroskaParser) parseContentEncodings(data []byte, track *TrackInfo) error {
	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	for childReader.pos < int64(len(data)) {
		element, err := childReader.ReadElement()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return err
		}

		if element.ID == IDContentEncoding {
			if err = mp.parseContentEncoding(element.Data, track); err != nil {
				return err
			}
		}
	}

	return nil
}

// parseContentEncoding parses a single content encoding entry from the Matroska file.
//
// This method processes a ContentEncoding element, which describes a single
// transformation applied to the track data. It extracts information about
// compression settings and stores them in the TrackInfo struct.
//
// Parameters:
//   - data: The raw data of the ContentEncoding element.
//   - track: A pointer to the TrackInfo struct to be updated with the parsed data.
//
// Returns:
//   - error: An error if the ContentEncoding element could not be parsed.
func (mp *MatroskaParser) parseContentEncoding(data []byte, track *TrackInfo) error {
	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	for childReader.pos < int64(len(data)) {
		element, err := childReader.ReadElement()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return err
		}

		switch element.ID {
		case IDContentEncodingType:
			// 0 = Compression, 1 = Encryption
			encodingType := element.ReadUInt()
			if encodingType == 0 {
				track.CompEnabled = true
			}
		case IDContentCompression:
			if err = mp.parseContentCompression(element.Data, track); err != nil {
				return err
			}
		}
	}

	return nil
}

// parseContentCompression parses content compression settings from the Matroska file.
//
// The ContentCompression element contains details about the compression algorithm
// used for the track and any private data required by the decompressor.
//
// Compression algorithms:
//   - 0 = zlib
//   - 1 = bzlib (not supported by most players)
//   - 2 = lzo1x (not supported by most players)
//   - 3 = Header Stripping (often used for removing codec headers)
//
// Parameters:
//   - data: The raw data of the ContentCompression element.
//   - track: A pointer to the TrackInfo struct to be updated with the parsed data.
//
// Returns:
//   - error: An error if the ContentCompression element could not be parsed.
func (mp *MatroskaParser) parseContentCompression(data []byte, track *TrackInfo) error {
	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	// Note: Sometimes ContentCompression is present even without data, so just set it to true
	track.CompEnabled = true

	for childReader.pos < int64(len(data)) {
		element, err := childReader.ReadElement()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return err
		}

		switch element.ID {
		case IDContentCompAlgo:
			track.CompMethod = uint32(element.ReadUInt())
		case IDContentCompSettings:
			track.CompMethodPrivate = element.ReadBytes()
		}
	}

	return nil
}

// parseVideoTrack parses video track information from the Matroska file.
//
// The Video element contains video-specific information for a track, such as
// pixel dimensions, display dimensions, and interlacing settings. This method
// reads the Video element and populates the Video field of the TrackInfo struct
// with the parsed data.
//
// The Video element can contain the following child elements:
//   - PixelWidth: The width of the video in pixels.
//   - PixelHeight: The height of the video in pixels.
//   - DisplayWidth: The width of the video when displayed (may differ from pixel width).
//   - DisplayHeight: The height of the video when displayed (may differ from pixel height).
//   - FlagInterlaced: Indicates whether the video is interlaced.
//
// If the display dimensions are not specified in the file, this method sets them
// to the pixel dimensions as a fallback.
//
// Parameters:
//   - data: The raw data of the Video element.
//   - track: A pointer to the TrackInfo struct to be updated with the parsed data.
//
// Returns:
//   - error: An error if the Video element could not be parsed.
func (mp *MatroskaParser) parseVideoTrack(data []byte, track *TrackInfo) error {
	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	for childReader.pos < int64(len(data)) {
		element, err := childReader.ReadElement()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return err
		}

		switch element.ID {
		case IDPixelWidth:
			track.Video.PixelWidth = uint32(element.ReadUInt())
		case IDPixelHeight:
			track.Video.PixelHeight = uint32(element.ReadUInt())
		case IDDisplayWidth:
			track.Video.DisplayWidth = uint32(element.ReadUInt())
		case IDDisplayHeight:
			track.Video.DisplayHeight = uint32(element.ReadUInt())
		case IDFlagInterlaced:
			track.Video.Interlaced = element.ReadUInt() != 0
		}
	}

	// Set display dimensions to pixel dimensions if not specified
	if track.Video.DisplayWidth == 0 {
		track.Video.DisplayWidth = track.Video.PixelWidth
	}
	if track.Video.DisplayHeight == 0 {
		track.Video.DisplayHeight = track.Video.PixelHeight
	}

	return nil
}

// parseAudioTrack parses audio track information from the Matroska file.
//
// The Audio element contains audio-specific information for a track, such as
// sampling frequency, number of channels, and bit depth. This method reads the
// Audio element and populates the Audio field of the TrackInfo struct with the
// parsed data.
//
// The Audio element can contain the following child elements:
//   - SamplingFrequency: The sampling frequency of the audio in Hz.
//   - OutputSamplingFrequency: The output sampling frequency of the audio in Hz.
//   - Channels: The number of audio channels.
//   - BitDepth: The number of bits per sample.
//
// This method sets default values for the audio track (1 channel, 8000.0 Hz sampling
// frequency) before parsing the element. If the output sampling frequency is not
// specified in the file, this method sets it to the sampling frequency as a fallback.
//
// Parameters:
//   - data: The raw data of the Audio element.
//   - track: A pointer to the TrackInfo struct to be updated with the parsed data.
//
// Returns:
//   - error: An error if the Audio element could not be parsed.
func (mp *MatroskaParser) parseAudioTrack(data []byte, track *TrackInfo) error {
	// Set defaults
	track.Audio.Channels = 1
	track.Audio.SamplingFreq = 8000.0

	reader := bytes.NewReader(data)
	childReader := &EBMLReader{r: &seekableReader{reader}, pos: 0}

	for childReader.pos < int64(len(data)) {
		element, err := childReader.ReadElement()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return err
		}

		switch element.ID {
		case IDSamplingFrequency:
			track.Audio.SamplingFreq = element.ReadFloat()
		case IDOutputSamplingFrequency:
			track.Audio.OutputSamplingFreq = element.ReadFloat()
		case IDChannels:
			track.Audio.Channels = uint8(element.ReadUInt())
		case IDBitDepth:
			track.Audio.BitDepth = uint8(element.ReadUInt())
		}
	}

	// Set output sampling frequency if not specified
	if track.Audio.OutputSamplingFreq == 0 {
		track.Audio.OutputSamplingFreq = track.Audio.SamplingFreq
	}

	return nil
}
