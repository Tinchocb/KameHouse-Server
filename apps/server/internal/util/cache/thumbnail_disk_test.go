package cache

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestThumbnailCache_MemoryMetrics(t *testing.T) {
	c, err := NewThumbnailCache(5)
	require.NoError(t, err)

	// Initially empty
	hits, misses, count := c.Stats()
	assert.Equal(t, uint64(0), hits)
	assert.Equal(t, uint64(0), misses)
	assert.Equal(t, 0, count)

	// Miss
	_, found := c.Get("nonexistent")
	assert.False(t, found)
	hits, misses, count = c.Stats()
	assert.Equal(t, uint64(0), hits)
	assert.Equal(t, uint64(1), misses)

	// Set & Hit
	c.Set("img1", []byte("thumbnail-data-1"))
	val, found := c.Get("img1")
	assert.True(t, found)
	assert.Equal(t, []byte("thumbnail-data-1"), val)

	hits, misses, count = c.Stats()
	assert.Equal(t, uint64(1), hits)
	assert.Equal(t, uint64(1), misses)
	assert.Equal(t, 1, count)
	assert.Equal(t, 1, c.Len())
}

func TestThumbnailCache_ByteLimitEviction(t *testing.T) {
	// Límite de 50 bytes
	c, err := NewThumbnailCache(10, 50)
	require.NoError(t, err)

	data20 := make([]byte, 20)
	c.Set("img1", data20)
	assert.Equal(t, int64(20), c.BytesUsed())

	c.Set("img2", data20)
	assert.Equal(t, int64(40), c.BytesUsed())

	// Agregar 20 bytes más (total sería 60 > 50) debe desalojar "img1"
	c.Set("img3", data20)
	assert.LessOrEqual(t, c.BytesUsed(), int64(50))
	assert.Equal(t, int64(40), c.BytesUsed())

	_, found1 := c.Get("img1")
	assert.False(t, found1, "img1 should have been evicted to respect byte limit")
	_, found2 := c.Get("img2")
	assert.True(t, found2)
	_, found3 := c.Get("img3")
	assert.True(t, found3)

	c.Purge()
	assert.Equal(t, int64(0), c.BytesUsed())
	assert.Equal(t, 0, c.Len())
}

func TestPruneDirectory_Generic(t *testing.T) {
	tmpDir := t.TempDir()

	// Crear archivos .json y .tmp
	require.NoError(t, os.WriteFile(filepath.Join(tmpDir, "kf1.json"), make([]byte, 500), 0644))
	require.NoError(t, os.WriteFile(filepath.Join(tmpDir, "kf2.json"), make([]byte, 500), 0644))

	// Prune con maxSizeBytes = 700 debe desalojar el más viejo hasta quedar <= 80% (560)
	past := time.Now().Add(-2 * time.Hour)
	_ = os.Chtimes(filepath.Join(tmpDir, "kf1.json"), past, past)

	freed, count, err := PruneDirectory(tmpDir, ".json", 0, 700)
	require.NoError(t, err)
	assert.Equal(t, int64(500), freed)
	assert.Equal(t, 1, count)
}

func TestPruneDiskCache_TTLEviction(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a fresh file (10 minutes old) and an expired file (40 days old)
	now := time.Now()
	freshFile := filepath.Join(tmpDir, "fresh.jpg")
	expiredFile := filepath.Join(tmpDir, "expired.jpg")

	require.NoError(t, os.WriteFile(freshFile, make([]byte, 1000), 0644))
	require.NoError(t, os.WriteFile(expiredFile, make([]byte, 2000), 0644))

	_ = os.Chtimes(freshFile, now.Add(-10*time.Minute), now.Add(-10*time.Minute))
	_ = os.Chtimes(expiredFile, now.Add(-40*24*time.Hour), now.Add(-40*24*time.Hour))

	freed, count, err := PruneDiskCache(tmpDir, 30*24*time.Hour, 0)
	require.NoError(t, err)
	assert.Equal(t, int64(2000), freed)
	assert.Equal(t, 1, count)

	// Expired file should be gone, fresh should remain
	assert.NoFileExists(t, expiredFile)
	assert.FileExists(t, freshFile)
}

func TestPruneDiskCache_SizeEviction(t *testing.T) {
	tmpDir := t.TempDir()

	now := time.Now()
	// Create 3 files of 1000 bytes each (Total 3000 bytes)
	f1 := filepath.Join(tmpDir, "file1.jpg") // Oldest
	f2 := filepath.Join(tmpDir, "file2.jpg") // Middle
	f3 := filepath.Join(tmpDir, "file3.jpg") // Newest

	require.NoError(t, os.WriteFile(f1, make([]byte, 1000), 0644))
	require.NoError(t, os.WriteFile(f2, make([]byte, 1000), 0644))
	require.NoError(t, os.WriteFile(f3, make([]byte, 1000), 0644))

	_ = os.Chtimes(f1, now.Add(-3*time.Hour), now.Add(-3*time.Hour))
	_ = os.Chtimes(f2, now.Add(-2*time.Hour), now.Add(-2*time.Hour))
	_ = os.Chtimes(f3, now.Add(-1*time.Hour), now.Add(-1*time.Hour))

	// Max size: 2000 bytes. Low-water mark 80% = 1600 bytes.
	// Total size is 3000, so we must delete until <= 1600 bytes.
	// Deleting f1 (1000B) brings it to 2000B (which is > 1600).
	// Deleting f2 (1000B) brings it to 1000B (which is <= 1600).
	// So f1 and f2 should be evicted, and f3 should remain.
	freed, count, err := PruneDiskCache(tmpDir, 0, 2000)
	require.NoError(t, err)
	assert.Equal(t, int64(2000), freed)
	assert.Equal(t, 2, count)

	assert.NoFileExists(t, f1)
	assert.NoFileExists(t, f2)
	assert.FileExists(t, f3)
}

func TestPruneDiskCache_OrphanedTmpFiles(t *testing.T) {
	tmpDir := t.TempDir()

	now := time.Now()
	staleTmp := filepath.Join(tmpDir, "thumb.12345.tmp")
	freshTmp := filepath.Join(tmpDir, "thumb.67890.tmp")

	require.NoError(t, os.WriteFile(staleTmp, make([]byte, 500), 0644))
	require.NoError(t, os.WriteFile(freshTmp, make([]byte, 500), 0644))

	_ = os.Chtimes(staleTmp, now.Add(-2*time.Hour), now.Add(-2*time.Hour))
	_ = os.Chtimes(freshTmp, now.Add(-5*time.Minute), now.Add(-5*time.Minute))

	freed, count, err := PruneDiskCache(tmpDir, 0, 0)
	require.NoError(t, err)
	assert.Equal(t, int64(500), freed)
	assert.Equal(t, 1, count)

	assert.NoFileExists(t, staleTmp)
	assert.FileExists(t, freshTmp)
}

func TestTouchDiskCache(t *testing.T) {
	tmpDir := t.TempDir()
	f := filepath.Join(tmpDir, "test.jpg")
	require.NoError(t, os.WriteFile(f, []byte("data"), 0644))

	past := time.Now().Add(-10 * time.Hour)
	_ = os.Chtimes(f, past, past)

	infoBefore, err := os.Stat(f)
	require.NoError(t, err)
	assert.True(t, infoBefore.ModTime().Before(time.Now().Add(-9*time.Hour)))

	TouchDiskCache(f)

	infoAfter, err := os.Stat(f)
	require.NoError(t, err)
	assert.True(t, infoAfter.ModTime().After(time.Now().Add(-2*time.Second)))
}
