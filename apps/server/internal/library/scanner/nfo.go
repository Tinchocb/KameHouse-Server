package scanner

import (
	"encoding/xml"
	"os"
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
	// Sin nombre en el tag: acepta cualquier raíz (tvshow, movie, anime,
	// episodedetails) y deja en XMLName.Local cuál era. Con `xml:"tvshow"` los
	// NFO de película/anime/episodio fallaban siempre al parsear.
	XMLName       xml.Name
	UniqueIDs     []NfoUniqueID `xml:"uniqueid"`      // Jellyfin/Kodi-style: <uniqueid type="tmdb">603</uniqueid>
	ID            int           `xml:"id"`            // Fallback / TMDB ID usually
	TmdbID        int           `xml:"tmdbid"`        // TMDB ID
	TvdbId        int           `xml:"tvdbid"`        // TVDB ID
	AnilistId     int           `xml:"anilistid"`     // AniList ID
	MalId         int           `xml:"myanimelistid"` // MAL ID
	Season        int           `xml:"season"`        // Season number
	Episode       int           `xml:"episode"`       // Episode number
	Absolute      int           `xml:"absolute"`      // Absolute anime episode number
	EpisodeType   string        `xml:"episodetype"`   // Canon, Filler, Mixed
	Format        string        `xml:"format"`        // TV, MOVIE, OVA, SPECIAL
	Title         string        `xml:"title"`
	OriginalTitle string        `xml:"originaltitle"` // Romaji/Kanji
	SortTitle     string        `xml:"sorttitle"`
	Rating        float64       `xml:"rating"`
	Year          int           `xml:"year"`
	Plot          string        `xml:"plot"`
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
	if n.TmdbID > 0 {
		return n.TmdbID
	}
	return n.ID
}

