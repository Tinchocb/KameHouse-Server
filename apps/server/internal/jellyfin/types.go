package jellyfin

// JellyfinItem representa un item en la biblioteca de Jellyfin.
type JellyfinItem struct {
	ID           string `json:"Id"`
	Name         string `json:"Name"`
	OriginalTitle string `json:"OriginalTitle"`
	ProviderIds  struct {
		Tmdb string `json:"Tmdb"`
		Imdb string `json:"Imdb"`
		Tvdb string `json:"Tvdb"`
	} `json:"ProviderIds"`
	Type           string `json:"Type"` // "Movie", "Series", "Episode"
	IndexNumber    int    `json:"IndexNumber"`
	ParentIndexNumber int `json:"ParentIndexNumber"`
	SeriesID       string `json:"SeriesId"`
}

// JellyfinMediaSource representa una fuente de medios disponible en Jellyfin.
type JellyfinMediaSource struct {
	ID            string `json:"Id"`
	Name          string `json:"Name"`
	Path          string `json:"Path"`
	Container     string `json:"Container"`
	Size          int64  `json:"Size"`
	Bitrate       int    `json:"Bitrate"`
	MediaStreams  []MediaStream `json:"MediaStreams"`
}

// MediaStream representa un stream de video/audio/subtítulo.
type MediaStream struct {
	Type            string `json:"Type"` // "Video", "Audio", "Subtitle"
	Index           int    `json:"Index"`
	Codec           string `json:"Codec"`
	Width           int    `json:"Width"`
	Height          int    `json:"Height"`
	BitRate         int    `json:"BitRate"`
	Language        string `json:"Language"`
	Channels        int    `json:"Channels"`
	IsDefault       bool   `json:"IsDefault"`
	IsForced        bool   `json:"IsForced"`
}

// JellyfinItemsResponse respuesta paginada de items.
type JellyfinItemsResponse struct {
	Items    []JellyfinItem `json:"Items"`
	TotalRecordCount int    `json:"TotalRecordCount"`
}
