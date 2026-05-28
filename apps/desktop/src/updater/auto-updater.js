const { ipcMain } = require("electron")
const { autoUpdater } = require("electron-updater")
const log = require("electron-log/main")

function setupAutoUpdater(opts = {}) {
    const {
        getMainWindow = () => null,
        isUpdateDownloaded = () => false,
        setUpdateDownloaded = () => {},
        killServer = () => {}
    } = opts

    autoUpdater.logger = log
    log.transports.file.level = "debug"

    autoUpdater.on("checking-for-update", () => {
        log.info("Checking for update...")
    })

    autoUpdater.on("update-available", (info) => {
        log.info("Update available:", info)
        const mainWindow = getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("update-available", {
                version: info.version, releaseDate: info.releaseDate, files: info.files
            })
        }
    })

    autoUpdater.on("update-not-available", (info) => {
        log.info("Update not available:", info)
    })

    autoUpdater.on("download-progress", (progressObj) => {
        log.info(`Download progress: ${progressObj.percent}%`)
        const mainWindow = getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("download-progress", {
                percent: progressObj.percent,
                bytesPerSecond: progressObj.bytesPerSecond,
                transferred: progressObj.transferred,
                total: progressObj.total
            })
        }
    })

    autoUpdater.on("update-downloaded", (info) => {
        log.info("Update downloaded:", info)
        setUpdateDownloaded(true)
        const mainWindow = getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("update-downloaded", {
                version: info.version, releaseDate: info.releaseDate, files: info.files
            })
        }
    })

    autoUpdater.on("error", (err) => {
        log.error("Error in auto-updater:", err)
        const mainWindow = getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("update-error", {
                code: err.code || "unknown", message: err.message, stack: err.stack
            })
        }
    })

    // Setup IPC handlers
    ipcMain.handle("check-for-updates", async () => {
        try {
            log.info("[Updater] Checking for updates...")
            const result = await autoUpdater.checkForUpdates()
            return {
                updateAvailable: !!result?.updateInfo,
                updateInfo: result?.updateInfo,
                updateDownloaded: isUpdateDownloaded()
            }
        } catch (error) {
            log.error("[Updater] Error checking for updates:", error)
            throw error
        }
    })

    ipcMain.handle("install-update", async () => {
        try {
            if (!isUpdateDownloaded()) {
                log.info("[Updater] Update not downloaded yet, triggering download...")
                await autoUpdater.checkForUpdatesAndNotify()
                throw new Error("Update download initiated. Please wait for download to complete.")
            }
            log.info("[Updater] Installing update...")
            autoUpdater.quitAndInstall(false, true)
            return true
        } catch (error) {
            log.error("[Updater] Error installing update:", error)
            throw error
        }
    })

    ipcMain.handle("kill-server", async () => {
        return killServer()
    })
}

module.exports = {
    setupAutoUpdater,
    autoUpdater,
}
