package scanner

import (
	"encoding/xml"
	"os"
)

// NfoFile represents the root of a Kodi/Jellyfin NFO file.
type NfoFile struct {
	XMLName       xml.Name `xml:"tvshow"`
	ID            int      `xml:"id"`     // Fallback / AniList ID usually
	TmdbId        int      `xml:"tmdbid"` // TMDB ID
	TvdbId        int      `xml:"tvdbid"` // TVDB ID
	ImdbId        string   `xml:"imdbid"` // IMDB ID
	Season        int      `xml:"season"` // Season number
	Episode       int      `xml:"episode"`// Episode number
	Title         string   `xml:"title"`
	OriginalTitle string   `xml:"originaltitle"` // In anime, this is often Romaji or Kanji
	SortTitle     string   `xml:"sorttitle"`
	Rating        float64  `xml:"rating"`
	Year          int      `xml:"year"`
	Plot          string   `xml:"plot"`
	Outline       string   `xml:"outline"`
	Tagline       string   `xml:"tagline"`
	Studio        string   `xml:"studio"`
	PremiereDate  string   `xml:"premiered"` // YYYY-MM-DD
	Status        string   `xml:"status"`

	Genres []string `xml:"genre"`
	Tags   []string `xml:"tag"`
}

// ParseNfoFile reads an XML .nfo file and extracts full metadata tags.
// This allows KameHouse to use Jellyfin/Kodi metadata to guarantee a perfect match and avoid external API calls.
func ParseNfoFile(path string) (*NfoFile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var nfo NfoFile
	// Try parsing as <tvshow> first
	err = xml.Unmarshal(data, &nfo)
	if err != nil {
		// If it fails, try parsing as <movie> (same structure for our subset)
		var movieNfo NfoFile
		movieNfo.XMLName = xml.Name{Local: "movie"}
		err = xml.Unmarshal(data, &movieNfo)
		if err == nil {
			return &movieNfo, nil
		}

		// If it still fails, try <anime>
		var animeNfo NfoFile
		animeNfo.XMLName = xml.Name{Local: "anime"}
		err = xml.Unmarshal(data, &animeNfo)
		if err == nil {
			return &animeNfo, nil
		}

		return nil, err
	}

	return &nfo, nil
}
