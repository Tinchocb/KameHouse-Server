package filecache

import (
	"kamehouse/internal/test_utils"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCacherFunctions(t *testing.T) {
	test_utils.InitTestProvider(t)

	tempDir := t.TempDir()
	t.Log(tempDir)

	cacher, err := NewCacher(filepath.Join(tempDir, "cache"))
	require.NoError(t, err)

	bucket := Bucket{
		name: "test",
		ttl:  10 * time.Second,
	}

	keys := []string{"key1", "key2", "key3"}

	type valStruct = struct {
		Name string
	}

	values := []*valStruct{
		{
			Name: "value1",
		},
		{
			Name: "value2",
		},
		{
			Name: "value3",
		},
	}

	for i, key := range keys {
		err = cacher.Set(bucket, key, values[i])
		if err != nil {
			t.Fatalf("Failed to set the value: %v", err)
		}
	}

	allVals, err := GetAll[*valStruct](cacher, bucket)
	if err != nil {
		t.Fatalf("Failed to get all values: %v", err)
	}

	if len(allVals) != len(keys) {
		t.Fatalf("Failed to get all values: expected %d, got %d", len(keys), len(allVals))
	}

	spew.Dump(allVals)
}

func TestCacherSetAndGet(t *testing.T) {
	test_utils.InitTestProvider(t)

	tempDir := t.TempDir()
	t.Log(tempDir)

	cacher, err := NewCacher(filepath.Join(tempDir, "cache"))
	if err != nil {
		t.Fatalf("Failed to initialize cacher: %v", err)
	}

	bucket := Bucket{
		name: "test",
		ttl:  200 * time.Millisecond,
	}
	key := "key"
	value := struct {
		Name string
	}{
		Name: "value",
	}
	// Add "key" -> value to the bucket
	err = cacher.Set(bucket, key, value)
	if err != nil {
		t.Fatalf("Failed to set the value: %v", err)
	}

	var out struct {
		Name string
	}
	// Get the value of "key" from the bucket, it shouldn't be expired
	found, err := cacher.Get(bucket, key, &out)
	if err != nil {
		t.Errorf("Failed to get the value: %v", err)
	}
	if !found || !assert.Equal(t, value, out) {
		t.Errorf("Failed to get the correct value. Expected %v, got %v", value, out)
	}

	// Spin up a goroutine to set "key2" -> value2 to the bucket
	// cacher should be thread-safe
	wg := sync.WaitGroup{}
	wg.Add(1)
	go func() {
		defer wg.Done()
		key2 := "key2"
		value2 := struct {
			Name string
		}{
			Name: "value2",
		}
		var out2 struct {
			Name string
		}
		setErr := cacher.Set(bucket, key2, value2)
		if setErr != nil {
			t.Errorf("Failed to set the value: %v", setErr)
		}

		f, gErr := cacher.Get(bucket, key2, &out2)
		if gErr != nil {
			t.Errorf("Failed to get the value: %v", gErr)
		}

		if !f || !assert.Equal(t, value2, out2) {
			t.Errorf("Failed to get the correct value. Expected %v, got %v", value2, out2)
		}

		_ = cacher.Delete(bucket, key2)
	}()

	wg.Wait()

	// Wait for TTL expiration using Eventually
	assert.Eventually(t, func() bool {
		var expiredOut struct {
			Name string
		}
		f, _ := cacher.Get(bucket, key, &expiredOut)
		return !f
	}, 2*time.Second, 20*time.Millisecond, "key should expire after TTL")
}

func TestCacherClearAndTrimIsolation(t *testing.T) {
	tempDir := t.TempDir()
	cacher, err := NewCacher(filepath.Join(tempDir, "cache"))
	require.NoError(t, err)

	generalBucket := Bucket{name: "general", ttl: 1 * time.Hour}
	mediaBucket := Bucket{name: "mediastream_1", ttl: 1 * time.Hour}

	err = cacher.Set(generalBucket, "item1", "general_value")
	require.NoError(t, err)

	err = cacher.Set(mediaBucket, "stream1", "stream_value")
	require.NoError(t, err)

	// Simular carpeta videofiles con más de 10 archivos para probar Trim
	videoFilesDir := filepath.Join(cacher.dir, "videofiles")
	require.NoError(t, os.MkdirAll(videoFilesDir, 0755))
	for i := 0; i < 15; i++ {
		filePath := filepath.Join(videoFilesDir, filepath.Base(t.Name())+string(rune('a'+i)))
		require.NoError(t, os.WriteFile(filePath, []byte("data"), 0644))
	}

	// Ejecutar TrimMediastreamVideoFiles
	err = cacher.TrimMediastreamVideoFiles()
	require.NoError(t, err)

	// Trim debe haber evictado oldest-first hasta 10, y generalBucket DEBE permanecer intacto en memoria y disco
	trimmed, err := os.ReadDir(videoFilesDir)
	require.NoError(t, err)
	assert.LessOrEqual(t, len(trimmed), 10, "Trim debe mantener como máximo 10 videofiles (LRU)")
	var generalVal string
	found, err := cacher.Get(generalBucket, "item1", &generalVal)
	require.NoError(t, err)
	assert.True(t, found, "general bucket must NOT be cleared by TrimMediastreamVideoFiles")
	assert.Equal(t, "general_value", generalVal)

	// Probar RemoveAllBy
	err = cacher.RemoveAllBy(func(filename string) bool {
		return filename == "general.cache"
	})
	require.NoError(t, err)

	// Ahora general ya no debe estar en disco ni en memoria
	var generalValAfter string
	foundAfter, err := cacher.Get(generalBucket, "item1", &generalValAfter)
	require.NoError(t, err)
	assert.False(t, foundAfter, "general bucket should be deleted after RemoveAllBy")

	// Probar Clear(): debe limpiar todo en memoria y en disco
	err = cacher.Set(generalBucket, "item2", "new_val")
	require.NoError(t, err)
	err = cacher.Clear()
	require.NoError(t, err)

	entries, err := os.ReadDir(cacher.dir)
	require.NoError(t, err)
	for _, e := range entries {
		assert.False(t, filepath.Ext(e.Name()) == ".cache", "no .cache file should remain after Clear()")
	}
}

func TestMediastreamMediaInfoUnifiedAndMigration(t *testing.T) {
	tempDir := t.TempDir()
	cacher, err := NewCacher(filepath.Join(tempDir, "cache"))
	require.NoError(t, err)

	sharedBucket := Bucket{name: "mediastream_mediainfo", ttl: 30 * 24 * time.Hour}
	legacyBucket1 := Bucket{name: "mediastream_mediainfo_a1b2c3d4e5f60718293a4b5c6d7e8f9012345678", ttl: 30 * 24 * time.Hour}
	legacyBucket2 := Bucket{name: "mediastream_mediainfo_11223344556677889900aabbccddeeff00112233", ttl: 30 * 24 * time.Hour}
	generalBucket := Bucket{name: "general", ttl: 1 * time.Hour}

	// Guardar en bucket compartido
	require.NoError(t, cacher.Set(sharedBucket, "hash1", "media_data_1"))
	require.NoError(t, cacher.Set(sharedBucket, "hash2", "media_data_2"))

	// Guardar en buckets huérfanos legacy
	require.NoError(t, cacher.Set(legacyBucket1, "hash1", "legacy_1"))
	require.NoError(t, cacher.Set(legacyBucket2, "hash2", "legacy_2"))

	// Guardar en general
	require.NoError(t, cacher.Set(generalBucket, "setting1", "val1"))

	// Ejecutar filtro de migración (debe coincidir con maintenance.go)
	err = cacher.RemoveAllBy(func(filename string) bool {
		return strings.HasPrefix(filename, "mediastream_mediainfo_")
	})
	require.NoError(t, err)

	// Comprobar que los buckets legacy fueron eliminados de disco
	assert.NoFileExists(t, filepath.Join(cacher.dir, legacyBucket1.name+".cache"))
	assert.NoFileExists(t, filepath.Join(cacher.dir, legacyBucket2.name+".cache"))

	// Comprobar que el bucket compartido persiste y mantiene sus datos
	assert.FileExists(t, filepath.Join(cacher.dir, sharedBucket.name+".cache"))
	var out1, out2 string
	found1, err := cacher.Get(sharedBucket, "hash1", &out1)
	require.NoError(t, err)
	assert.True(t, found1)
	assert.Equal(t, "media_data_1", out1)

	found2, err := cacher.Get(sharedBucket, "hash2", &out2)
	require.NoError(t, err)
	assert.True(t, found2)
	assert.Equal(t, "media_data_2", out2)

	// Comprobar que el bucket general persiste intacto
	assert.FileExists(t, filepath.Join(cacher.dir, generalBucket.name+".cache"))
	var genOut string
	genFound, err := cacher.Get(generalBucket, "setting1", &genOut)
	require.NoError(t, err)
	assert.True(t, genFound)
	assert.Equal(t, "val1", genOut)
}

