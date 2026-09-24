package drive

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
)

func TestExtractEpisodeNumber(t *testing.T) {
	tests := []struct {
		filename string
		expected int
		found    bool
	}{
		{"Dragon Ball Kai - 01.mkv", 1, true},
		{"[Team] Dragon Ball Kai - 005 [1080p].mkv", 5, true},
		{"Dragon Ball Z Kai S01E017.mkv", 17, true},
		{"Kai - E055 - El despertar de los androides.mkv", 55, true},
		{"Dragon.Ball.Kai.E145.1080p.mkv", 145, true},
		{"DBK - 167 - Final.mkv", 167, true},
		{"Dragon Ball Kai Episodio 23.mkv", 23, true},
		{"Dragon Ball Kai Capitulo 99.mkv", 99, true},
		{"Dragon Ball Super S1E112 Multi by aensy77.mkv", 112, true},
		{"JustSomeRandomMovie.mkv", 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			ep, ok := ExtractEpisodeNumber(tt.filename)
			assert.Equal(t, tt.found, ok, "found status for %s", tt.filename)
			if tt.found {
				assert.Equal(t, tt.expected, ep, "episode number for %s", tt.filename)
			}
		})
	}
}

func TestResolveKaiSaga(t *testing.T) {
	tests := []struct {
		episode  int
		expected string
		sagaID   string
		season   int
	}{
		{1, "Saga de los Saiyajin", "saiyajin", 1},
		{17, "Saga de los Saiyajin", "saiyajin", 1},
		{18, "Saga de Freezer", "namek-freezer", 2},
		{54, "Saga de Freezer", "namek-freezer", 2},
		{55, "Saga de los Androides y Cell", "androides-cell", 3},
		{98, "Saga de los Androides y Cell", "androides-cell", 3},
		{99, "Saga de Majin Buu", "majin-buu", 4},
		{167, "Saga de Majin Buu", "majin-buu", 4},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			saga, id, season := ResolveKaiSaga(tt.episode)
			assert.Equal(t, tt.expected, saga)
			assert.Equal(t, tt.sagaID, id)
			assert.Equal(t, tt.season, season)
		})
	}
}

func TestResolveDriveFile(t *testing.T) {
	tests := []struct {
		name          string
		file          DriveFile
		wantTmdbID    int
		wantMovie     bool
		wantEpisode   int
		wantSagaID    string
		wantType      string
	}{
		{
			name: "Dragon Ball Z - Saiyajin Saga E001",
			file: DriveFile{
				RelativePath: "(1989-1996) Dragon Ball Z/(1989-04-26) Saga de los Saiyajin - E001 - Aparece un mini Gokū, su nombre es Gohan.mkv",
				Name:         "(1989-04-26) Saga de los Saiyajin - E001 - Aparece un mini Gokū, su nombre es Gohan.mkv",
			},
			wantTmdbID:  12971,
			wantMovie:   false,
			wantEpisode: 1,
			wantSagaID:  "saiyajin",
			wantType:    "SHOW",
		},
		{
			name: "Dragon Ball Z - Cell Saga E140",
			file: DriveFile{
				RelativePath: "(1989-1996) Dragon Ball Z/(1992-05-20) Saga de Cell - E140 - Un misterioso huevo encontrado en la máquina del tiempo.mkv",
				Name:         "(1992-05-20) Saga de Cell - E140 - Un misterioso huevo encontrado en la máquina del tiempo.mkv",
			},
			wantTmdbID:  12971,
			wantMovie:   false,
			wantEpisode: 140,
			wantSagaID:  "cell",
			wantType:    "SHOW",
		},
		{
			name: "Dragon Ball Z Movie 01 - Dead Zone",
			file: DriveFile{
				RelativePath: "(1989-1996) Dragon Ball Z/Películas de Dragon Ball Z/Dragon Ball Z - Pelicula 01 - Dead Zone.mkv",
				Name:         "Dragon Ball Z - Pelicula 01 - Dead Zone.mkv",
			},
			wantTmdbID:  28609,
			wantMovie:   true,
			wantEpisode: 1,
			wantSagaID:  "movie-28609",
			wantType:    "MOVIE",
		},
		{
			name: "Dragon Ball Super - Episode 47",
			file: DriveFile{
				RelativePath: "(2015-2018) Dragon Ball Super/(2016-06-12) Saga de Goku Black - E047 - ¡Llamada de auxilio desde el futuro! ¡Un nuevo enemigo oscuro aparece!.mkv",
				Name:         "(2016-06-12) Saga de Goku Black - E047 - ¡Llamada de auxilio desde el futuro! ¡Un nuevo enemigo oscuro aparece!.mkv",
			},
			wantTmdbID:  62715,
			wantMovie:   false,
			wantEpisode: 47,
			wantSagaID:  "trunks-futuro",
			wantType:    "SHOW",
		},
		{
			name: "Dragon Ball Super - S1E112 Multi",
			file: DriveFile{
				RelativePath: "(2015-2018) Dragon Ball Super/Dragon Ball Super S1E112 Multi by aensy77.mkv",
				Name:         "Dragon Ball Super S1E112 Multi by aensy77.mkv",
			},
			wantTmdbID:  62715,
			wantMovie:   false,
			wantEpisode: 112,
			wantSagaID:  "torneo-poder",
			wantType:    "SHOW",
		},
		{
			name: "Dragon Ball Super - Super Hero Movie",
			file: DriveFile{
				RelativePath: "(2015-2018) Dragon Ball Super/Películas de Dragon Ball Super/(2022-06-11) Dragon Ball Super - Super Hero.mkv",
				Name:         "(2022-06-11) Dragon Ball Super - Super Hero.mkv",
			},
			wantTmdbID:  610150,
			wantMovie:   true,
			wantEpisode: 1,
			wantSagaID:  "movie-610150",
			wantType:    "MOVIE",
		},
		{
			name: "Dragon Ball Daima - Episode 01",
			file: DriveFile{
				RelativePath: "(2024-2025) Dragon Ball Daima/(2024-10-11) Saga de Daima - E001 - Conspiración.mkv",
				Name:         "(2024-10-11) Saga de Daima - E001 - Conspiración.mkv",
			},
			wantTmdbID:  236994,
			wantMovie:   false,
			wantEpisode: 1,
			wantSagaID:  "daima",
			wantType:    "SHOW",
		},
		{
			name: "Dragon Ball GT - Episode 01",
			file: DriveFile{
				RelativePath: "(1996-1997) Dragon Ball GT/(1996-02-07) Saga del Gran Viaje - E001 - Unas misteriosas esferas de dragón aparecen.mkv",
				Name:         "(1996-02-07) Saga del Gran Viaje - E001 - Unas misteriosas esferas de dragón aparecen.mkv",
			},
			wantTmdbID:  12697,
			wantMovie:   false,
			wantEpisode: 1,
			wantSagaID:  "black-star",
			wantType:    "SHOW",
		},
		{
			name: "Classic Dragon Ball - Episode 01",
			file: DriveFile{
				RelativePath: "(1986-1989) Dragon Ball/(1986-02-26) Saga del Emperador Pilaf - E001 - El Secreto de la Esfera del Dragón.mkv",
				Name:         "(1986-02-26) Saga del Emperador Pilaf - E001 - El Secreto de la Esfera del Dragón.mkv",
			},
			wantTmdbID:  12609,
			wantMovie:   false,
			wantEpisode: 1,
			wantSagaID:  "pilaf",
			wantType:    "SHOW",
		},
		{
			name: "Dragon Ball Kai Flat - Episode 55",
			file: DriveFile{
				RelativePath: "Dragon Ball Kai - 55.mkv",
				Name:         "Dragon Ball Kai - 55.mkv",
			},
			wantTmdbID:  61709,
			wantMovie:   false,
			wantEpisode: 55,
			wantSagaID:  "androides-cell",
			wantType:    "SHOW",
		},
		{
			name: "Future Anime - Naruto Shippuden E001",
			file: DriveFile{
				RelativePath: "Naruto Shippuden/Season 01/Naruto Shippuden - E001 - Return.mkv",
				Name:         "Naruto Shippuden - E001 - Return.mkv",
			},
			wantTmdbID:  0, // Synthetic ID > 0
			wantMovie:   false,
			wantEpisode: 1,
			wantSagaID:  "main",
			wantType:    "SHOW",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := ResolveDriveFile(tt.file, 1)
			if tt.wantTmdbID > 0 {
				assert.Equal(t, tt.wantTmdbID, res.RawTmdbID, "RawTmdbID mismatch")
			} else {
				assert.True(t, res.RawTmdbID >= 90000000, "Expected synthetic TMDB ID >= 90000000")
			}
			assert.Equal(t, tt.wantMovie, res.IsMovie, "IsMovie mismatch")
			assert.Equal(t, tt.wantEpisode, res.EpisodeNumber, "EpisodeNumber mismatch")
			assert.Equal(t, tt.wantSagaID, res.SagaID, "SagaID mismatch")
			assert.Equal(t, tt.wantType, res.MediaType, "MediaType mismatch")
		})
	}
}

func TestResolveDriveFile_EpisodeMentioningMovieStaysEpisode(t *testing.T) {
	res := ResolveDriveFile(DriveFile{
		RelativePath: "(2015-2018) Dragon Ball Super/Episodios/(2017-01-08) Saga de Trunks del Futuro - E073 - ¡La mala suerte de Gohan! ¿¡El Gran Saiyaman tendrá su propia película!?.mkv",
		Name:         "(2017-01-08) Saga de Trunks del Futuro - E073 - ¡La mala suerte de Gohan! ¿¡El Gran Saiyaman tendrá su propia película!?.mkv",
	}, 1)
	assert.False(t, res.IsMovie)
	assert.Equal(t, 62715, res.RawTmdbID)
	assert.Equal(t, 73, res.EpisodeNumber)
}

// La saga no debe usarse como temporada: el escáner local y TMDB numeran las series
// de Dragon Ball en la temporada 1 y ambas copias deben agruparse en el mismo episodio.
func TestResolveDriveFile_DragonBallSeriesUseSeasonOne(t *testing.T) {
	for _, f := range []DriveFile{
		{RelativePath: "(1989-1996) Dragon Ball Z/(1990-10-24) Saga de Freezer - E100 - x.mkv", Name: "(1990-10-24) Saga de Freezer - E100 - x.mkv"},
		{RelativePath: "Dragon Ball Kai - 120.mkv", Name: "Dragon Ball Kai - 120.mkv"},
	} {
		res := ResolveDriveFile(f, 1)
		assert.Equal(t, 1, res.SeasonNumber, f.Name)
		assert.NotEmpty(t, res.SagaID, f.Name)
	}
}

func TestGetAuthURL(t *testing.T) {
	url := GetAuthURL("test-client-id", "test-secret", "http://localhost:8080/callback", "test-state")
	assert.True(t, strings.HasPrefix(url, "https://accounts.google.com/o/oauth2/auth"))
	assert.Contains(t, url, "client_id=test-client-id")
	assert.Contains(t, url, "redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fcallback")
	assert.Contains(t, url, "access_type=offline")
	assert.Contains(t, url, "prompt=consent")
}

func TestDriveFileIsVideo(t *testing.T) {
	f1 := DriveFile{Name: "ep1.mkv", MimeType: "video/x-matroska"}
	assert.True(t, f1.IsVideo())

	f2 := DriveFile{Name: "ep2.mp4", MimeType: "application/octet-stream"}
	assert.True(t, f2.IsVideo())

	f3 := DriveFile{Name: "poster.jpg", MimeType: "image/jpeg"}
	assert.False(t, f3.IsVideo())
}

func TestCleanFolderID(t *testing.T) {
	assert.Equal(t, "1a2b3c4d", CleanFolderID("1a2b3c4d"))
	assert.Equal(t, "1a2b3c4d", CleanFolderID("https://drive.google.com/drive/folders/1a2b3c4d"))
	assert.Equal(t, "1a2b3c4d", CleanFolderID("https://drive.google.com/drive/folders/1a2b3c4d?usp=sharing"))
	assert.Equal(t, "1a2b3c4d", CleanFolderID("  https://drive.google.com/drive/u/0/folders/1a2b3c4d#heading  "))
}

func TestServiceUserInfoCaching(t *testing.T) {
	logger := zerolog.Nop()
	svc := NewService(&logger)

	// Simulate cached info
	svc.cachedEmail = "test@example.com"
	svc.cachedName = "Test User"
	svc.userInfoCachedAt = time.Now()
	svc.enabled = true
	svc.client = &Client{} // dummy non-nil client

	status := svc.GetStatus(context.Background(), 10)
	assert.True(t, status.Connected)
	assert.Equal(t, "test@example.com", status.UserEmail)
	assert.Equal(t, "Test User", status.DisplayName)
	assert.Equal(t, 10, status.IndexedEpisodes)

	// Invalidate on UpdateConfig
	_ = svc.UpdateConfig(false, "", "", "", "", "")
	assert.Empty(t, svc.cachedEmail)
	assert.Empty(t, svc.cachedName)
	assert.True(t, svc.userInfoCachedAt.IsZero())
}
