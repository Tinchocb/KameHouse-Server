package cassette

import "testing"

// Un encoder que ya no responde apaga la GPU al primer fallo.
func TestHwFallbackNeededDeadEncoderFallsBackImmediately(t *testing.T) {
	if !hwFallbackNeeded(false, 1) {
		t.Fatal("dead encoder on first failure must fall back to CPU")
	}
}

// Un encoder que sigue respondiendo (fallo transitorio) conserva la GPU una vez...
func TestHwFallbackNeededTransientFailureKeepsGPU(t *testing.T) {
	if hwFallbackNeeded(true, 1) {
		t.Fatal("encoder still alive on first failure must keep the GPU")
	}
}

// ...pero una racha de fallos seguidos apaga la GPU aunque el probe pase
// (p. ej. un archivo que la GPU no decodifica).
func TestHwFallbackNeededStreakFallsBack(t *testing.T) {
	if !hwFallbackNeeded(true, maxHwFailureStreak) {
		t.Fatalf("streak of %d with a live encoder must fall back to CPU", maxHwFailureStreak)
	}
}

func TestSettingsHwFailureStreak(t *testing.T) {
	s := &Settings{}
	if got := s.RecordHwFailure(); got != 1 {
		t.Fatalf("first failure streak = %d, want 1", got)
	}
	if got := s.RecordHwFailure(); got != 2 {
		t.Fatalf("second failure streak = %d, want 2", got)
	}
	s.ResetHwFailures()
	if got := s.RecordHwFailure(); got != 1 {
		t.Fatalf("streak after reset = %d, want 1", got)
	}
}
