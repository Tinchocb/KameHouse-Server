package metadata_provider

import (
	"context"
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
	apiMetadata "kamehouse/internal/api/metadata"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
)

func TestJikanCloseJoinsProducerAfterPendingResponse(t *testing.T) {
	oldWait := jikanInlineWait
	jikanInlineWait = 10 * time.Millisecond
	defer func() { jikanInlineWait = oldWait }()
	p := NewJikanProviderImpl(nil, nil, nil, nil)
	cancelled, release := make(chan struct{}), make(chan struct{})
	p.fetchFn = func(int) (*apiMetadata.AnimeMetadata, error) {
		<-p.ctx.Done()
		close(cancelled)
		<-release
		return nil, p.ctx.Err()
	}
	_, err := p.GetAnimeMetadata(42)
	require.True(t, IsMetadataPending(err))
	closed := make(chan struct{})
	go func() { defer close(closed); _ = p.Close() }()
	var once sync.Once
	defer func() { once.Do(func() { close(release) }); <-closed }()
	waitGenerationSignal(t, cancelled)
	select {
	case <-closed:
		t.Fatal("Close returned while the admitted producer was still running")
	default:
	}
	once.Do(func() { close(release) })
	waitGenerationSignal(t, closed)
	_, err = p.GetAnimeMetadata(42)
	require.ErrorIs(t, err, context.Canceled)
	require.NoError(t, p.Close())
}

func TestTMDBCloseJoinsAdmittedSQLiteWrite(t *testing.T) {
	logger := zerolog.Nop()
	database, err := db.NewDatabase(t.Context(), t.TempDir(), "close", &logger)
	require.NoError(t, err)
	defer database.Close()
	waitGenerationMigrations(t, database)
	writing, release := make(chan struct{}), make(chan struct{})
	var writes atomic.Int32
	require.NoError(t, database.Gorm().Callback().Create().Before("gorm:create").Register("fixture:admitted_provider_write", func(tx *gorm.DB) {
		if value, ok := tx.Statement.Dest.(*models.MetadataCache); ok && value.Provider == "tmdb-anime-episodes" {
			writes.Add(1)
			close(writing)
			<-release
		}
	}))
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !strings.Contains(r.URL.Path, "/season/") {
			fmt.Fprint(w, `{"id":99999,"name":"Fixture","number_of_seasons":1}`)
			return
		}
		fmt.Fprint(w, `{"episodes":[{"episode_number":1,"name":"Episode"}]}`)
	}))
	defer server.Close()
	client := tmdb.NewClient("isolated-fixture", "en-US")
	client.SetHTTPClient(&http.Client{Transport: tmdbFixtureTransport{target: server.URL, base: server.Client().Transport}})
	p := NewTMDBProviderImpl(client, database, &logger)
	loaded := make(chan struct{})
	go func() {
		defer close(loaded)
		_, err := p.GetAnimeMetadata(99999)
		if err != nil {
			t.Error(err)
		}
	}()
	var once sync.Once
	defer func() { once.Do(func() { close(release) }); <-loaded }()
	waitGenerationSignal(t, writing)
	closed := make(chan struct{})
	go func() { defer close(closed); _ = p.Close() }()
	waitGenerationSignal(t, p.ctx.Done())
	select {
	case <-closed:
		t.Fatal("Close returned before the admitted SQL write finished")
	default:
	}
	once.Do(func() { close(release) })
	waitGenerationSignal(t, closed)
	_, err = p.GetAnimeMetadata(99999)
	require.True(t, errors.Is(err, context.Canceled))
	require.Equal(t, int32(1), writes.Load(), "no later call may start another durable write")
	require.NoError(t, p.Close())
}
