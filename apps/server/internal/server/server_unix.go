//go:build (linux || darwin) && !windows

package server

import (
	"embed"
)

func StartServer(webFS embed.FS, embeddedLogo []byte) {

	app, flags := startApp(embeddedLogo)

	startAppLoop(&webFS, app, flags)
}
