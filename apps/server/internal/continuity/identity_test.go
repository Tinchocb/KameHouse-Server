package continuity

import (
	"context"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/util"
	"kamehouse/internal/util/filecache"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func newTestManager(t *testing.T) (*Manager, *db.Database) {
	t.Helper()
	logger := util.NewLogger()
	tempDir := t.TempDir()

	database, err := db.NewDatabase(context.Background(), tempDir, "test-identity", logger)
	require.NoError(t, err)

	cacher, err := filecache.NewCacher(filepath.Join(tempDir, "cache"))
	require.NoError(t, err)

	m := NewManager(&NewManagerOptions{FileCacher: cacher, Logger: logger, Database: database})
	// Cleanups en LIFO: parar el flush antes de cerrar la DB, y cerrarla antes
	// de que TempDir intente borrar el .db (Windows no borra archivos abiertos).
	t.Cleanup(func() { _ = database.Close() })
	t.Cleanup(m.TelemetryManager.Stop)
	return m, database
}

// Hay una clave por media+episodio; GetWatchHistory debe quedarse con el
// episodio actualizado más recientemente, no con uno arbitrario.
func TestGetWatchHistoryKeepsLatestEpisodePerMedia(t *testing.T) {
	m, _ := newTestManager(t)

	for _, ep := range []int{1, 2, 3} {
		require.NoError(t, m.UpdateWatchHistoryItem(&UpdateWatchHistoryItemOptions{MediaID: 99, EpisodeNumber: ep, CurrentTime: 10, Duration: 100}))
		time.Sleep(5 * time.Millisecond)
	}
	// Volver al episodio 1: pasa a ser el más reciente.
	require.NoError(t, m.UpdateWatchHistoryItem(&UpdateWatchHistoryItemOptions{MediaID: 99, EpisodeNumber: 1, CurrentTime: 50, Duration: 100}))

	for i := 0; i < 20; i++ { // el orden de iteración del map es aleatorio
		wh := m.GetWatchHistory()
		require.Len(t, wh, 1)
		require.Equal(t, 1, wh[99].EpisodeNumber)
		require.Equal(t, 50.0, wh[99].CurrentTime)
	}
}

// El espejo en DB debe respetar account_id: misma media en dos cuentas son dos
// filas, y beats repetidos de una cuenta actualizan su fila sin duplicar.
func TestTelemetryFlushRespectsAccountID(t *testing.T) {
	m, database := newTestManager(t)
	tm := m.TelemetryManager

	tm.UpdateProgress(1, 42, 2, 100, 1400)
	tm.UpdateProgress(2, 42, 2, 200, 1400)
	tm.flush()
	tm.UpdateProgress(1, 42, 2, 300, 1400)
	tm.flush()

	var rows []models.WatchHistory
	require.NoError(t, database.Gorm().Where("media_id = ?", 42).Order("account_id").Find(&rows).Error)
	require.Len(t, rows, 2)
	require.Equal(t, uint(1), rows[0].AccountID)
	require.Equal(t, 300.0, rows[0].CurrentTime)
	require.Equal(t, uint(2), rows[1].AccountID)
	require.Equal(t, 200.0, rows[1].CurrentTime)
}
