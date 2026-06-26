package jellyfin

import "context"

type Client struct{}

type JellyfinMediaSource struct {
	Path         string
	Name         string
	Container    string
	Bitrate      int
	Size         int64
	MediaStreams []JellyfinMediaStream
}

type JellyfinMediaStream struct {
	Type     string
	Height   int
	Codec    string
	BitRate  int
	Language string
}

type JellyfinItem struct {
	ID string
}

func (c *Client) IsConfigured() bool {
	return c != nil
}

func (c *Client) SearchByTMDB(ctx context.Context, tmdbID int) (*JellyfinItem, error) {
	return nil, nil
}

func (c *Client) GetMediaSources(ctx context.Context, itemID string) ([]JellyfinMediaSource, error) {
	return nil, nil
}
