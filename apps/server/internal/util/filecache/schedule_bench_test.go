package filecache

import (
	"testing"
	"time"
)

func BenchmarkScheduleSave(b *testing.B) {
	store := &CacheStore{}
	b.Cleanup(func() {
		store.timerMu.Lock()
		if store.saveTimer != nil {
			store.saveTimer.Stop()
		}
		store.timerMu.Unlock()
	})
	b.ReportAllocs()
	for b.Loop() {
		store.scheduleSave(time.Hour)
	}
}
