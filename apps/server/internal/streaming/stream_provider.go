package streaming

import (
	"context"
	"errors"
)

// StreamProvider defines the contract for resolving media streams.
// Each provider (local file, torrent, debrid) implements this interface,
// allowing the playback system to resolve streams uniformly regardless of source.
type StreamProvider interface {
	// Name returns the human-readable name of this provider (e.g., "local", "torrent", "debrid").
	Name() string

	// ResolveStream resolves a stream URL for the given media/episode request.
	// Returns an error if the provider cannot serve this request.
	ResolveStream(ctx context.Context, req StreamRequest) (*StreamResult, error)

	// SupportsMedia returns true if this provider can potentially serve the given media.
	// This is a fast check — actual resolution may still fail.
	SupportsMedia(mediaID int) bool
}

// StreamRequest represents a request to resolve a media stream.
type StreamRequest struct {
	MediaID       int    `json:"mediaId"`
	EpisodeNumber int    `json:"episodeNumber"`
	AniDBEpisode  string `json:"anidbEpisode"`
	Quality       string `json:"quality"` // "1080p", "720p", etc.
	ClientID      string `json:"clientId"`
}

// StreamResult represents a resolved media stream.
type StreamResult struct {
	URL      string     `json:"url"`
	Type     StreamType `json:"type"`
	MimeType string     `json:"mimeType"`
	Filename string     `json:"filename"`
	// Headers contains any additional HTTP headers needed for the stream
	Headers map[string]string `json:"headers,omitempty"`
}

// StreamType identifies the source of a stream.
type StreamType string

const (
	StreamTypeLocalFile StreamType = "file"
)

// Errors
var (
	ErrMediaNotFound   = errors.New("streaming: media not found for this provider")
	ErrStreamNotReady  = errors.New("streaming: stream is not ready yet")
	ErrUnsupported     = errors.New("streaming: provider does not support this media")
	ErrServerSaturated = errors.New("streaming: maximum concurrent transcode sessions reached")
)

// ProviderResult wraps a stream result with its provider name and potential error.
type ProviderResult struct {
	Provider string        `json:"provider"`
	Result   *StreamResult `json:"result,omitempty"`
	Error    error         `json:"error,omitempty"`
}
