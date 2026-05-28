const { app } = require("electron")
const { saveMainWindowState } = require("./ui/window")
const { killServer, setShutdown } = require("./server/sidecar")

function cleanupAndExit() {
    console.log("[Main] Cleaning up and exiting")
    setShutdown(true)

    try {
        saveMainWindowState()
    } catch (err) {
        console.error("[Coordinator] Error saving window state:", err)
    }

    // Kill Go server
    try {
        killServer()
    } catch (err) {
        console.error("[Coordinator] Error killing server:", err)
    }

    setTimeout(() => {
        app.exit(0)
    }, 500)
}

module.exports = {
    cleanupAndExit,
}
