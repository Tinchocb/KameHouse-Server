//go:build windows

package main

import (
	"context"
	"fmt"
	"unsafe"

	"github.com/gonutz/w32/v2"
	"github.com/jchv/go-webview2"
)

func hasConsole() bool {
	return w32.GetConsoleWindow() != 0
}

func runWebView(addr string, ctx context.Context, stop context.CancelFunc) error {
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     false,
		AutoFocus: true,
		WindowOptions: webview2.WindowOptions{
			Title:  "KameHouse",
			Width:  1280,
			Height: 720,
		},
	})
	if w == nil {
		return fmt.Errorf("failed to create webview")
	}
	defer w.Destroy()

	hwnd := w32.HWND(w.Window())

	var (
		isFullscreen  bool
		prevPlacement w32.WINDOWPLACEMENT
		prevStyle     int32
	)
	prevPlacement.Length = uint32(unsafe.Sizeof(prevPlacement))

	toggleFullscreen := func(fullscreen bool) {
		if fullscreen {
			prevStyle = w32.GetWindowLong(hwnd, w32.GWL_STYLE)
			if w32.GetWindowPlacement(hwnd, &prevPlacement) {
				hMonitor := w32.MonitorFromWindow(hwnd, w32.MONITOR_DEFAULTTOPRIMARY)
				var monitorInfo w32.MONITORINFO
				monitorInfo.CbSize = uint32(unsafe.Sizeof(monitorInfo))
				if w32.GetMonitorInfo(hMonitor, &monitorInfo) {
					w32.SetWindowLong(hwnd, w32.GWL_STYLE, prevStyle &^ int32(w32.WS_OVERLAPPEDWINDOW))
					w32.SetWindowPos(
						hwnd,
						w32.HWND_TOP,
						int(monitorInfo.RcMonitor.Left),
						int(monitorInfo.RcMonitor.Top),
						int(monitorInfo.RcMonitor.Right-monitorInfo.RcMonitor.Left),
						int(monitorInfo.RcMonitor.Bottom-monitorInfo.RcMonitor.Top),
						w32.SWP_NOOWNERZORDER|w32.SWP_FRAMECHANGED,
					)
					isFullscreen = true
				}
			}
		} else {
			w32.SetWindowLong(hwnd, w32.GWL_STYLE, prevStyle)
			w32.SetWindowPlacement(hwnd, &prevPlacement)
			w32.SetWindowPos(
				hwnd,
				0,
				0, 0, 0, 0,
				w32.SWP_NOMOVE|w32.SWP_NOSIZE|w32.SWP_NOZORDER|w32.SWP_NOOWNERZORDER|w32.SWP_FRAMECHANGED,
			)
			isFullscreen = false
		}
	}

	w.Bind("toggleFullscreen", func(fullscreen bool) {
		w.Dispatch(func() {
			if fullscreen != isFullscreen {
				toggleFullscreen(fullscreen)
			}
		})
	})

	w.Init(`
		document.addEventListener('fullscreenchange', () => {
			if (window.toggleFullscreen) {
				window.toggleFullscreen(!!document.fullscreenElement);
			}
		});
		document.addEventListener('webkitfullscreenchange', () => {
			if (window.toggleFullscreen) {
				window.toggleFullscreen(!!document.webkitFullscreenElement);
			}
		});
		document.addEventListener('keydown', (e) => {
			if (e.key === 'F11') {
				e.preventDefault();
				if (document.fullscreenElement || document.webkitFullscreenElement) {
					if (document.exitFullscreen) {
						document.exitFullscreen();
					} else if (document.webkitExitFullscreen) {
						document.webkitExitFullscreen();
					}
				} else {
					const el = document.documentElement;
					if (el.requestFullscreen) {
						el.requestFullscreen();
					} else if (el.webkitRequestFullscreen) {
						el.webkitRequestFullscreen();
					}
				}
			}
		});
	`)

	// Listen for background context cancellation (e.g. SIGINT / SIGTERM / system shutdown).
	// If the server terminates from the outside, dispatch window destroy safely on the main UI thread.
	go func() {
		<-ctx.Done()
		w.Dispatch(func() {
			w.Destroy()
		})
	}()

	w.Navigate(addr)
	w.Run()

	// When the window is closed, w.Run() returns.
	// Trigger the main application context cancellation to shut down HTTP servers and SQLite databases cleanly.
	stop()
	return nil
}
