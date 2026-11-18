package events

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"
)

func TestDesktopHostSurvivesWithoutWebsocketUntilHostExits(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	logger := zerolog.Nop()
	m := NewWSEventManager(&logger, nil, ctx)
	m.hasHadConnection = true // A renderer previously connected, then disconnected.
	var calls atomic.Int32
	done := make(chan struct{})
	go func() {
		defer close(done)
		m.monitorDesktopHost(func() (bool, error) {
			switch calls.Add(1) {
			case 1:
				return false, errors.New("temporary inspection failure")
			case 2:
				return true, nil
			default:
				return false, nil
			}
		}, time.Millisecond)
	}()
	select {
	case <-m.ShutdownSignal:
		if calls.Load() < 3 {
			t.Fatal("server shut down while desktop host was still alive")
		}
	case <-time.After(time.Second):
		t.Fatal("server did not shut down after desktop host exited")
	}
	<-done
}

func TestDesktopHostMonitorStopsOnCleanup(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	logger := zerolog.Nop()
	m := NewWSEventManager(&logger, nil, ctx)
	done := make(chan struct{})
	go func() {
		defer close(done)
		m.monitorDesktopHost(func() (bool, error) { return true, nil }, time.Hour)
	}()
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("desktop host monitor ignored cleanup")
	}
}
