package mediastream

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"kamehouse/internal/mediastream/extsubs"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
)

func TestServeExternalSubtitle(t *testing.T) {
	cache := t.TempDir()
	const media = "gdrive://file1/Show/Ep 01.mkv"
	cands := extsubs.MatchVideo("Ep 01.mkv", []string{"Ep 01.es.srt"})
	subs, err := extsubs.Sync(cache, media, []extsubs.Source{{
		Candidate: cands[0],
		Key:       "k",
		Read:      func() ([]byte, error) { return []byte("1\n00:00:01,000 --> 00:00:02,000\nhola\n"), nil },
	}})
	require.NoError(t, err)
	require.Len(t, subs, 1)

	r := &Repository{cacheDir: cache}
	e := echo.New()
	do := func(q url.Values) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/mediastream/subtitles?"+q.Encode(), nil)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)
		if err := r.ServeEchoExtractedSubtitles(c); err != nil {
			he, ok := err.(*echo.HTTPError)
			require.True(t, ok, err)
			rec.WriteHeader(he.Code)
		}
		return rec
	}

	rec := do(url.Values{"path": {media}, "trackIndex": {"1000"}})
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), "hola")

	// Otra ruta: no ve las pistas del video anterior.
	require.Equal(t, http.StatusNotFound, do(url.Values{"path": {"gdrive://other/x.mkv"}, "trackIndex": {"1000"}}).Code)
	// Índice inexistente.
	require.Equal(t, http.StatusNotFound, do(url.Values{"path": {media}, "trackIndex": {"1007"}}).Code)
	// Sin path ni container.
	require.Equal(t, http.StatusBadRequest, do(url.Values{"trackIndex": {"1000"}}).Code)
}
