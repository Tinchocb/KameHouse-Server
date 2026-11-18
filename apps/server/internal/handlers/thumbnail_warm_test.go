package handlers

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util/cache"
)

func warmFiles(n int) []*dto.LocalFile {
	out := make([]*dto.LocalFile, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, &dto.LocalFile{Path: filepath.Join("lib", string(rune('a'+i))+".mkv")})
	}
	return out
}

func TestRunThumbnailWarmPool_ProcesaTodoYSaltaVacios(t *testing.T) {
	files := append(warmFiles(5), nil, &dto.LocalFile{})
	var generated, failed, done atomic.Int64
	runThumbnailWarmPool(context.Background(), files, 2, thumbnailWarmHooks{
		Generate: func(_ context.Context, lf *dto.LocalFile) (bool, error) {
			if filepath.Base(lf.Path) == "c.mkv" {
				return false, errors.New("ffmpeg falló")
			}
			return filepath.Base(lf.Path) != "a.mkv", nil // "a" ya existía
		},
		OnDone: func(gen bool, err error) {
			done.Add(1)
			if err != nil {
				failed.Add(1)
			} else if gen {
				generated.Add(1)
			}
		},
	})
	assert.EqualValues(t, 5, done.Load(), "los nil y las rutas vacías no cuentan")
	assert.EqualValues(t, 3, generated.Load())
	assert.EqualValues(t, 1, failed.Load())
}

func TestRunThumbnailWarmPool_UnPanicNoMataAlWorker(t *testing.T) {
	var done, failed atomic.Int64
	runThumbnailWarmPool(context.Background(), warmFiles(4), 1, thumbnailWarmHooks{
		Generate: func(_ context.Context, lf *dto.LocalFile) (bool, error) {
			if filepath.Base(lf.Path) == "a.mkv" {
				panic("archivo corrupto")
			}
			return true, nil
		},
		OnDone: func(_ bool, err error) {
			done.Add(1)
			if err != nil {
				failed.Add(1)
			}
		},
	})
	assert.EqualValues(t, 4, done.Load(), "con un solo worker, el panic del primero no puede frenar al resto")
	assert.EqualValues(t, 1, failed.Load())
}

func TestRunThumbnailWarmPool_PausaMientrasHayReproduccion(t *testing.T) {
	var busy atomic.Bool
	busy.Store(true)
	var started atomic.Int64
	finished := make(chan struct{})
	go func() {
		defer close(finished)
		runThumbnailWarmPool(context.Background(), warmFiles(3), 1, thumbnailWarmHooks{
			Generate: func(_ context.Context, _ *dto.LocalFile) (bool, error) {
				started.Add(1)
				return true, nil
			},
			Busy:     busy.Load,
			BusyPoll: 5 * time.Millisecond,
		})
	}()

	time.Sleep(80 * time.Millisecond)
	assert.EqualValues(t, 0, started.Load(), "no se genera nada mientras hay una reproducción activa")

	busy.Store(false)
	select {
	case <-finished:
	case <-time.After(3 * time.Second):
		t.Fatal("el pool no retomó al terminar la reproducción")
	}
	assert.EqualValues(t, 3, started.Load())
}

func TestRunThumbnailWarmPool_CancelarCortaLaEspera(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	finished := make(chan struct{})
	var started atomic.Int64
	go func() {
		defer close(finished)
		runThumbnailWarmPool(ctx, warmFiles(50), 2, thumbnailWarmHooks{
			Generate: func(_ context.Context, _ *dto.LocalFile) (bool, error) {
				started.Add(1)
				return true, nil
			},
			Busy:     func() bool { return true }, // reproducción eterna
			BusyPoll: time.Hour,
		})
	}()
	time.Sleep(30 * time.Millisecond)
	cancel()
	select {
	case <-finished:
	case <-time.After(3 * time.Second):
		t.Fatal("cancelar no liberó al pool")
	}
	assert.EqualValues(t, 0, started.Load())
}

func TestRunThumbnailWarmPool_CancelarAlAlimentar(t *testing.T) {
	// Más archivos que la cola: el productor queda bloqueado enviando y cancelar debe soltarlo.
	ctx, cancel := context.WithCancel(context.Background())
	release := make(chan struct{})
	finished := make(chan struct{})
	go func() {
		defer close(finished)
		runThumbnailWarmPool(ctx, warmFiles(thumbnailWarmQueueSize+20), 1, thumbnailWarmHooks{
			Generate: func(c context.Context, _ *dto.LocalFile) (bool, error) {
				<-release
				return true, c.Err()
			},
		})
	}()
	time.Sleep(30 * time.Millisecond)
	cancel()
	close(release)
	select {
	case <-finished:
	case <-time.After(3 * time.Second):
		t.Fatal("el productor quedó bloqueado tras cancelar")
	}
}

func TestEpisodeStillURLs(t *testing.T) {
	got := episodeStillURLs([]string{
		"https://image.tmdb.org/t/p/w780/a.jpg",
		"https://image.tmdb.org/t/p/original/a.jpg", // mismo still en otro tamaño: una sola URL w300
		"https://image.tmdb.org/t/p/w780/b.jpg",
		"/episodes/db/001.webp",
		"https://example.com/x.jpg",
		"",
	})
	assert.Equal(t, []string{
		"https://image.tmdb.org/t/p/w300/a.jpg",
		"https://image.tmdb.org/t/p/w300/b.jpg",
	}, got)
	assert.Empty(t, episodeStillURLs(nil))
}

func TestDriveThumbnailHash_CambiaConElArchivo(t *testing.T) {
	a := driveThumbnailHash("id1", 100)
	assert.Equal(t, a, driveThumbnailHash("id1", 100))
	assert.NotEqual(t, a, driveThumbnailHash("id1", 101), "otro mtime = otro frame")
	assert.NotEqual(t, a, driveThumbnailHash("id2", 100))
}

func TestDriveThumbnailKnownMissing(t *testing.T) {
	dir := t.TempDir()
	hash := driveThumbnailHash("sin-frame", 7)
	cacheFile := driveThumbnailCacheFile(dir, hash)
	require.NoError(t, os.MkdirAll(filepath.Dir(cacheFile), 0755))

	assert.False(t, driveThumbnailKnownMissing(hash, cacheFile))

	marker := driveThumbnailMissingMarker(cacheFile)
	require.NoError(t, os.WriteFile(marker, nil, 0644))
	assert.True(t, driveThumbnailKnownMissing(hash, cacheFile), "la marca en disco evita volver a preguntarle a Drive")

	old := time.Now().Add(-driveThumbMissingDiskTTL - time.Hour)
	require.NoError(t, os.Chtimes(marker, old, old))
	assert.False(t, driveThumbnailKnownMissing(hash, cacheFile), "la marca vence y se vuelve a intentar")

	driveThumbMissing.SetT(hash, true, driveThumbMissingTTL)
	t.Cleanup(func() { driveThumbMissing.Delete(hash) })
	assert.True(t, driveThumbnailKnownMissing(hash, cacheFile), "también en memoria")
}

func TestWarmOneThumbnail_ExistenteNoTocaFFmpeg(t *testing.T) {
	app, tempDir := setupTestApp(t)
	logger := zerolog.Nop()
	app.Logger = &logger
	app.Config.Cache.Dir = filepath.Join(tempDir, "cache")
	thumbCache, err := cache.NewThumbnailCache(10)
	require.NoError(t, err)
	app.ThumbnailCache = thumbCache
	h := &Handler{App: app}

	video := filepath.Join(tempDir, "ep01.mkv")
	require.NoError(t, os.WriteFile(video, []byte("no-es-video"), 0644))
	fi, err := os.Stat(video)
	require.NoError(t, err)
	cacheFile := filepath.Join(app.Config.Cache.Dir, "thumbnails", thumbnailHash(video, fi, nil)+".jpg")
	require.NoError(t, os.MkdirAll(filepath.Dir(cacheFile), 0755))
	require.NoError(t, os.WriteFile(cacheFile, []byte("jpeg"), 0644))

	generated, err := h.warmOneThumbnail(context.Background(), &dto.LocalFile{Path: video})
	require.NoError(t, err)
	assert.False(t, generated, "ya estaba en disco: se salta")

	// Archivo que ya no existe: error (cuenta como saltado), sin pánico.
	_, err = h.warmOneThumbnail(context.Background(), &dto.LocalFile{Path: filepath.Join(tempDir, "no-existe.mkv")})
	assert.Error(t, err)

	// Drive sin integración activa: no hay nada que hacer.
	generated, err = h.warmOneThumbnail(context.Background(), &dto.LocalFile{Path: "gdrive://x/y.mkv", DriveFileID: "x"})
	require.ErrorIs(t, err, errWarmIneligible)
	assert.False(t, generated)
}

func TestStartThumbnailWarm_NoArrancaOtroSiHayUnoEnCurso(t *testing.T) {
	app, tempDir := setupTestApp(t)
	logger := zerolog.Nop()
	app.Logger = &logger
	app.Config.Cache.Dir = filepath.Join(tempDir, "cache")
	h := &Handler{App: app}

	warmingMu.Lock()
	isThumbnailWarming.Store(true)
	warmingMu.Unlock()
	t.Cleanup(func() { isThumbnailWarming.Store(false) })

	started, _, err := h.startThumbnailWarm(thumbnailBackgroundWorkers, true)
	require.NoError(t, err)
	assert.False(t, started, "un escaneo durante el precalentado no duplica el trabajo")
}

func TestStartThumbnailWarm_SinArchivosTerminaYLiberaElEstado(t *testing.T) {
	app, tempDir := setupTestApp(t)
	logger := zerolog.Nop()
	app.Logger = &logger
	app.Config.Cache.Dir = filepath.Join(tempDir, "cache")
	h := &Handler{App: app}
	isThumbnailWarming.Store(false)

	started, total, err := h.startThumbnailWarm(thumbnailBackgroundWorkers, true)
	require.NoError(t, err)
	require.True(t, started)
	assert.Equal(t, 0, total)

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 200 && isThumbnailWarming.Load(); i++ {
			time.Sleep(10 * time.Millisecond)
		}
	}()
	wg.Wait()
	assert.False(t, isThumbnailWarming.Load(), "al terminar queda libre para el próximo escaneo")
}
