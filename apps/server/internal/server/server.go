package server

import (
	"embed"
	"fmt"
	"kamehouse/internal/handlers"
	"kamehouse/internal/util"
	"kamehouse/internal/util/crashlog"
	golog "log"
	"os"
	"path/filepath"
	"time"

	"github.com/rs/zerolog/log"
	"kamehouse/internal/core"
)

func startApp(embeddedLogo []byte) (*core.App, core.KameHouseFlags) {
	// Print the header
	core.PrintHeader()

	// Get the flags
	flags := core.GetKameHouseFlags()

	// Create the app instance
	app := core.NewKameHouse(&core.ConfigOptions{
		Flags:        flags,
		EmbeddedLogo: embeddedLogo,
	})

	// Create log file
	logFilePath := filepath.Join(app.Config.Logs.Dir, fmt.Sprintf("kamehouse-%s.log", time.Now().Format("2006-01-02_15-04-05")))
	// Open the log file
	logFile, _ := os.OpenFile(
		logFilePath,
		os.O_APPEND|os.O_CREATE|os.O_WRONLY,
		0664,
	)

	log.Logger = *app.Logger
	golog.SetOutput(app.Logger)
	util.SetupLoggerSignalHandling(logFile)
	crashlog.GlobalCrashLogger.SetLogDir(app.Config.Logs.Dir)

	app.OnFlushLogs = func() {
		util.WriteGlobalLogBufferToFile(logFile)
		logFile.Sync()
	}

	if !flags.Update {
		go func() {
			for {
				util.WriteGlobalLogBufferToFile(logFile)
				time.Sleep(5 * time.Second)
			}
		}()
	}

	return app, flags
}

func startAppLoop(webFS *embed.FS, app *core.App, flags core.KameHouseFlags) {
	updateMode := flags.Update

appLoop:
	for {
		switch updateMode {
		case true:

			log.Log().Msg("Running in update mode")

			// Print the header
			core.PrintHeader()

			log.Log().Msg("Shutting down in 10 seconds...")
			time.Sleep(10 * time.Second)

			break appLoop
		case false:

			// Create the echo app instance
			echoApp := core.NewEchoApp(app, webFS)

			// Initialize the routes
			handlers.InitRoutes(app, echoApp)

			// Run the server
			core.RunEchoServer(app, echoApp)

			select {}
		}
		continue
	}
}
