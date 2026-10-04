// Package matroska provides a pure Go implementation for parsing and demuxing Matroska/EBML files.
//
// Matroska is an open standard, free container format, a file format that can hold an unlimited
// number of video, audio, picture, or subtitle tracks in one file. It is intended to serve as
// a universal format for storing common multimedia content, like movies or TV shows.
//
// This package provides a high-level API for reading Matroska files, extracting track information,
// and reading media packets. The main entry point is the Demuxer struct, which can be created
// using either NewDemuxer for seekable inputs or NewStreamingDemuxer for non-seekable streams.
//
// Basic usage:
//
//	// Open a Matroska file
//	file, err := os.Open("video.mkv")
//	if err != nil {
//	    log.Fatal(err)
//	}
//	defer file.Close()
//
//	// Create a new demuxer
//	demuxer, err := matroska.NewDemuxer(file)
//	if err != nil {
//	    log.Fatal(err)
//	}
//	defer demuxer.Close()
//
//	// Get file information
//	fileInfo, err := demuxer.GetFileInfo()
//	if err != nil {
//	    log.Fatal(err)
//	}
//
//	// Get track information
//	numTracks, err := demuxer.GetNumTracks()
//	if err != nil {
//	    log.Fatal(err)
//	}
//
//	for i := uint(0); i < numTracks; i++ {
//	    trackInfo, err := demuxer.GetTrackInfo(i)
//	    if err != nil {
//	        log.Fatal(err)
//	    }
//	    fmt.Printf("Track %d: %s\n", i, trackInfo.Name)
//	}
//
//	// Read packets
//	for {
//	    packet, err := demuxer.ReadPacket()
//	    if err != nil {
//	        if err == io.EOF {
//	            break
//	        }
//	        log.Fatal(err)
//	    }
//	    // Process packet...
//	}
package matroska

import (
	"fmt"
	"io"
)

// Demuxer is a Matroska demuxer using pure Go implementation.
//
// The Demuxer struct provides the main interface for parsing and reading Matroska files.
// It encapsulates the underlying parser and provides methods for accessing track information,
// file metadata, and reading media packets. The Demuxer can work with both seekable and
// non-seekable input streams.
//
// For seekable inputs, use NewDemuxer. For non-seekable streams (like network streams),
// use NewStreamingDemuxer.
type Demuxer struct {
	parser *MatroskaParser
	reader io.ReadSeeker
}

// NewDemuxer creates a new Matroska demuxer from r.
//
// NewDemuxer creates a new Matroska demuxer from a seekable input stream.
// The input reader must implement both io.Reader and io.Seeker interfaces.
//
// This function initializes the underlying Matroska parser and returns a Demuxer
// instance that can be used to extract track information, file metadata, and read
// media packets from the Matroska file.
//
// Example:
//
//	file, err := os.Open("video.mkv")
//	if err != nil {
//	    log.Fatal(err)
//	}
//	defer file.Close()
//
//	demuxer, err := matroska.NewDemuxer(file)
//	if err != nil {
//	    log.Fatal(err)
//	}
//	defer demuxer.Close()
//
// Parameters:
//   - r: An io.ReadSeeker that provides access to the Matroska file data.
//
// Returns:
//   - *Demuxer: A new Demuxer instance for the given input.
//   - error: An error if the demuxer could not be created.
func NewDemuxer(r io.ReadSeeker, elements ...uint32) (*Demuxer, error) {
	parser, err := NewMatroskaParser(r, false, elements...)
	if err != nil {
		return nil, fmt.Errorf("failed to create parser: %w", err)
	}

	return &Demuxer{
		parser: parser,
		reader: r,
	}, nil
}



// Close closes a demuxer.
//
// Close releases any resources associated with the Demuxer.
// In this pure Go implementation, no explicit cleanup is required as
// Go's garbage collector handles memory management automatically.
// However, calling Close is still recommended for consistency and
// to allow for future implementations that might require cleanup.
//
// Example:
//
//	demuxer, err := matroska.NewDemuxer(file)
//	if err != nil {
//	    log.Fatal(err)
//	}
//	defer demuxer.Close()
//
//	// Use demuxer...
func (d *Demuxer) Close() {
	// Pure Go implementation doesn't need explicit cleanup
}

// GetNumTracks gets the number of tracks available to a given demuxer.
//
// This function returns the total number of tracks (video, audio, subtitle, etc.)
// contained in the Matroska file. Track indices range from 0 to the returned
// value minus one, and can be used with GetTrackInfo to retrieve detailed
// information about each track.
//
// Example:
//
//	numTracks, err := demuxer.GetNumTracks()
//	if err != nil {
//	    log.Fatal(err)
//	}
//	fmt.Printf("File contains %d tracks\n", numTracks)
//
// Returns:
//   - uint: The number of tracks in the Matroska file.
//   - error: An error if the track count could not be retrieved.
func (d *Demuxer) GetNumTracks() (uint, error) {
	return d.parser.GetNumTracks(), nil
}

// GetTrackInfo returns all track-level information available for a given track,
// where track is less than what is returned by GetNumTracks.
//
// This function retrieves detailed information about a specific track, including
// its type (video, audio, subtitle), codec, language, and other metadata.
// The track parameter must be a valid track index between 0 and GetNumTracks()-1.
//
// Example:
//
//	numTracks, err := demuxer.GetNumTracks()
//	if err != nil {
//	    log.Fatal(err)
//	}
//
//	for i := uint(0); i < numTracks; i++ {
//	    trackInfo, err := demuxer.GetTrackInfo(i)
//	    if err != nil {
//	        log.Fatal(err)
//	    }
//	    fmt.Printf("Track %d: %s (%s)\n", i, trackInfo.Name, trackInfo.CodecID)
//	}
//
// Parameters:
//   - track: The index of the track to retrieve information for.
//
// Returns:
//   - *TrackInfo: Detailed information about the track.
//   - error: An error if the track information could not be retrieved or if the track index is invalid.
func (d *Demuxer) GetTrackInfo(track uint) (*TrackInfo, error) {
	trackInfo := d.parser.GetTrackInfo(track)
	if trackInfo == nil {
		return nil, fmt.Errorf("track %d not found", track)
	}
	return trackInfo, nil
}

// GetFileInfo gets all top-level (whole file) info available for a given
// demuxer.
//
// This function retrieves metadata about the Matroska file itself, including
// title, duration, muxing application, writing application, and other
// file-level information. This information is stored in the SegmentInfo
// structure.
//
// Example:
//
//	fileInfo, err := demuxer.GetFileInfo()
//	if err != nil {
//	    log.Fatal(err)
//	}
//	fmt.Printf("Title: %s\n", fileInfo.Title)
//	fmt.Printf("Duration: %f seconds\n", float64(fileInfo.Duration)/1000000000)
//	fmt.Printf("Muxing App: %s\n", fileInfo.MuxingApp)
//
// Returns:
//   - *SegmentInfo: File-level metadata about the Matroska file.
//   - error: An error if the file information could not be retrieved.
func (d *Demuxer) GetFileInfo() (*SegmentInfo, error) {
	fileInfo := d.parser.GetFileInfo()
	if fileInfo == nil {
		return nil, fmt.Errorf("no file info available")
	}
	return fileInfo, nil
}

// GetAttachments returns information on all available attachments
// for a given demuxer. The returned slice may be of length 0.
//
// This function retrieves information about any attachments embedded in the
// Matroska file, such as fonts, images, or other files. Attachments are
// typically used for fonts required by subtitle tracks or cover art.
//
// Example:
//
//	attachments := demuxer.GetAttachments()
//	for _, attachment := range attachments {
//	    fmt.Printf("Attachment: %s (%s)\n", attachment.Name, attachment.MimeType)
//	}
//
// Returns:
//   - []*Attachment: A slice of attachment information. May be empty if no attachments are present.
func (d *Demuxer) GetAttachments() []*Attachment {
	return d.parser.GetAttachments()
}

// GetChapters returns all chapters for a given demuxer. The returned slice may
// be of length 0.
//
// This function retrieves information about the chapter structure of the Matroska file.
// Chapters can be used to navigate through the content, similar to DVD chapters.
// The returned chapters may include nested chapters (editions).
//
// Example:
//
//	chapters := demuxer.GetChapters()
//	for _, chapter := range chapters {
//	    fmt.Printf("Chapter: %s (%d-%d)\n", chapter.Display.String, chapter.Start, chapter.End)
//	}
//
// Returns:
//   - []*Chapter: A slice of chapter information. May be empty if no chapters are present.
func (d *Demuxer) GetChapters() []*Chapter {
	return d.parser.GetChapters()
}

// GetTags returns all tags for a given demuxer. The returned slice may be of
// length 0.
//
// This function retrieves metadata tags associated with the Matroska file or
// specific tracks within the file. Tags can contain information such as title,
// artist, album, genre, and other descriptive metadata.
//
// Example:
//
//	tags := demuxer.GetTags()
//	for _, tag := range tags {
//	    for _, simpleTag := range tag.SimpleTags {
//	        fmt.Printf("Tag: %s = %s\n", simpleTag.Name, simpleTag.Value)
//	    }
//	}
//
// Returns:
//   - []*Tag: A slice of tag information. May be empty if no tags are present.
func (d *Demuxer) GetTags() []*Tag {
	return d.parser.GetTags()
}

// GetCues returns all cues for a given demuxer. The returned slice may be
// of length 0.
//
// This function retrieves cue points from the Matroska file. Cues are indexing
// information that allows for efficient seeking to specific timecodes in the file.
// They contain mappings between timecodes and their positions in the file.
//
// Example:
//
//	cues := demuxer.GetCues()
//	for _, cue := range cues {
//	    fmt.Printf("Cue at time %d, position %d\n", cue.Time, cue.Position)
//	}
//
// Returns:
//   - []*Cue: A slice of cue information. May be empty if no cues are present.
func (d *Demuxer) GetCues() []*Cue {
	return d.parser.GetCues()
}

// GetCuesPos returns the byte position of the cues element.
func (d *Demuxer) GetCuesPos() uint64 {
	return d.parser.GetCuesPos()
}
