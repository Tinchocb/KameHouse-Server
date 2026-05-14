package scanner

import (
	"context"

	"kamehouse/internal/events"
)

// wsEvent is the payload pushed into the non-blocking telemetry channel.
type wsEvent struct {
	name    string
	payload any
}

// scanTelemetry decouples WebSocket progress events from the scanner workers.
// Workers push to the channel and return immediately; a single background
// goroutine drains the channel and forwards events to the WSEventManager so
// that a slow client can never stall a scan worker.
type scanTelemetry struct {
	ch chan wsEvent
	ws events.WSEventManagerInterface
}

// newScanTelemetry creates a telemetry relay with a generously-buffered channel.
// bufSize = 256 absorbs bursts of events even when the WS client is slow.
func newScanTelemetry(ws events.WSEventManagerInterface, bufSize int) *scanTelemetry {
	return &scanTelemetry{
		ch: make(chan wsEvent, bufSize),
		ws: ws,
	}
}

// Send enqueues an event. If the buffer is full the event is silently dropped
// rather than blocking the worker — telemetry is best-effort, not critical path.
func (t *scanTelemetry) Send(name string, payload any) {
	select {
	case t.ch <- wsEvent{name: name, payload: payload}:
	default: // buffer full → drop; never block the caller
	}
}

// Run starts the drain loop. It exits when ctx is cancelled OR when the caller
// closes the channel (by calling Close). Run blocks until the channel is fully
// drained so no events are lost on graceful shutdown.
func (t *scanTelemetry) Run(ctx context.Context) {
	for {
		select {
		case ev, ok := <-t.ch:
			if !ok {
				return // channel closed, drain complete
			}
			if t.ws != nil {
				t.ws.SendEvent(ev.name, ev.payload)
			}
		case <-ctx.Done():
			// Drain remaining events before exiting so the frontend
			// receives the final progress/status messages.
			for {
				select {
				case ev, ok := <-t.ch:
					if !ok {
						return
					}
					if t.ws != nil {
						t.ws.SendEvent(ev.name, ev.payload)
					}
				default:
					return
				}
			}
		}
	}
}

// Close signals the drain goroutine to exit after flushing.
func (t *scanTelemetry) Close() {
	close(t.ch)
}
