package mkvparser

// VideoTrack contains video-specific track data
type VideoTrack struct {
	PixelWidth  uint64
	PixelHeight uint64
}

// AudioTrack contains audio-specific track data
type AudioTrack struct {
	SamplingFrequency float64
	Channels          uint64
	BitDepth          uint64
}

// ContentEncodings contains information about how the track data is encoded
type ContentEncodings struct {
	ContentEncoding []ContentEncoding
}

// ContentEncoding describes a single encoding applied to the track data
type ContentEncoding struct {
	ContentEncodingOrder uint64
	ContentEncodingScope uint64
	ContentEncodingType  uint64
	ContentCompression   *ContentCompression
}

// ContentCompression describes how the track data is compressed
type ContentCompression struct {
	ContentCompAlgo     uint64
	ContentCompSettings []byte
}

