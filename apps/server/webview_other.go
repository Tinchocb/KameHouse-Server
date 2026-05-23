//go:build !windows

package main

import (
	"context"
)

func hasConsole() bool {
	return true
}

func runWebView(addr string, ctx context.Context, stop context.CancelFunc) error {
	// For other OS, this is a no-op stub that blocks on context completion
	<-ctx.Done()
	return nil
}
