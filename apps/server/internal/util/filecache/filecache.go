package filecache

import (
	"context"
	"errors"
	"fmt"
	"io"
	"kamehouse/internal/util"
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
	discarded bool // guarded by timerMu; old handles cannot recreate a removed bucket
	saveTimer *time.Timer
	timerMu   sync.Mutex
	loadOnce  sync.Once
	loadErr   error
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

// Keep persisted values encoded until the caller requests their concrete type.
// Decoding through interface{} first allocates a tree per entry and rounds int64
// values through float64; neither is needed to open a bucket.
func (item *cacheItem) UnmarshalJSON(data []byte) error {
	var encoded struct {
		Value      json.RawMessage `json:"value"`
		Expiration *time.Time      `json:"expiration,omitempty"`
		UpdatedAt  *time.Time      `json:"updated_at,omitempty"`
	}
	if err := json.Unmarshal(data, &encoded); err != nil {
		return err
	}
	if len(encoded.Value) == 0 {
		encoded.Value = json.RawMessage("null")
	}
	item.Value = encoded.Value
	item.Expiration = encoded.Expiration
	item.UpdatedAt = encoded.UpdatedAt
	return nil
}

func cacheValueJSON(value interface{}) ([]byte, error) {
	if raw, ok := value.(json.RawMessage); ok {
		return raw, nil
	}
	return json.Marshal(value)
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
	c.mu.RLock()
	stores := make([]*CacheStore, 0, len(c.stores))
	for _, store := range c.stores {
		stores = append(stores, store)
	}
	c.mu.RUnlock()
	var errs []error
	for _, store := range stores {
		if err := store.Flush(); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

// getStore returns a cache store for the given bucket name and TTL.
func (c *Cacher) getStore(name string) (*CacheStore, error) {
	c.mu.RLock()
	store, ok := c.stores[name]
	c.mu.RUnlock()
	if ok {
		return c.loadStore(name, store)
	}

	c.mu.Lock()
	// Double-checked locking
	store, ok = c.stores[name]
	if ok {
		c.mu.Unlock()
		return c.loadStore(name, store)
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

	return c.loadStore(name, store)
}

func (c *Cacher) loadStore(name string, store *CacheStore) (*CacheStore, error) {
	// Publish the handle early to avoid blocking unrelated buckets, but every
	// reader/writer must join initialization before touching this bucket.
	store.loadOnce.Do(func() { store.loadErr = store.loadFromFile() })
	if err := store.loadErr; err != nil {
		c.mu.Lock()
		if c.stores[name] == store {
			delete(c.stores, name)
		}
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
	store.scheduleSave(1 * time.Second)
	if _, err := os.Stat(store.filePath); os.IsNotExist(err) {
		return store.Flush()
	}
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

			// Decode persisted JSON only for entries actually visited.
			itemVal, err := cacheValueJSON(item.Value)
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

	// Decode persisted JSON directly, or convert a value requested as another type.
	data, err := cacheValueJSON(itemVal)
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
	// Valid JSON can still contain a null map or null entries. Treat those as
	// misses without losing the other usable entries in the bucket.
	if cs.data == nil {
		cs.data = make(map[string]*cacheItem)
	}
	for key, item := range cs.data {
		if item == nil {
			delete(cs.data, key)
		}
	}

	return nil
}

func (cs *CacheStore) scheduleSave(delay time.Duration) {
	cs.timerMu.Lock()
	if cs.discarded {
		cs.timerMu.Unlock()
		return
	}
	cs.dirty = true
	if cs.saveTimer != nil {
		cs.saveTimer.Reset(delay)
	} else {
		cs.saveTimer = time.AfterFunc(delay, func() {
			_ = cs.Flush()
		})
	}
	cs.timerMu.Unlock()
}

func (cs *CacheStore) Flush() error {
	// Join any write already in progress before testing dirty: a timer may
	// have claimed that snapshot just before Close calls Flush.
	cs.saveMu.Lock()
	defer cs.saveMu.Unlock()
	cs.timerMu.Lock()
	if cs.saveTimer != nil {
		cs.saveTimer.Stop()
		cs.saveTimer = nil
	}
	if cs.discarded || !cs.dirty {
		cs.timerMu.Unlock()
		return nil
	}
	cs.dirty = false
	cs.timerMu.Unlock()

	if err := cs.saveToFile(); err != nil {
		// Preserve pending changes so a later flush can retry a transient failure.
		cs.timerMu.Lock()
		cs.dirty = true
		cs.timerMu.Unlock()
		return err
	}
	return nil
}

func (cs *CacheStore) saveToFile() error {
	// Caller holds saveMu until the snapshot is persisted (or marked dirty).
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
	return c.RemoveAllByContext(context.Background(), filter)
}

func (c *Cacher) RemoveAllByContext(ctx context.Context, filter func(filename string) bool) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	entries, err := os.ReadDir(c.dir)
	if err != nil {
		return err
	}

	names := make(map[string]struct{})
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".cache") {
			names[strings.TrimSuffix(e.Name(), ".cache")] = struct{}{}
		}
	}
	// Include stores that have not reached disk yet, but never durable buckets
	// redirected outside the disposable cache directory.
	c.mu.RLock()
	for name := range c.stores {
		if c.bucketDirs[name] == "" {
			names[name] = struct{}{}
		}
	}
	c.mu.RUnlock()
	ordered := make([]string, 0, len(names))
	for name := range names {
		ordered = append(ordered, name)
	}
	sort.Strings(ordered)
	for _, name := range ordered {
		if err := ctx.Err(); err != nil {
			return err
		}
		if filter(name + ".cache") {
			if err := c.removeBucket(ctx, name); err != nil {
				return err
			}
		}
	}

	return ctx.Err()
}

// removeBucket joins existing writers and retires their handle before publishing
// a replacement. Waiting for disk I/O does not hold the global bucket lock.
func (c *Cacher) removeBucket(ctx context.Context, name string) error {
	for {
		c.mu.Lock()
		store := c.stores[name]
		if c.bucketDirs[name] != "" {
			store = nil // only remove the legacy copy under c.dir
		}
		if store != nil {
			c.mu.Unlock()
			if err := util.LockContext(ctx, &store.saveMu); err != nil {
				return err
			}
			c.mu.Lock()
			if c.stores[name] != store {
				c.mu.Unlock()
				store.saveMu.Unlock()
				continue
			}
			defer store.saveMu.Unlock()
		}
		defer c.mu.Unlock()
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := os.Remove(filepath.Join(c.dir, name+".cache")); err != nil && !os.IsNotExist(err) {
			return err
		}
		if store != nil {
			store.timerMu.Lock()
			store.discarded, store.dirty = true, false
			if store.saveTimer != nil {
				store.saveTimer.Stop()
				store.saveTimer = nil
			}
			store.timerMu.Unlock()
			delete(c.stores, name)
		}
		return nil
	}
}

// ClearMediastreamVideoFiles clears all mediastream video file caches.
func (c *Cacher) ClearMediastreamVideoFiles() error {
	var errs []error
	videoFilesDir := filepath.Join(c.dir, "videofiles")
	if files, err := os.ReadDir(videoFilesDir); err == nil {
		for _, file := range files {
			if err := os.RemoveAll(filepath.Join(videoFilesDir, file.Name())); err != nil {
				errs = append(errs, err)
			}
		}
	} else if !os.IsNotExist(err) {
		errs = append(errs, err)
	}

	err := c.RemoveAllBy(func(filename string) bool {
		return strings.HasPrefix(filename, "mediastream") || strings.HasPrefix(filename, "videofiles")
	})
	return errors.Join(append(errs, err)...)
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
	return c.GetMediastreamVideoFilesTotalSizeContext(context.Background())
}

func (c *Cacher) GetMediastreamVideoFilesTotalSizeContext(ctx context.Context) (int64, error) {
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	_, err := os.Stat(filepath.Join(c.dir, "videofiles"))
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}

	var totalSize int64
	err = filepath.Walk(filepath.Join(c.dir, "videofiles"), func(_ string, info os.FileInfo, err error) error {
		if err := ctx.Err(); err != nil {
			return err
		}
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

func (c *Cacher) GetTotalSizeContext(ctx context.Context) (int64, error) {
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	var totalSize int64
	err := filepath.Walk(c.dir, func(_ string, info os.FileInfo, err error) error {
		if err := ctx.Err(); err != nil {
			return err
		}
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
func (c *Cacher) PruneMediastreamVideoFilesByAge(ctx context.Context, maxAge time.Duration, inUse func(hash string) bool) (int64, error) {
	if err := ctx.Err(); err != nil {
		return 0, err
	}
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
		if err := ctx.Err(); err != nil {
			return freedBytes, err
		}
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
			walkErr := filepath.Walk(fullPath, func(_ string, f os.FileInfo, err error) error {
				if err := ctx.Err(); err != nil {
					return err
				}
				if err == nil && !f.IsDir() {
					dirSize += f.Size()
				}
				return nil
			})

			if walkErr != nil {
				return freedBytes, walkErr
			}
			if err := ctx.Err(); err != nil {
				return freedBytes, err
			}

			if err := os.RemoveAll(fullPath); err == nil {
				freedBytes += dirSize
			}
		}
	}

	return freedBytes, ctx.Err()
}
