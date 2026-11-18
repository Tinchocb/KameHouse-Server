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
