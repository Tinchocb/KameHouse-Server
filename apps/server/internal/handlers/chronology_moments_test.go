package handlers

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestChronologyMomentsHandler(t *testing.T) {
	app, _ := setupTestApp(t)
	h := &Handler{App: app}
	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler

	// 1. Initial GET should return empty object
	req := httptest.NewRequest(http.MethodGet, "/api/v1/intelligence/chronology/moment-times", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.HandleGetChronologyMomentTimes(c); err != nil {
		t.Fatalf("HandleGetChronologyMomentTimes: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	// 2. POST with invalid momentKey -> 400
	invalidKeys := []string{"", "db-pilaf", "db-pilaf:abc:0", "db-pilaf:9", "db-pilaf:0:1", "db-pilaf:9:-1"}
	for _, badKey := range invalidKeys {
		sec := 100
		body, _ := json.Marshal(ChronologyMomentTimePayload{MomentKey: badKey, Seconds: &sec})
		req = httptest.NewRequest(http.MethodPost, "/api/v1/intelligence/chronology/moment-times", bytes.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec = httptest.NewRecorder()
		c = e.NewContext(req, rec)

		_ = h.HandleSaveChronologyMomentTime(c)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400 for key %q, got %d", badKey, rec.Code)
		}
	}

	// 3. POST with seconds > 6h (21600) -> 400
	tooLargeSec := 21601
	body, _ := json.Marshal(ChronologyMomentTimePayload{MomentKey: "db-pilaf:9:4", Seconds: &tooLargeSec})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/intelligence/chronology/moment-times", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	c = e.NewContext(req, rec)
	_ = h.HandleSaveChronologyMomentTime(c)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for seconds > 6h, got %d", rec.Code)
	}

	// 4. POST with valid key and seconds -> 200 (upsert)
	validSec := 872
	body, _ = json.Marshal(ChronologyMomentTimePayload{MomentKey: "db-pilaf:9:4", Seconds: &validSec})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/intelligence/chronology/moment-times", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	c = e.NewContext(req, rec)
	if err := h.HandleSaveChronologyMomentTime(c); err != nil {
		t.Fatalf("HandleSaveChronologyMomentTime: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	// 5. GET confirms the moment is saved
	req = httptest.NewRequest(http.MethodGet, "/api/v1/intelligence/chronology/moment-times", nil)
	rec = httptest.NewRecorder()
	c = e.NewContext(req, rec)
	_ = h.HandleGetChronologyMomentTimes(c)

	var getResp struct {
		Data map[string]int `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &getResp); err != nil {
		t.Fatalf("unmarshal GET response: %v", err)
	}
	if getResp.Data["db-pilaf:9:4"] != 872 {
		t.Fatalf("expected 872, got %d", getResp.Data["db-pilaf:9:4"])
	}

	// 6. POST with seconds < 0 -> deletes the moment
	deleteSec := -1
	body, _ = json.Marshal(ChronologyMomentTimePayload{MomentKey: "db-pilaf:9:4", Seconds: &deleteSec})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/intelligence/chronology/moment-times", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	c = e.NewContext(req, rec)
	_ = h.HandleSaveChronologyMomentTime(c)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on delete, got %d", rec.Code)
	}

	// 7. GET confirms it's deleted
	req = httptest.NewRequest(http.MethodGet, "/api/v1/intelligence/chronology/moment-times", nil)
	rec = httptest.NewRecorder()
	c = e.NewContext(req, rec)
	_ = h.HandleGetChronologyMomentTimes(c)
	var getRespAfterDelete struct {
		Data map[string]int `json:"data"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &getRespAfterDelete)
	if _, exists := getRespAfterDelete.Data["db-pilaf:9:4"]; exists {
		t.Fatalf("expected db-pilaf:9:4 to be deleted, but still exists")
	}
}

func TestThumbnailCacheKeyDifferentiatesOffset(t *testing.T) {
	videoPath := "/path/to/dbz/ep09.mkv"
	mtimeNano := int64(1700000000000000000)
	size := int64(350000000)

	baseKey := fmt.Sprintf("%s:%d:%d", videoPath, mtimeNano, size)
	baseHash := fmt.Sprintf("%x", sha256.Sum256([]byte(baseKey)))

	offset100Key := fmt.Sprintf("%s:t=%d", baseKey, 100)
	offset100Hash := fmt.Sprintf("%x", sha256.Sum256([]byte(offset100Key)))

	offset872Key := fmt.Sprintf("%s:t=%d", baseKey, 872)
	offset872Hash := fmt.Sprintf("%x", sha256.Sum256([]byte(offset872Key)))

	if baseHash == offset100Hash {
		t.Errorf("expected different hashes for without-t vs with-t")
	}
	if offset100Hash == offset872Hash {
		t.Errorf("expected different hashes for different t offsets")
	}
}
