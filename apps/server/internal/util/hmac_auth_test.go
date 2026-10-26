package util

import (
	"sync"
	"testing"
	"time"
)

func TestHMACAuthConcurrentGeneration(t *testing.T) {
	auth := NewHMACAuth("supersecretkey12345", 1*time.Hour)

	var wg sync.WaitGroup
	workers := 50
	tokens := make([]string, workers)

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			token, err := auth.GenerateTokenWithTTL("*", 5*time.Minute)
			if err != nil {
				t.Errorf("worker %d failed: %v", idx, err)
				return
			}
			tokens[idx] = token
		}(i)
	}

	wg.Wait()

	for idx, tok := range tokens {
		claims, err := auth.ValidateToken(tok, "*")
		if err != nil {
			t.Fatalf("token from worker %d failed validation: %v", idx, err)
		}
		if claims.Endpoint != "*" {
			t.Errorf("expected endpoint '*', got %q", claims.Endpoint)
		}
	}
}
