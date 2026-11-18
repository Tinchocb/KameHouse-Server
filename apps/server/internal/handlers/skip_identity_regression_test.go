package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"kamehouse/internal/database/models"
)

func skipIdentityRequest(t *testing.T, h *Handler, method, query, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, "/api/v1/mediastream/skip-times"+query, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	var err error
	if method == "GET" {
		err = h.HandleGetEpisodeSkipTimes(c)
	} else {
		err = h.HandleSaveEpisodeSkipTimes(c)
	}
	require.NoError(t, err)
	return rec
}

func TestSkipTimesMALUsesPublicIdentityForReadAndWrite(t *testing.T) {
	h, media := newChronologyQueryFixture(t)
	media.MyanimelistId = 456
	require.NoError(t, h.App.Database.Gorm().Save(media).Error)
	require.NotEqualValues(t, 123, media.ID)
	defer invalidateSkipTimesCache(123)
	defer invalidateSkipTimesCache(int(media.ID))
	// A colliding numeric primary key must never leak into skip-times identity.
	wrong := models.EpisodeSkipTime{MediaID: int(media.ID), EpisodeNumber: 42, OpStart: 10, OpEnd: 20}
	require.NoError(t, h.App.Database.Gorm().Create(&wrong).Error)
	rec := skipIdentityRequest(t, h, "POST", "", `{"malId":456,"episodeNumber":42,"opStart":60,"opEnd":150,"source":"manual","confidence":1}`)
	require.Equal(t, 200, rec.Code, rec.Body.String())
	for _, query := range []string{"?mediaId=123&episodeNumber=42", "?malId=456&episodeNumber=42"} {
		rec = skipIdentityRequest(t, h, "GET", query, "")
		require.Equal(t, 200, rec.Code, rec.Body.String())
		var response struct {
			Data models.EpisodeSkipTime `json:"data"`
		}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		require.Equal(t, 123, response.Data.MediaID)
		require.Equal(t, float64(60), response.Data.OpStart)
	}
	var untouched models.EpisodeSkipTime
	require.NoError(t, h.App.Database.Gorm().First(&untouched, wrong.ID).Error)
	require.Equal(t, float64(10), untouched.OpStart)
}

func TestSkipTimesRejectsAmbiguousMALWithoutWriting(t *testing.T) {
	h, media := newChronologyQueryFixture(t)
	media.MyanimelistId = 456
	require.NoError(t, h.App.Database.Gorm().Save(media).Error)
	require.NoError(t, h.App.Database.Gorm().Create(&models.LibraryMedia{Type: "ANIME", TmdbID: 456, MyanimelistId: 456}).Error)
	for _, method := range []string{"GET", "POST"} {
		rec := skipIdentityRequest(t, h, method, "?malId=456&episodeNumber=42", `{"malId":456,"episodeNumber":42,"opStart":60,"opEnd":150}`)
		require.Equal(t, 409, rec.Code, rec.Body.String())
	}
	var count int64
	require.NoError(t, h.App.Database.Gorm().Model(&models.EpisodeSkipTime{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestSkipTimesPropagatesByLibraryFKAndAbsoluteSeasonNumbers(t *testing.T) {
	h, media := newChronologyQueryFixture(t)
	logger := zerolog.Nop()
	h.App.Logger = &logger
	defer invalidateSkipTimesCache(123)
	other := models.LibraryMedia{BaseModel: models.BaseModel{ID: 123}, Type: "SHOW", TmdbID: 999}
	require.NoError(t, h.App.Database.Gorm().Create(&other).Error)
	episodes := []models.LibraryEpisode{
		{LibraryMediaID: media.ID, SeasonNumber: 1, EpisodeNumber: 2, AbsoluteNumber: 43},
		{LibraryMediaID: media.ID, SeasonNumber: 2, EpisodeNumber: 1, AbsoluteNumber: 44},
		{LibraryMediaID: other.ID, SeasonNumber: 1, EpisodeNumber: 99, AbsoluteNumber: 99},
	}
	require.NoError(t, h.App.Database.Gorm().Create(&episodes).Error)
	// Prime the negative cache before saving/propagating.
	_ = h.getOrLoadSkipTimes(123)
	rec := skipIdentityRequest(t, h, "POST", "", `{"mediaId":123,"episodeNumber":42,"opStart":60,"opEnd":150,"source":"manual","confidence":1,"applyToSeason":true}`)
	require.Equal(t, 200, rec.Code, rec.Body.String())
	var response struct {
		Data struct {
			Applied bool `json:"appliedToSeason"`
			Updated int  `json:"episodesUpdated"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
	require.True(t, response.Data.Applied)
	require.Equal(t, 1, response.Data.Updated)
	rows := h.getOrLoadSkipTimes(123)
	require.Len(t, rows, 2)
	for _, row := range rows {
		require.Contains(t, []int{42, 43}, row.EpisodeNumber)
		require.Equal(t, float64(60), row.OpStart)
	}
	// An unknown episode must not claim that a season was updated.
	rec = skipIdentityRequest(t, h, "POST", "", `{"mediaId":123,"episodeNumber":900,"opEnd":150,"source":"manual","confidence":1,"applyToSeason":true}`)
	require.Contains(t, rec.Body.String(), `"appliedToSeason":false`)
	require.Contains(t, rec.Body.String(), `"seasonError"`)
}
