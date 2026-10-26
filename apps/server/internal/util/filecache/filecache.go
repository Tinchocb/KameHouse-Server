package filecache

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/goccy/go-json"
	"github.com/samber/lo"
)

// CacheStore represents a single-process, file-based, key/value cache store.
type CacheStore struct {
	filePath  string
	mu        sync.RWMutex
	saveMu    sync.Mutex
	data      map[string]*cacheItem
	dirty     bool
	saveTimer *time.Timer
	timerMu   sync.Mutex
}

// Bucket represents a cache bucket with a name and TTL.
type Bucket struct {
	name string
	ttl  time.Duration
}

func NewBucket(name string, ttl time.Duration) Bucket {
	return Bucket{name: name, ttl: ttl}
}

// Cacher represents a single-process, file-based, key/value cache.
type Cacher struct {
	dir        string
	bucketDirs map[string]string
	stores     map[string]*CacheStore
	mu         sync.RWMutex
}

// NewCacherWithPersistentBucket keeps durable user data independent of the
// configurable cache root. Existing data is copied only if the stable file is
// missing; the original is preserved and an existing stable file wins.
func NewCacherWithPersistentBucket(dir, bucket, persistentDir string) (*Cacher, error) {
	c, err := NewCacher(dir)
	if err != nil {
		return nil, err
	}
	if filepath.Base(bucket) != bucket || bucket == "." || bucket == "" {
		return nil, fmt.Errorf("invalid persistent bucket")
	}
	if err := os.MkdirAll(persistentDir, 0700); err != nil {
		return nil, err
	}
	destination := filepath.Join(persistentDir, bucket+".cache")
	if _, err := os.Stat(destination); os.IsNotExist(err) {
		source, err := os.Open(filepath.Join(dir, bucket+".cache"))
		if err == nil {
			defer source.Close()
			data, err := io.ReadAll(source)
			if err != nil {
				return nil, err
			}
			target, err := os.CreateTemp(persistentDir, ".history-migration-*")
			if err != nil {
				return nil, err
			}
			defer os.Remove(target.Name())
			_, writeErr := target.Write(data)
			if writeErr == nil {
				writeErr = target.Sync()
			}
			closeErr := target.Close()
			if writeErr != nil || closeErr != nil {
				return nil, fmt.Errorf("could not preserve persistent bucket")
			}
			if err := os.Rename(target.Name(), destination); err != nil {
				return nil, err
			}
		} else if !os.IsNotExist(err) {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}
	c.bucketDirs = map[string]string{bucket: persistentDir}
	return c, nil
}

type cacheItem struct {
	Value      interface{} `json:"value"`
	Expiration *time.Time  `json:"expiration,omitempty"`
	UpdatedAt  *time.Time  `json:"updated_at,omitempty"`
}

// NewCacher creates a new instance of Cacher.
func NewCacher(dir string) (*Cacher, error) {
	// Check if the directory exists
	_, err := os.Stat(dir)
	if err != nil {
		if os.IsNotExist(err) {
			if err := os.MkdirAll(dir, os.ModePerm); err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}
	return &Cacher{
		stores: make(map[string]*CacheStore),
		dir:    dir,
	}, nil
}

// Close closes all the cache stores and flushes any pending writes.
func (c *Cacher) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, store := range c.stores {
		if err := store.Flush(); err != nil {
			return err
		}
	}
	return nil
}

// getStore returns a cache store for the given bucket name and TTL.
func (c *Cacher) getStore(name string) (*CacheStore, error) {
	c.mu.RLock()
	store, ok := c.stores[name]
	c.mu.RUnlock()
	if ok {
		return store, nil
	}

	c.mu.Lock()
	// Double-checked locking
	store, ok = c.stores[name]
	if ok {
		c.mu.Unlock()
		return store, nil
	}

	storeDir := c.dir
	if persistentDir := c.bucketDirs[name]; persistentDir != "" {
		storeDir = persistentDir
	}
	store = &CacheStore{
		filePath: filepath.Join(storeDir, name+".cache"),
		data:     make(map[string]*cacheItem),
	}
	c.stores[name] = store
	c.mu.Unlock()

	// Carga desde disco fuera del mutex global de Cacher para no bloquear otros buckets
	if err := store.loadFromFile(); err != nil {
		c.mu.Lock()
		delete(c.stores, name)
		c.mu.Unlock()
		return nil, err
	}
	return store, nil
}

// Set sets the value for the given key in the given bucket.
func (c *Cacher) Set(bucket Bucket, key string, value interface{}) error {
	store, err := c.getStore(bucket.name)
	if err != nil {
		return err
	}
	store.mu.Lock()
	store.data[key] = &cacheItem{Value: value, Expiration: lo.ToPtr(time.Now().Add(bucket.ttl))}
	store.mu.Unlock()

	// If the cache file does not exist yet on disk, write it immediately so initial state is persisted.
	// Otherwise, debounce subsequent writes to avoid disk thrashing during playback.
	if _, err := os.Stat(store.filePath); os.IsNotExist(err) {
		return store.saveToFile()
	}
	store.scheduleSave(1 * time.Second)
	return nil
}

func Range[T any](c *Cacher, bucket Bucket, f func(key string, value T) bool) error {
	store, err := c.getStore(bucket.name)
	if err != nil {
		return err
	}
	store.mu.Lock()
	hasExpired := false
	for key, item := range store.data {
		if item.Expiration != nil && time.Now().After(*item.Expiration) {
			delete(store.data, key)
			hasExpired = true
		} else {
			// Fast path: if item.Value is already T, invoke callback directly without JSON serialization
			if val, ok := item.Value.(T); ok {
				if !f(key, val) {
					break
				}
				continue
			}

			// Slow path: loaded from disk as map[string]interface{}, hydrate in-place
			itemVal, err := json.Marshal(item.Value)
			if err != nil {
				store.mu.Unlock()
				return err
			}
			var out T
			err = json.Unmarshal(itemVal, &out)
			if err != nil {
				store.mu.Unlock()
				return err
			}
			item.Value = out
			if !f(key, out) {
				break
			}
		}
	}
	store.mu.Unlock()

	if hasExpired {
		store.scheduleSave(2 * time.Second)
	}
	return nil
}

// Get retrieves the value for the given key from the given bucket.
func (c *Cacher) Get(bucket Bucket, key string, out interface{}) (bool, error) {
	store, err := c.getStore(bucket.name)
	if err != nil {
		return false, err
	}
	store.mu.RLock()
	item, ok := store.data[key]
	if !ok {
		store.mu.RUnlock()
		return false, nil
	}
	if item.Expiration != nil && time.Now().After(*item.Expiration) {
		store.mu.RUnlock()
		store.mu.Lock()
		if cur, exists := store.data[key]; exists && cur.Expiration != nil && time.Now().After(*cur.Expiration) {
			delete(store.data, key)
		}
		store.mu.Unlock()
		store.scheduleSave(2 * time.Second)
		return false, nil
	}
	itemVal := item.Value
	store.mu.RUnlock()

	if out == nil {
		return true, nil
	}

	// Fast path: direct type reflection if itemVal is already assignable to *out
	outVal := reflect.ValueOf(out)
	if outVal.Kind() == reflect.Ptr && !outVal.IsNil() && itemVal != nil {
		elemVal := outVal.Elem()
		itemRVal := reflect.ValueOf(itemVal)
		if itemRVal.Type().AssignableTo(elemVal.Type()) {
			elemVal.Set(itemRVal)
			return true, nil
		}
	}

	// Slow path: convert via JSON (typically when loaded from disk as map[string]interface{})
	data, err := json.Marshal(itemVal)
	if err != nil {
		return false, err
	}
	if err := json.Unmarshal(data, out); err != nil {
		return false, err
	}

	// Lazy hydration: cache the decoded object in memory so subsequent gets hit the fast path
	if outVal.Kind() == reflect.Ptr && !outVal.IsNil() {
		hydratedVal := outVal.Elem().Interface()
		store.mu.Lock()
		if cur, exists := store.data[key]; exists && cur == item {
			cur.Value = hydratedVal
		}
		store.mu.Unlock()
	}

	return true, nil
}

func GetAll[T any](c *Cacher, bucket Bucket) (map[string]T, error) {
	data := make(map[string]T)
	err := Range(c, bucket, func(key string, value T) bool {
		data[key] = value
		return true
	})
	if err != nil {
		return nil, err
	}
	return data, nil
}

// Delete deletes the value for the given key from the given bucket.
func (c *Cacher) Delete(bucket Bucket, key string) error {
	store, err := c.getStore(bucket.name)
	if err != nil {
		return err
	}
	store.mu.Lock()
	delete(store.data, key)
	store.mu.Unlock()
	store.scheduleSave(1 * time.Second)
	return nil
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (cs *CacheStore) loadFromFile() error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	file, err := os.Open(cs.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // File does not exist, so nothing to load
		}
		return fmt.Errorf("filecache: failed to open cache file: %w", err)
	}
	defer file.Close()

	if err := json.NewDecoder(file).Decode(&cs.data); err != nil {
		// If decode fails (empty or corrupted file), initialize with empty data
		cs.data = make(map[string]*cacheItem)
		return nil
	}

	return nil
}

func (cs *CacheStore) scheduleSave(delay time.Duration) {
	cs.timerMu.Lock()
	cs.dirty = true
	if cs.saveTimer != nil {
		cs.saveTimer.Stop()
	}
	cs.saveTimer = time.AfterFunc(delay, func() {
		_ = cs.Flush()
	})
	cs.timerMu.Unlock()
}

func (cs *CacheStore) Flush() error {
	cs.timerMu.Lock()
	if cs.saveTimer != nil {
		cs.saveTimer.Stop()
		cs.saveTimer = nil
	}
	if !cs.dirty {
		cs.timerMu.Unlock()
		return nil
	}
	cs.dirty = false
	cs.timerMu.Unlock()

	return cs.saveToFile()
}

func (cs *CacheStore) saveToFile() error {
	cs.saveMu.Lock()
	defer cs.saveMu.Unlock()

	// Fast snapshot of the map under read lock; releases cs.mu immediately so readers/writers aren't blocked by disk I/O.
	// Cada cacheItem se copia por valor: Get y Range hidratan item.Value en el lugar (con cs.mu para escritura),
	// asi que codificar los punteros compartidos despues del RUnlock seria una carrera de datos.
	cs.mu.RLock()
	snapshot := make(map[string]cacheItem, len(cs.data))
	for k, v := range cs.data {
		if v != nil {
			snapshot[k] = *v
		}
	}
	cs.mu.RUnlock()

	tmpPath := fmt.Sprintf("%s.tmp.%d", cs.filePath, time.Now().UnixNano())
	file, err := os.Create(tmpPath)
	if err != nil {
		return fmt.Errorf("filecache: failed to create temp cache file: %w", err)
	}

	encErr := json.NewEncoder(file).Encode(snapshot)
	closeErr := file.Close()

	if encErr != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("filecache: failed to encode cache data: %w", encErr)
	}
	if closeErr != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("filecache: failed to close temp cache file: %w", closeErr)
	}

	if err := os.Rename(tmpPath, cs.filePath); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("filecache: failed to replace cache file: %w", err)
	}
	return nil
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// RemoveAllBy removes all files in the cache directory that match the given filter.
func (c *Cacher) RemoveAllBy(filter func(filename string) bool) error {
	entries, err := os.ReadDir(c.dir)
	if err != nil {
		return err
	}

	var toDelete []string
	for _, e := range entries {
		if !e.IsDir() {
			if !strings.HasSuffix(e.Name(), ".cache") {
				continue
			}
			if filter(e.Name()) {
				_ = os.Remove(filepath.Join(c.dir, e.Name()))
				toDelete = append(toDelete, strings.TrimSuffix(e.Name(), ".cache"))
			}
		}
	}

	if len(toDelete) > 0 {
		c.mu.Lock()
		for _, bucketName := range toDelete {
			delete(c.stores, bucketName)
		}
		c.mu.Unlock()
	}
	return nil
}

// ClearMediastreamVideoFiles clears all mediastream video file caches.
func (c *Cacher) ClearMediastreamVideoFiles() error {
	// IO de disco fuera del lock global: c.dir es inmutable.
	videoFilesDir := filepath.Join(c.dir, "videofiles")
	if files, err := os.ReadDir(videoFilesDir); err == nil {
		for _, file := range files {
			_ = os.RemoveAll(filepath.Join(videoFilesDir, file.Name()))
		}
	}

	err := c.RemoveAllBy(func(filename string) bool {
		return strings.HasPrefix(filename, "mediastream")
	})

	// Second sweep covers "videofiles*" stores, which have no .cache file and are
	// therefore not removed by RemoveAllBy (it only handles mediastream*.cache).
	c.mu.Lock()
	for name := range c.stores {
		if strings.HasPrefix(name, "mediastream") || strings.HasPrefix(name, "videofiles") {
			delete(c.stores, name)
		}
	}
	c.mu.Unlock()
	return err
}

// TrimMediastreamVideoFiles evicts oldest videofiles dirs keeping newest 10 (LRU by ModTime).
func (c *Cacher) TrimMediastreamVideoFiles() error {
	videoFilesDir := filepath.Join(c.dir, "videofiles")
	files, err := os.ReadDir(videoFilesDir)
	if err != nil {
		return nil
	}

	// If the number of files exceeds 10, evict oldest first until 10 remain
	if len(files) > 10 {
		type entry struct {
			name    string
			modTime time.Time
		}
		infos := make([]entry, 0, len(files))
		for _, file := range files {
			full := filepath.Join(videoFilesDir, file.Name())
			mod := time.Time{}
			if info, err := file.Info(); err == nil {
				mod = info.ModTime()
			}
			infos = append(infos, entry{name: full, modTime: mod})
		}
		sort.Slice(infos, func(i, j int) bool {
			return infos[i].modTime.Before(infos[j].modTime)
		})
		for _, e := range infos[:len(infos)-10] {
			_ = os.RemoveAll(e.name)
		}
	}

	return nil
}

func (c *Cacher) GetMediastreamVideoFilesTotalSize() (int64, error) {
	_, err := os.Stat(filepath.Join(c.dir, "videofiles"))
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}

	var totalSize int64
	err = filepath.Walk(filepath.Join(c.dir, "videofiles"), func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			totalSize += info.Size()
		}
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("filecache: failed to walk the cache directory: %w", err)
	}

	return totalSize, nil
}

// GetTotalSize returns the total size of all files in the cache directory that match the given filter.
// The size is in bytes.
func (c *Cacher) GetTotalSize() (int64, error) {
	var totalSize int64
	err := filepath.Walk(c.dir, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			totalSize += info.Size()
		}
		return nil
	})

	if err != nil {
		return 0, fmt.Errorf("filecache: failed to walk the cache directory: %w", err)
	}

	return totalSize, nil
}

// PruneMediastreamVideoFilesByAge removes directories inside "videofiles" that are older than maxAge
// and not currently in use.
func (c *Cacher) PruneMediastreamVideoFilesByAge(maxAge time.Duration, inUse func(hash string) bool) (int64, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	videofilesDir := filepath.Join(c.dir, "videofiles")
	entries, err := os.ReadDir(videofilesDir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}

	cutoff := time.Now().Add(-maxAge)
	var freedBytes int64

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		hash := entry.Name()
		if inUse(hash) {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		if info.ModTime().Before(cutoff) {
			fullPath := filepath.Join(videofilesDir, hash)

			// Calculate size before removing
			var dirSize int64
			_ = filepath.Walk(fullPath, func(_ string, f os.FileInfo, err error) error {
				if err == nil && !f.IsDir() {
					dirSize += f.Size()
				}
				return nil
			})

			if err := os.RemoveAll(fullPath); err == nil {
				freedBytes += dirSize
			}
		}
	}

	return freedBytes, nil
}
