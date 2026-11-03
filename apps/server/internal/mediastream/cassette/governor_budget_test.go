package cassette

import (
	"context"
	"github.com/rs/zerolog"
	"kamehouse/internal/util/resourcebudget"
	"testing"
	"time"
)

func TestGovernorBudgetAndManualOverride(t *testing.T) {
	l := zerolog.Nop()
	for _, hardware := range []bool{false, true} {
		want := resourcebudget.Current().SoftwareProcesses
		if hardware {
			want = resourcebudget.Current().HardwareProcesses
		}
		if got := NewGovernor(0, hardware, &l).Stats().MaxConcurrency; got != want {
			t.Fatalf("automatic = %d, want %d", got, want)
		}
		if got := NewGovernor(7, hardware, &l).Stats().MaxConcurrency; got != 7 {
			t.Fatalf("manual = %d", got)
		}
	}
}

func TestGovernorCancelledWaitReleasesDemandAndSlot(t *testing.T) {
	l := zerolog.Nop()
	g := NewGovernor(1, false, &l)
	release, err := g.Acquire(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer release()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	if r, err := g.Acquire(ctx); err == nil {
		r()
		t.Fatal("oversubscribed governor")
	}
	release()
	r, ok := g.TryAcquire()
	if !ok {
		t.Fatal("cancelled waiter leaked a slot")
	}
	r()
	if g.Stats().ActiveProcesses != 0 {
		t.Fatal("active process leak")
	}
}
