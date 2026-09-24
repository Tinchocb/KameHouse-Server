package filecache

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/goccy/go-json"
	"github.com/samber/lo"
)

// CacheStore represents a single-process, file-based, key/value cache store.
type CacheStore struct {
	filePath string
	mu       sync.RWMutex
	saveMu   sync.Mutex
	data     map[string]*cacheItem
}

// Bucket represents a cache bucket with a name and TTL.
type Bucket struct {
	name string
	ttl  time.Duration
}

func NewBucket(name string, ttl time.Duration) Bucket {
	return Bucket{name: name, ttl: ttl}
}

func (b *Bucket) Name() string {
	return b.name
}

// Cacher represents a single-process, file-based, key/value cache.
type Cacher struct {
	dir    string
	stores map[string]*CacheStore
	mu     sync.RWMutex
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

// Close closes all the cache stores.
func (c *Cacher) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, store := range c.stores {
		if err := store.saveToFile(); err != nil {
			return err
		}
	}
	return nil
}

func (c *Cacher) Clear() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.stores = make(map[string]*CacheStore)

	entries, err := os.ReadDir(c.dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".cache") {
			_ = os.Remove(filepath.Join(c.dir, e.Name()))
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

	store = &CacheStore{
		filePath: filepath.Join(c.dir, name+".cache"),
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
	return store.saveToFile()
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
			if !f(key, out) {
				break
			}
		}
	}
	store.mu.Unlock()

	if hasExpired {
		return store.saveToFile()
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
		go func() { _ = store.saveToFile() }()
		return false, nil
	}
	itemVal := item.Value
	store.mu.RUnlock()

	data, err := json.Marshal(itemVal)
	if err != nil {
		return false, err
	}
	return true, json.Unmarshal(data, out)
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
	return store.saveToFile()
}

func DeleteIf[T any](c *Cacher, bucket Bucket, cond func(key string, value T) bool) error {
	store, err := c.getStore(bucket.name)
	if err != nil {
		return err
	}
	store.mu.Lock()
	deleted := false
	for key, item := range store.data {
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
		if cond(key, out) {
			delete(store.data, key)
			deleted = true
		}
	}
	store.mu.Unlock()

	if deleted {
		return store.saveToFile()
	}
	return nil
}

// Empty empties the given bucket.
func (c *Cacher) Empty(bucket Bucket) error {
	store, err := c.getStore(bucket.name)
	if err != nil {
		return err
	}
	store.mu.Lock()
	store.data = make(map[string]*cacheItem)
	store.mu.Unlock()
	return store.saveToFile()
}

// Remove removes the given bucket.
func (c *Cacher) Remove(bucketName string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.stores, bucketName)

	_ = os.Remove(filepath.Join(c.dir, bucketName+".cache"))

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

func (cs *CacheStore) saveToFile() error {
	cs.saveMu.Lock()
	defer cs.saveMu.Unlock()

	// Fast snapshot of the map under read lock; releases cs.mu immediately so readers/writers aren't blocked by disk I/O
	cs.mu.RLock()
	snapshot := make(map[string]*cacheItem, len(cs.data))
	for k, v := range cs.data {
		snapshot[k] = v
	}
	cs.mu.RUnlock()

	tmpPath := fmt.Sprintf("%s.tmp.%d", cs.filePath, time.Now().UnixNano())
	file, err := os.Create(tmpPath)
	if err != nil {
		return fmt.Errorf("filecache: failed to create temp cache file: %w", err)
	}

	encErr := json.NewEncoder(file).Encode(snapshot)
	syncErr := file.Sync()
	closeErr := file.Close()

	if encErr != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("filecache: failed to encode cache data: %w", encErr)
	}
	if syncErr != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("filecache: failed to sync cache file: %w", syncErr)
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
