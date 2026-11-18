package metadata_provider

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"kamehouse/internal/api/jikan"
	apiMetadata "kamehouse/internal/api/metadata"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
)

func TestProviderClearDoesNotRepublishRetiredPersistentRead(t *testing.T) {
	for _, kind := range []string{"jikan", "tmdb"} {
		t.Run(kind, func(t *testing.T) {
			logger := zerolog.Nop()
			database, err := db.NewDatabase(t.Context(), t.TempDir(), "generations", &logger)
			require.NoError(t, err)
			defer database.Close()
			waitGenerationMigrations(t, database)
			providerKey := kind + "-anime-episodes"
			cacheKey := "public-v2:42"
			if kind == "tmdb" {
				cacheKey = "public-v2:SHOW:42:es-MX"
			}
			require.NoError(t, db.UpsertMetadataCache(database, providerKey, cacheKey, &apiMetadata.AnimeMetadata{EpisodeCount: 1}, time.Hour))
			var provider Provider
			var jikanProvider *JikanProviderImpl
			if kind == "jikan" {
				jikanProvider = NewJikanProviderImpl(nil, database, &logger, nil)
				provider = jikanProvider
			} else {
				provider = NewTMDBProviderImpl(nil, database, &logger)
			}
			started, release := make(chan struct{}), make(chan struct{})
			var matches atomic.Int32
			require.NoError(t, database.Gorm().Callback().Query().After("gorm:query").Register("fixture:hold_retired_metadata", func(tx *gorm.DB) {
				for _, arg := range tx.Statement.Vars {
					if arg == providerKey && matches.Add(1) == 1 {
						close(started)
						<-release
						return
					}
				}
			}))
			oldDone := make(chan struct{})
			var once sync.Once
			defer once.Do(func() { close(release) })
			go func() { defer close(oldDone); _, _ = provider.GetAnimeMetadata(42) }()
			waitGenerationSignal(t, started)
			var callDone <-chan struct{}
			if jikanProvider != nil {
				jikanProvider.mu.Lock()
				callDone = jikanProvider.inflight[42].done
				jikanProvider.mu.Unlock()
			} else {
				callDone = oldDone
			}
			defer func() { once.Do(func() { close(release) }); <-callDone; <-oldDone }()
			provider.ClearCache()
			require.NoError(t, db.UpsertMetadataCache(database, providerKey, cacheKey, &apiMetadata.AnimeMetadata{EpisodeCount: 2}, time.Hour))
			fresh, err := provider.GetAnimeMetadata(42)
			if err != nil || fresh == nil || fresh.EpisodeCount != 2 {
				t.Errorf("new generation joined or read retired work: %+v %v", fresh, err)
			}
			once.Do(func() { close(release) })
			<-callDone
			got, err := provider.GetAnimeMetadata(42)
			require.NoError(t, err)
			require.NotNil(t, got)
			require.Equal(t, 2, got.EpisodeCount, "retired load republished over the current generation")
		})
	}
}

func TestJikanRetiredFailureCannotDeleteNewFlightOrPersistOutage(t *testing.T) {
	logger := zerolog.Nop()
	database, err := db.NewDatabase(t.Context(), t.TempDir(), "outage", &logger)
	require.NoError(t, err)
	defer database.Close()
	waitGenerationMigrations(t, database)
	p := NewJikanProviderImpl(nil, database, &logger, nil)
	oldStarted, newStarted := make(chan struct{}), make(chan struct{})
	oldRelease, newRelease := make(chan struct{}), make(chan struct{})
	var calls atomic.Int32
	p.fetchFn = func(int) (*apiMetadata.AnimeMetadata, error) {
		if calls.Add(1) == 1 {
			close(oldStarted)
			<-oldRelease
			return nil, fmt.Errorf("retired request: %w", jikan.ErrUnavailable)
		}
		close(newStarted)
		<-newRelease
		return &apiMetadata.AnimeMetadata{EpisodeCount: 2}, nil
	}
	oldDone, newDone := make(chan struct{}), make(chan struct{})
	go func() { defer close(oldDone); _, _ = p.GetAnimeMetadata(42) }()
	var oldOnce, newOnce sync.Once
	defer oldOnce.Do(func() { close(oldRelease) })
	defer newOnce.Do(func() { close(newRelease) })
	waitGenerationSignal(t, oldStarted)
	p.mu.Lock()
	oldCall := p.inflight[42]
	p.mu.Unlock()
	p.ClearCache()
	go func() { defer close(newDone); _, _ = p.GetAnimeMetadata(42) }()
	defer func() {
		oldOnce.Do(func() { close(oldRelease) })
		newOnce.Do(func() { close(newRelease) })
		<-oldDone
		<-newDone
	}()
	waitGenerationSignal(t, newStarted)
	p.mu.Lock()
	newCall := p.inflight[42]
	p.mu.Unlock()
	defer func() {
		oldOnce.Do(func() { close(oldRelease) })
		newOnce.Do(func() { close(newRelease) })
		<-oldCall.done
		<-newCall.done
		<-oldDone
		<-newDone
	}()
	oldOnce.Do(func() { close(oldRelease) })
	<-oldCall.done
	p.mu.Lock()
	same := p.inflight[42] == newCall
	outage := p.unavailableUntil
	failure := p.failedUntil[42]
	p.mu.Unlock()
	require.True(t, same, "retired completion deleted the new flight")
	require.True(t, outage.IsZero(), "retired failure marked current provider unavailable")
	require.True(t, failure.IsZero(), "retired failure poisoned the current ID")
	var until time.Time
	found, err := db.GetMetadataCache(database, jikanOutageProvider, jikanOutageKey, &until)
	require.NoError(t, err)
	require.False(t, found, "retired failure persisted an outage after invalidation")
	newOnce.Do(func() { close(newRelease) })
	<-newCall.done
	require.False(t, errors.Is(newCall.err, jikan.ErrUnavailable))
}

func TestTMDBRetiredNetworkLoadCannotPublishDurably(t *testing.T) {
	logger := zerolog.Nop()
	database, err := db.NewDatabase(t.Context(), t.TempDir(), "durable", &logger)
	require.NoError(t, err)
	defer database.Close()
	waitGenerationMigrations(t, database)
	require.NoError(t, database.Gorm().Create(&models.LibraryMedia{BaseModel: models.BaseModel{ID: 42}, TmdbID: 99999, Type: "SHOW", Format: "TV"}).Error)
	started, release := make(chan struct{}), make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !strings.Contains(r.URL.Path, "/season/") {
			close(started)
			<-release
			fmt.Fprint(w, `{"id":99999,"name":"Fixture","number_of_seasons":1}`)
			return
		}
		fmt.Fprint(w, `{"episodes":[{"episode_number":1,"name":"Episode"}]}`)
	}))
	defer server.Close()
	client := tmdb.NewClient("isolated-fixture", "en-US")
	client.SetHTTPClient(&http.Client{Transport: tmdbFixtureTransport{target: server.URL, base: server.Client().Transport}})
	p := NewTMDBProviderImpl(client, database, &logger)
	done := make(chan struct{})
	go func() {
		defer close(done)
		_, err := p.GetAnimeMetadata(99999)
		if err != nil {
			t.Error(err)
		}
	}()
	var once sync.Once
	defer func() { once.Do(func() { close(release) }); <-done }()
	waitGenerationSignal(t, started)
	p.ClearCache()
	once.Do(func() { close(release) })
	<-done
	p.mu.Lock()
	entry := p.cache[99999]
	p.mu.Unlock()
	require.Nil(t, entry, "retired HTTP load republished memory cache")
	var persisted apiMetadata.AnimeMetadata
	found, err := db.GetMetadataCache(database, "tmdb-anime-episodes", "public-v2:SHOW:99999:en-US", &persisted)
	require.NoError(t, err)
	require.False(t, found, "retired HTTP load persisted after ClearCache")
}

func waitGenerationMigrations(t *testing.T, database *db.Database) {
	t.Helper()
	for {
		done, err := database.MigrationStatus()
		require.NoError(t, err)
		if done {
			return
		}
		select {
		case <-t.Context().Done():
			t.Fatal(t.Context().Err())
		case <-time.After(time.Millisecond):
		}
	}
}

func waitGenerationSignal(t *testing.T, signal <-chan struct{}) {
	t.Helper()
	select {
	case <-signal:
	case <-time.After(2 * time.Second):
		t.Fatal("fixture did not reach its barrier")
	}
}

func TestProviderPublicationDoesNotHoldMemoryMutexDuringSQLite(t *testing.T) {
	for _, kind := range []string{"jikan", "tmdb"} {
		t.Run(kind, func(t *testing.T) {
			logger := zerolog.Nop()
			database, err := db.NewDatabase(t.Context(), t.TempDir(), "publication", &logger)
			require.NoError(t, err)
			defer database.Close()
			waitGenerationMigrations(t, database)
			providerKey := kind + "-anime-episodes"
			started, release := make(chan struct{}), make(chan struct{})
			require.NoError(t, database.Gorm().Callback().Create().Before("gorm:create").Register("fixture:hold_metadata_write", func(tx *gorm.DB) {
				if value, ok := tx.Statement.Dest.(*models.MetadataCache); ok && value.Provider == providerKey {
					close(started)
					<-release
				}
			}))
			data := &apiMetadata.AnimeMetadata{EpisodeCount: 3}
			var provider Provider
			var publish func()
			if kind == "jikan" {
				p := NewJikanProviderImpl(nil, database, &logger, nil)
				provider = p
				publish = func() { p.publishMetadata(0, 42, data, true) }
			} else {
				p := NewTMDBProviderImpl(nil, database, &logger)
				provider = p
				publish = func() { p.publishMetadata(0, 42, 42, data, true) }
			}
			written := make(chan struct{})
			go func() { defer close(written); publish() }()
			var once sync.Once
			defer func() { once.Do(func() { close(release) }); <-written }()
			waitGenerationSignal(t, started)
			warm := make(chan error, 1)
			go func() {
				got, err := provider.GetAnimeMetadata(42)
				if err == nil && got != data {
					err = fmt.Errorf("warm hit returned another object")
				}
				warm <- err
			}()
			select {
			case err := <-warm:
				require.NoError(t, err)
			case <-time.After(time.Second):
				t.Fatal("SQLite write blocked a warm memory hit")
			}
			cleared := make(chan struct{})
			go func() { defer close(cleared); provider.ClearCache() }()
			select {
			case <-cleared:
				t.Error("ClearCache returned before the admitted durable write finished")
			case <-time.After(20 * time.Millisecond):
			}
			once.Do(func() { close(release) })
			waitGenerationSignal(t, cleared)
		})
	}
}
