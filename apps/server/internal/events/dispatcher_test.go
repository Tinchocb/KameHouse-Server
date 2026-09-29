package events

import (
	"testing"
	"time"
)

func recv(t *testing.T, ch chan Event) Event {
	t.Helper()
	select {
	case e, ok := <-ch:
		if !ok {
			t.Fatal("channel closed unexpectedly")
		}
		return e
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for event")
	}
	return Event{}
}

func TestDispatcher_TopicAndWildcard(t *testing.T) {
	d := NewDispatcher()
	scan := d.Subscribe("scan")
	all := d.Subscribe("*")
	other := d.Subscribe("playback")

	d.Publish(Event{Topic: "scan", Payload: 42})

	if e := recv(t, scan); e.Payload != 42 || e.CreatedAt.IsZero() {
		t.Errorf("topic subscriber got %+v", e)
	}
	if e := recv(t, all); e.Topic != "scan" {
		t.Errorf("wildcard subscriber got %+v", e)
	}
	select {
	case e := <-other:
		t.Errorf("subscriber of another topic must not receive %+v", e)
	default:
	}
}

func TestDispatcher_FullBufferDropsWithoutBlocking(t *testing.T) {
	d := NewDispatcher()
	slow := d.Subscribe("scan")
	fast := d.Subscribe("scan")

	done := make(chan struct{})
	go func() {
		for i := 0; i < subscriberBufferSize+10; i++ {
			d.Publish(Event{Topic: "scan", Payload: i})
			<-fast // el consumidor rápido siempre drena
		}
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Publish blocked on a full subscriber buffer")
	}
	if len(slow) != subscriberBufferSize {
		t.Errorf("slow subscriber should keep exactly its buffer (%d), has %d", subscriberBufferSize, len(slow))
	}
}

func TestDispatcher_UnsubscribeClosesAndStopsDelivery(t *testing.T) {
	d := NewDispatcher()
	a := d.Subscribe("scan")
	b := d.Subscribe("scan")

	d.Unsubscribe("scan", a)
	if _, ok := <-a; ok {
		t.Fatal("unsubscribed channel must be closed")
	}

	// Publicar después de desuscribir no debe entrar en pánico (envío a canal cerrado).
	d.Publish(Event{Topic: "scan"})
	recv(t, b)

	d.Unsubscribe("scan", b)
	d.mu.RLock()
	_, stillThere := d.subscribers["scan"]
	d.mu.RUnlock()
	if stillThere {
		t.Error("topic with no subscribers should be removed")
	}
}
