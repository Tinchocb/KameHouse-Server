package scanner

import (
	"encoding/xml"
	"os"
	"strconv"
	"strings"
)

// NfoUniqueID represents a Kodi/Jellyfin <uniqueid type="tmdb">12345</uniqueid> element.
// Multiple providers can appear in the same NFO file.
type NfoUniqueID struct {
	Type    string `xml:"type,attr"` // e.g. "tmdb", "imdb", "tvdb"
	Default bool   `xml:"default,attr,omitempty"`
	Value   string `xml:",chardata"` // The actual provider ID
}

// NfoFile represents the root of a Kodi/Standard NFO file.
// Supports tvshow, movie, anime, and episodedetails roots.
type NfoFile struct {
	XMLName       xml.Name      `xml:"tvshow"`
	UniqueIDs     []NfoUniqueID `xml:"uniqueid"` // Jellyfin/Kodi-style: <uniqueid type="tmdb">603</uniqueid>
	ID            int           `xml:"id"`       // Fallback / TMDB ID usually
	TmdbId        int           `xml:"tmdbid"`   // TMDB ID
	TvdbId        int           `xml:"tvdbid"`   // TVDB ID
	ImdbId        string        `xml:"imdbid"`   // IMDB ID
	Season        int           `xml:"season"`   // Season number (episodedetails)
	Episode       int           `xml:"episode"`  // Episode number (episodedetails)
	Title         string        `xml:"title"`
	OriginalTitle string        `xml:"originaltitle"` // In anime, this is often Romaji or Kanji
	SortTitle     string        `xml:"sorttitle"`
	Rating        float64       `xml:"rating"`
	Year          int           `xml:"year"`
	Plot          string        `xml:"plot"`
	Outline       string        `xml:"outline"`
	Tagline       string        `xml:"tagline"`
	Studio        string        `xml:"studio"`
	PremiereDate  string        `xml:"premiered"` // YYYY-MM-DD
	Status        string        `xml:"status"`

	Genres    []string `xml:"genre"`
	Tags      []string `xml:"tag"`
	Directors []string `xml:"director"`
}

// ParseNfoFile reads an XML .nfo file and extracts full metadata tags.
// This allows KameHouse to use Kodi/Standard metadata to guarantee a perfect match and avoid external API calls.
// Supports the following roots (in order): tvshow, movie, anime, episodedetails.
func ParseNfoFile(path string) (*NfoFile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	for _, rootName := range []string{"tvshow", "movie", "anime", "episodedetails"} {
		var nfo NfoFile
		nfo.XMLName = xml.Name{Local: rootName}
		if err := xml.Unmarshal(data, &nfo); err == nil {
			return &nfo, nil
		}
	}

	// Last resort: try raw unmarshal (lets xml package pick the root)
	var nfo NfoFile
	if err := xml.Unmarshal(data, &nfo); err != nil {
		return nil, err
	}
	return &nfo, nil
}

// GetTmdbID returns the best available TMDB ID from an NfoFile.
// Priority: <uniqueid type="tmdb"> > <tmdbid> > <id>
func (n *NfoFile) GetTmdbID() int {
	for _, uid := range n.UniqueIDs {
		if strings.EqualFold(uid.Type, "tmdb") && uid.Value != "" {
			id := 0
			for _, c := range uid.Value {
				if c >= '0' && c <= '9' {
					id = id*10 + int(c-'0')
				}
			}
			if id > 0 {
				return id
			}
		}
	}
	if n.TmdbId > 0 {
		return n.TmdbId
	}
	return n.ID
}

// ParseNfoProviderID is a helper to get a provider ID string from the UniqueIDs slice.
func (n *NfoFile) ParseNfoProviderID(providerType string) string {
	for _, uid := range n.UniqueIDs {
		if strings.EqualFold(uid.Type, providerType) && uid.Value != "" {
			return uid.Value
		}
	}
	return ""
}

// GetImdbID returns the best available IMDB ID from an NfoFile.
// Priority: <uniqueid type="imdb"> > <imdbid>
func (n *NfoFile) GetImdbID() string {
	if id := n.ParseNfoProviderID("imdb"); id != "" {
		return id
	}
	return n.ImdbId
}

// GetTvdbID returns the best available TVDB ID from an NfoFile.
// Priority: <uniqueid type="tvdb"> > <tvdbid>
func (n *NfoFile) GetTvdbID() string {
	if id := n.ParseNfoProviderID("tvdb"); id != "" {
		return id
	}
	if n.TvdbId > 0 {
		return strconv.Itoa(n.TvdbId)
	}
	return ""
}
