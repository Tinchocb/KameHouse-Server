package filler

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"kamehouse/internal/util"
)

// Fixture local: el test no depende de animefillerlist.com (antes fallaba por
// timeout de red y no comprobaba nada del resultado).
const showsHTML = `<html><body>
<div class="Group"><ul>
  <li><a href="/shows/hunter-x-hunter">Hunter x Hunter</a></li>
  <li><a href="/shows/hunter-x-hunter-2011">Hunter x Hunter (2011)</a></li>
  <li><a href="/shows/dragon-ball-z">Dragon Ball Z</a></li>
  <li><a href="/shows/shingeki">Shingeki no Kyojin (Attack on Titan)</a></li>
</ul></div>
</body></html>`

const showHTML = `<html><body><table>
  <tr class="canon"><td class="Number">1</td></tr>
  <tr class="filler"><td class="Number">39</td></tr>
  <tr class="filler"><td class="Number">40</td></tr>
  <tr class="mixed_canon/filler"><td class="Number">41</td></tr>
</table></body></html>`

func newTestFillerList(t *testing.T) *AnimeFillerList {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/shows":
			_, _ = w.Write([]byte(showsHTML))
		case "/shows/dragon-ball-z":
			_, _ = w.Write([]byte(showHTML))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)

	af := NewAnimeFillerList(util.NewLogger())
	af.baseUrl = srv.URL
	return af
}

func TestAnimeFillerList_Search(t *testing.T) {
	af := newTestFillerList(t)

	cases := []struct {
		title    string
		wantSlug string
	}{
		{"Hunter x Hunter (2011)", "/shows/hunter-x-hunter-2011"},
		{"Dragon Ball Z", "/shows/dragon-ball-z"},
		// El título alternativo entre paréntesis también se compara.
		{"Attack on Titan", "/shows/shingeki"},
	}
	for _, tc := range cases {
		ret, err := af.Search(SearchOptions{Titles: []string{tc.title}})
		if err != nil {
			t.Errorf("Search(%q): %v", tc.title, err)
			continue
		}
		if ret.Slug != tc.wantSlug {
			t.Errorf("Search(%q) slug = %q, want %q", tc.title, ret.Slug, tc.wantSlug)
		}
	}
}

func TestAnimeFillerList_SearchNoMatch(t *testing.T) {
	af := newTestFillerList(t)
	if ret, err := af.Search(SearchOptions{Titles: []string{"Un título que no se parece a ninguno de la lista"}}); err == nil {
		t.Fatalf("expected no results, got %+v", ret)
	}
}

func TestAnimeFillerList_FindFillerData(t *testing.T) {
	af := newTestFillerList(t)
	data, err := af.FindFillerData("/shows/dragon-ball-z")
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"39", "40"}; !reflect.DeepEqual(data.FillerEpisodes, want) {
		t.Errorf("filler episodes = %v, want %v", data.FillerEpisodes, want)
	}
}
