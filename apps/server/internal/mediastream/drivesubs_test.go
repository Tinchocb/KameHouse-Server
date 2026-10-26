package mediastream

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"kamehouse/internal/database/models"
	"kamehouse/internal/mediastream/videofile"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/samber/mo"
	"github.com/stretchr/testify/require"
)

func newDriveSubsRepo(t *testing.T, ffmpeg string) *Repository {
	logger := zerolog.Nop()
	r := &Repository{
		cacheDir: t.TempDir(),
		logger:   &logger,
		settings: mo.Some(&models.MediastreamSettings{FfmpegPath: ffmpeg}),
	}
	r.playbackManager = NewPlaybackManager(r)
	return r
}

func TestDriveSubtitleStatusWithoutExtraction(t *testing.T) {
	r := newDriveSubsRepo(t, "ffmpeg")
	require.Equal(t, DriveSubtitlesNone, r.DriveSubtitleStatus("gdrive://nada/x.mkv").State)
	require.False(t, r.DriveSubtitlesExtracted("gdrive://nada/x.mkv"))

	_, err := r.StartDriveSubtitleExtraction("gdrive://nada/x.mkv", "x", &videofile.MediaInfo{}, DriveSubsMaxSize+1)
	require.ErrorIs(t, err, ErrDriveSubtitlesTooLarge)
	_, err = r.StartDriveSubtitleExtraction("gdrive://nada/x.mkv", "x", nil, 0)
	require.Error(t, err)
}

func TestDriveSubtitleExtractionFlow(t *testing.T) {
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg no está disponible")
	}
	dir := t.TempDir()
	srt := filepath.Join(dir, "in.srt")
	require.NoError(t, os.WriteFile(srt, []byte("1\n00:00:00,100 --> 00:00:01,500\nhola drive\n\n"), 0o644))
	video := filepath.Join(dir, "ep.mkv")
	out, err := exec.Command(ffmpeg, "-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=2:r=5",
		"-i", srt, "-map", "0:v", "-map", "1:0", "-c:v", "mpeg4", "-c:s", "srt", video).CombinedOutput()
	require.NoError(t, err, string(out))

	r := newDriveSubsRepo(t, ffmpeg)
	const drivePath = "gdrive://abc123/Show/ep.mkv"
	srtExt := "srt"
	mi := &videofile.MediaInfo{
		Duration:  2,
		Subtitles: []videofile.Subtitle{{Index: 0, Codec: "subrip", Extension: &srtExt}},
	}

	st, err := r.StartDriveSubtitleExtraction(drivePath, video, mi, 1<<20)
	require.NoError(t, err)
	require.Contains(t, []DriveSubtitleState{DriveSubtitlesQueued, DriveSubtitlesRunning, DriveSubtitlesDone}, st.State)

	// Idempotente: pedirlo de nuevo en curso no lanza otro trabajo.
	st2, err := r.StartDriveSubtitleExtraction(drivePath, video, mi, 1<<20)
	require.NoError(t, err)
	require.NotEqual(t, DriveSubtitlesNone, st2.State)

	require.Eventually(t, func() bool { return r.DriveSubtitleStatus(drivePath).State == DriveSubtitlesDone }, 30*time.Second, 50*time.Millisecond)
	require.True(t, r.DriveSubtitlesExtracted(drivePath))
	require.Equal(t, 100.0, r.DriveSubtitleStatus(drivePath).Percent)

	// El endpoint sirve la pista por la ruta gdrive:// (sin container activo).
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/mediastream/subtitles?"+url.Values{"path": {drivePath}, "trackIndex": {"0"}}.Encode(), nil)
	rec := httptest.NewRecorder()
	require.NoError(t, r.ServeEchoExtractedSubtitles(e.NewContext(req, rec)))
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), "hola drive")

	// Otro archivo de Drive no ve esas pistas.
	req = httptest.NewRequest(http.MethodGet, "/x?"+url.Values{"path": {"gdrive://otro/x.mkv"}, "trackIndex": {"0"}}.Encode(), nil)
	err = r.ServeEchoExtractedSubtitles(e.NewContext(req, httptest.NewRecorder()))
	he, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	require.Equal(t, http.StatusNotFound, he.Code)

	// Con la extracción hecha, volver a pedirla no relanza nada.
	st, err = r.StartDriveSubtitleExtraction(drivePath, video, mi, 1<<20)
	require.NoError(t, err)
	require.Equal(t, DriveSubtitlesDone, st.State)
}

func TestDriveSubtitleExtractionFailureIsRetryable(t *testing.T) {
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg no está disponible")
	}
	r := newDriveSubsRepo(t, ffmpeg)
	const drivePath = "gdrive://failing/ep.mkv"
	srtExt := "srt"
	mi := &videofile.MediaInfo{Subtitles: []videofile.Subtitle{{Index: 0, Codec: "subrip", Extension: &srtExt}}}

	_, err = r.StartDriveSubtitleExtraction(drivePath, filepath.Join(t.TempDir(), "no-existe.mkv"), mi, 0)
	require.NoError(t, err)
	require.Eventually(t, func() bool { return r.DriveSubtitleStatus(drivePath).State == DriveSubtitlesFailed }, 30*time.Second, 50*time.Millisecond)
	require.False(t, r.DriveSubtitlesExtracted(drivePath))

	// Un estado de error no bloquea un nuevo intento.
	st, err := r.StartDriveSubtitleExtraction(drivePath, filepath.Join(t.TempDir(), "no-existe.mkv"), mi, 0)
	require.NoError(t, err)
	require.NotEqual(t, DriveSubtitlesDone, st.State)
}
