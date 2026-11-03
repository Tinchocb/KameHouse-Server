package autoscanner

import (
	"context"
	"testing"
	"time"
)

func TestStopJoinsPendingNotificationAndRejectsScans(t *testing.T) {
	as := newTestAutoScanner(t, context.Background(), time.Hour)
	as.Notify("")
	as.Stop()
	waiting, pending := snapshot(as)
	if waiting || len(pending) != 0 {
		t.Fatal("pending notification survived stop")
	}
	as.SetEnabled(true)
	// There is no database in this fixture: reaching scan work after Stop would panic.
	as.TriggerScan(nil)
	as.Notify("")
	as.Stop()
	waiting, _ = snapshot(as)
	if waiting || as.scanning.Load() {
		t.Fatal("stopped scanner accepted work")
	}
}
