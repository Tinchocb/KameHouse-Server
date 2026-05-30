const { app, dialog, ipcMain, net, clipboard } = require("electron")
const path = require("path")
const log = require("electron-log/main")
log.initialize()

const { setupChromiumFlags } = require("./config/flags")
const { loadSettings, saveSettings } = require("./config/settings")
const { setupCustomProtocol, setupAppProtocol } = require("./protocol/app-protocol")
const { startLocalServer, getLocalServerPort } = require("./server/local")
const {
    launchkamehouseServer,
    restartkamehouseServer,
    killServer,
    getDesktopServerPort,
    isDesktopServerReachable
} = require("./server/sidecar")
const {
    createMainWindow,
    createSplashScreen,
    createCrashScreen,
    showMainWindow,
    getMainWindow,
    getSplashScreen,
    getCrashScreen,
    isMainWindowStartupReady,
    setupWindowIpc
} = require("./ui/window")
const { createTray } = require("./ui/tray")
const { setupAutoUpdater, autoUpdater } = require("./updater/auto-updater")
const { cleanupAndExit } = require("./main-coordinator")

// Redirect console logging to electron-log
console.log = log.info
console.error = log.error

const _development = process.env.NODE_ENV === "development"
const DEFAULT_UPDATE_FEED_URL = "https://github.com/5rahim/kamehouse/releases/latest/download"
let updateDownloaded = false

// Call configuration setup before app.whenReady
setupCustomProtocol()
setupChromiumFlags()

// Single instance lock
const gotTheLock = _development ? true : app.requestSingleInstanceLock({ development: _development })

if (!gotTheLock) {
    if (!_development) {
        app.quit()
    }
} else {
    app.on("second-instance", (event, commandLine, workingDirectory, additionalData) => {
        if (additionalData && additionalData.development) return
        const { isServerStarted } = require("./server/sidecar")
        if (!isServerStarted()) return
        const mainWindow = getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            if (!mainWindow.isVisible()) {
                showMainWindow()
            }
            mainWindow.focus()
        }
    })
}

// Global Exception handlers
process.on("uncaughtException", (error) => {
    log.error("Uncaught Exception:", error)
    if (app.isReady()) {
        dialog.showErrorBox("An error occurred", `Uncaught Exception: ${error.message}\n\nCheck the logs for more details.`)
    }
})

process.on("unhandledRejection", (reason, promise) => {
    log.error("Unhandled Rejection at:", promise, "reason:", reason)
})

function logStartupEvent(stage, detail = "") {
    log.info(`[STARTUP] ${stage}: ${detail}`)
}

function logEnvironmentInfo() {
    logStartupEvent("NODE_ENV", process.env.NODE_ENV || "not set")
    logStartupEvent("Platform", process.platform)
    logStartupEvent("Architecture", process.arch)
    logStartupEvent("Node version", process.version)
    logStartupEvent("Electron version", process.versions.electron)
    logStartupEvent("App path", app.getAppPath())
    logStartupEvent("Dir name", __dirname)
    logStartupEvent("User data path", app.getPath("userData"))
    logStartupEvent("Executable path", app.getPath("exe"))
    logStartupEvent("Resources path", process.resourcesPath)
}

async function fetchGithubStatus() {
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await net.fetch("https://kamehouse.app/api/github-status", {
            signal: controller.signal
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
            return { ok: true, fallback: "" }
        }

        const data = await response.json()
        if (data.status === "down") {
            log.warn(`[Updater] Changing update channel to ${data.fallback}, reason: ${data.description}`)
            return { ok: false, fallback: data.fallback || "kamehouse" }
        }
        return { ok: true, fallback: "" }
    } catch (err) {
        return { ok: true, fallback: "" }
    }
}

app.on("child-process-gone", (event, details) => {
    log.warn("[Main] Child process gone:", JSON.stringify(details))
})

app.whenReady().then(async () => {
    logStartupEvent("App ready")

    const denshiSettings = loadSettings()
    log.info("[Main] Loaded settings:", JSON.stringify(denshiSettings))

    // Fetch Github Status and configure Updater
    let currentUpdateChannel = denshiSettings.updateChannel
    const { ok, fallback } = await fetchGithubStatus()
    if (!ok) {
        currentUpdateChannel = fallback
    }

    const updateConfig = {
        provider: "generic",
        url: DEFAULT_UPDATE_FEED_URL,
        channel: "latest",
        allowPrerelease: false,
        verifyUpdateCodeSignature: false,
    }

    if (currentUpdateChannel === "kamehouse_nightly") {
        updateConfig.url = "https://kamehouse.app/api/updates/nightly/"
        updateConfig.allowPrerelease = true
    } else if (currentUpdateChannel === "kamehouse") {
        updateConfig.url = "https://kamehouse.app/api/updates/stable/"
        updateConfig.allowPrerelease = false
    }

    if (process.env.UPDATES_URL) {
        updateConfig.url = process.env.UPDATES_URL
    }

    autoUpdater.setFeedURL(updateConfig)
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    if (!_development && (process.platform === "darwin" || process.platform === "win32")) {
        app.setLoginItemSettings({
            openAtLogin: denshiSettings.openAtLaunch,
        })
    }

    logEnvironmentInfo()

    // Register Window IPC handlers
    setupWindowIpc()

    // Setup Custom Application Protocols
    setupAppProtocol(app.getAppPath(), _development)

    // Start Local Web Server for Youtube embeds
    const localPort = startLocalServer()

    // Create App Windows
    createMainWindow(_development, localPort)
    // createSplashScreen(_development) // Disabled to avoid blank black box issues
    createCrashScreen(_development)

    // Create System Tray
    createTray(_development)

    // Setup Auto-Updater logic & IPC Handlers
    setupAutoUpdater({
        getMainWindow: () => getMainWindow(),
        isUpdateDownloaded: () => updateDownloaded,
        setUpdateDownloaded: (val) => { updateDownloaded = val },
        killServer: () => killServer()
    })

    // Setup other custom IPC handlers
    ipcMain.handle("get-local-server-port", () => getLocalServerPort())

    ipcMain.handle("denshi:getSettings", () => {
        return loadSettings()
    })

    ipcMain.handle("denshi:setSettings", (_, newSettings) => {
        const settings = loadSettings()
        const updated = { ...settings, ...newSettings }
        saveSettings(updated)
        log.info("[Main] Settings updated:", JSON.stringify(updated))

        if (!_development && (process.platform === "darwin" || process.platform === "win32")) {
            app.setLoginItemSettings({
                openAtLogin: updated.openAtLaunch,
            })
        }
        return updated
    })

    ipcMain.handle("clipboard:writeText", (_, text) => {
        if (text) {
            clipboard.writeText(text)
            return true
        }
        return false
    })

    ipcMain.on("restart-server", () => {
        log.info("[Main IPC] restart-server")
        restartkamehouseServer({
            logStartupEvent,
            isMainWindowStartupReady,
            onReadyToFinalize: finalizeStartupFromSidecar,
            onCrash: handleSidecarCrash,
        }).catch(console.error)
    })

    ipcMain.on("kill-server", () => {
        log.info("[Main IPC] kill-server")
        killServer()
    })

    ipcMain.on("quit-app", () => {
        log.info("[Main IPC] quit-app")
        cleanupAndExit()
    })

    // macOS custom activation policy IPCs
    ipcMain.on("macos-activation-policy-accessory", () => {
        if (process.platform === "darwin") {
            app.dock.hide()
            const mainWindow = getMainWindow()
            if (mainWindow) {
                mainWindow.show()
                mainWindow.setFullScreen(true)
                setTimeout(() => {
                    mainWindow.focus()
                    mainWindow.webContents.send("macos-activation-policy-accessory-done", "")
                }, 150)
            }
        }
    })

    ipcMain.on("macos-activation-policy-regular", () => {
        if (process.platform === "darwin") {
            app.dock.show()
        }
    })

    // Sidecar startup callbacks
    function finalizeStartupFromSidecar(source) {
        logStartupEvent("SERVER READY", `Server started via ${source}`)
        setTimeout(() => {
            const splashScreen = getSplashScreen()
            if (splashScreen && !splashScreen.isDestroyed()) {
                splashScreen.close()
            }
            setTimeout(() => {
                const settings = loadSettings()
                if (!settings.openInBackground) {
                    showMainWindow()
                }
            }, 1000)
        }, 2000)
    }

    function handleSidecarCrash(code) {
        const splashScreen = getSplashScreen()
        if (splashScreen && !splashScreen.isDestroyed()) {
            splashScreen.close()
        }
        const mainWindow = getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.close()
            mainWindow.destroy()
        }
        const crashScreen = getCrashScreen()
        if (crashScreen && !crashScreen.isDestroyed()) {
            crashScreen.show()
            crashScreen.webContents.send("crash", `kamehouse server process terminated with status: ${code}. Closing in 10 seconds.`)
            setTimeout(() => {
                app.exit(1)
            }, 10000)
        }
    }

    // Launch background server process
    try {
        logStartupEvent("Attempting to launch server")
        await launchkamehouseServer({
            logStartupEvent,
            isMainWindowStartupReady,
            onReadyToFinalize: finalizeStartupFromSidecar,
            onCrash: handleSidecarCrash,
        })
        logStartupEvent("Server launched successfully")
        autoUpdater.checkForUpdatesAndNotify()
    } catch (error) {
        logStartupEvent("Server launch failed", error.message)
        handleSidecarCrash("FAILED_TO_START")
    }
})

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit()
    }
})

app.on("before-quit", () => {
    log.info("[Main] App before-quit event")
    cleanupAndExit()
})
