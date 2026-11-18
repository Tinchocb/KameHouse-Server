package drive

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func TestBlockCacheTrimsExistingCacheOnOpen(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"old.blk", "new.blk"} {
		if err := os.WriteFile(filepath.Join(dir, name), make([]byte, 1000), 0600); err != nil {
			t.Fatal(err)
		}
	}
	c, err := NewBlockCache(dir, 100, 1500)
	if err != nil {
		t.Fatal(err)
	}
	if size, _ := c.Stats(); size > 1500 {
		t.Fatalf("existing cache was not trimmed: %d", size)
	}
}

func TestBlockCacheLowSpaceStillStreamsWithoutPersisting(t *testing.T) {
	for _, probeFails := range []bool{false, true} {
		t.Run(map[bool]string{false: "low-space", true: "probe-error"}[probeFails], func(t *testing.T) {
			c := newTestCache(t, 1000, 10000)
			c.freeBytes = func(string) (uint64, error) {
				if probeFails {
					return 0, errors.New("disk unavailable")
				}
				return blockCacheDiskReserve - 1, nil
			}
			f := &cacheUpstream{data: testData(3000)}
			if got := readCached(t, c.Fetcher("lowspace", f.fetch), 0, 2999); !bytes.Equal(got, f.data) {
				t.Fatal("stream changed when persistence was disabled")
			}
			waitIdle(t, c)
			if size, _ := c.Stats(); size != 0 {
				t.Fatalf("persisted %d bytes without enough disk space", size)
			}
		})
	}
}

func TestBlockCacheConcurrentWritesRespectBudget(t *testing.T) {
	c := newTestCache(t, 1000, 3500)
	c.freeBytes = func(string) (uint64, error) { return blockCacheDiskReserve + 10000, nil }
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			c.persistBlockGeneration(filepath.Join(c.Dir(), string(rune('a'+i))+".blk"), make([]byte, 1000), c.currentGeneration())
		}(i)
	}
	wg.Wait()
	if size, _ := c.Stats(); size > 3500 {
		t.Fatalf("concurrent writes exceeded budget: %d", size)
	}
}

func TestBlockCacheLowSpaceEvictsBeforeWriting(t *testing.T) {
	c := newTestCache(t, 1000, 10000)
	path := filepath.Join(c.Dir(), "old.blk")
	if err := os.WriteFile(path, make([]byte, 2000), 0600); err != nil {
		t.Fatal(err)
	}
	c.used = 2000
	c.freeBytes = func(string) (uint64, error) {
		if _, err := os.Stat(path); os.IsNotExist(err) {
			return blockCacheDiskReserve + 2000, nil
		}
		return blockCacheDiskReserve, nil
	}
	c.persistBlockGeneration(filepath.Join(c.Dir(), "new.blk"), make([]byte, 1000), c.currentGeneration())
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("old block was not evicted to preserve disk reserve")
	}
	if size, _ := c.Stats(); size != 1000 {
		t.Fatalf("new block was not persisted after reclaiming space: %d", size)
	}
}

func TestBlockCacheNoBorraSiNoAlcanzaLaReserva(t *testing.T) {
	c := newTestCache(t, 1000, 10000)
	kept := filepath.Join(c.Dir(), "kept.blk")
	if err := os.WriteFile(kept, make([]byte, 2000), 0600); err != nil {
		t.Fatal(err)
	}
	c.used = 2000
	// Aun vaciando los 2000 bytes de la caché, el disco quedaría bajo la reserva.
	c.freeBytes = func(string) (uint64, error) { return blockCacheDiskReserve - 5000, nil }
	c.persistBlockGeneration(filepath.Join(c.Dir(), "new.blk"), make([]byte, 1000), c.currentGeneration())
	if _, err := os.Stat(kept); err != nil {
		t.Fatalf("la caché se vació aunque la reserva de disco no se alcanzaba: %v", err)
	}
	if _, err := os.Stat(filepath.Join(c.Dir(), "new.blk")); !os.IsNotExist(err) {
		t.Fatal("se persistió un bloque sin espacio suficiente en disco")
	}
}
