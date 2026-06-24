const { BrowserWindow, screen, app, dialog, ipcMain, shell, Menu } = require("electron")
const path = require("path")
const fs = require("fs")
const log = require("electron-log/main")
const { loadSettings, saveSettings } = require("../config/settings")

let mainWindow = null
let splashScreen = null
let crashScreen = null
let mainWindowStartupReady = false
let shouldMaximizeMainWindow = false

const MAIN_WINDOW_DEFAULT_BOUNDS = {
    width: 800,
    height: 600,
}
const MIN_VISIBLE_WINDOW_EDGE = 120

function getMainWindow() { return mainWindow }
function getSplashScreen() { return splashScreen }
function getCrashScreen() { return crashScreen }
function isMainWindowStartupReady() { return mainWindowStartupReady }
function setMainWindowStartupReady(val) { mainWindowStartupReady = val }

function getSafeMainWindowPlacement(rawBounds) {
    const width = Number(rawBounds?.width)
    const height = Number(rawBounds?.height)
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        return { bounds: { ...MAIN_WINDOW_DEFAULT_BOUNDS }, forceMaximize: false }
    }

    const x = Number(rawBounds?.x)
    const y = Number(rawBounds?.y)
    if (!app.isReady() || !Number.isFinite(x) || !Number.isFinite(y)) {
        return { bounds: { width, height }, forceMaximize: false }
    }

    const bounds = { x, y, width, height }
    if (screen.getAllDisplays().some(({ workArea }) => {
        const visibleWidth = Math.min(bounds.x + bounds.width, workArea.x + workArea.width) - Math.max(bounds.x, workArea.x)
        const visibleHeight = Math.min(bounds.y + bounds.height, workArea.y + workArea.height) - Math.max(bounds.y, workArea.y)
        return visibleWidth >= MIN_VISIBLE_WINDOW_EDGE && visibleHeight >= MIN_VISIBLE_WINDOW_EDGE
    })) {
        return { bounds, forceMaximize: false }
    }

    const { workArea } = screen.getPrimaryDisplay()
    const fallbackWidth = Math.min(width, workArea.width)
    const fallbackHeight = Math.min(height, workArea.height)

    return {
        bounds: {
            x: Math.round(workArea.x + (workArea.width - fallbackWidth) / 2),
            y: Math.round(workArea.y + (workArea.height - fallbackHeight) / 2),
            width: fallbackWidth,
            height: fallbackHeight,
        },
        forceMaximize: true,
    }
}

function saveMainWindowState() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return
    }

    const { x, y, width, height } = mainWindow.getNormalBounds()
    const settings = loadSettings()
    const newSettings = {
        ...settings,
        windowBounds: { x, y, width, height },
        windowMaximized: mainWindow.isMaximized(),
    }
    saveSettings(newSettings)
}

function hideMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return
    }

    saveMainWindowState()
    mainWindow.hide()
    if (process.platform === "darwin") {
        app.dock.hide()
    }
}

function showMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return
    }

    let forceMaximize = shouldMaximizeMainWindow
    shouldMaximizeMainWindow = false

    if (app.isReady()) {
        const wasMaximized = mainWindow.isMaximized()
        const { bounds, forceMaximize: fallbackMaximize } = getSafeMainWindowPlacement(mainWindow.getNormalBounds())

        if (wasMaximized) {
            mainWindow.unmaximize()
        }

        const currentBounds = mainWindow.getBounds()
        if (currentBounds.x !== bounds.x
            || currentBounds.y !== bounds.y
            || currentBounds.width !== bounds.width
            || currentBounds.height !== bounds.height) {
            mainWindow.setBounds(bounds)
        }

        if (wasMaximized) {
            mainWindow.maximize()
        }

        forceMaximize = forceMaximize || fallbackMaximize
    }

    if (mainWindow.isMinimized()) {
        mainWindow.restore()
    }

    const settings = loadSettings()
    if ((settings.windowMaximized || forceMaximize) && !mainWindow.isMaximized()) {
        mainWindow.maximize()
    }

    mainWindow.show()
    mainWindow.focus()
    if (process.platform === "darwin") {
        app.dock.show()
    }
}

function showEditableContextMenu(webContents, params) {
    if (!params.isEditable) return

    const template = [
        { role: "undo", enabled: params.editFlags.canUndo },
        { role: "redo", enabled: params.editFlags.canRedo },
        { type: "separator" },
        { role: "cut", enabled: params.editFlags.canCut },
        { role: "copy", enabled: params.editFlags.canCopy },
        { role: "paste", enabled: params.editFlags.canPaste },
        { role: "selectAll", enabled: params.editFlags.canSelectAll },
    ]

    Menu.buildFromTemplate(template).popup({
        window: BrowserWindow.fromWebContents(webContents) ?? undefined,
    })
}

function createMainWindow(isDev, localPort) {
    log.info("[Window] Creating main window")
    mainWindowStartupReady = false
    const settings = loadSettings()
    const savedPlacement = getSafeMainWindowPlacement(settings.windowBounds)
    const isFullscreenArg = process.argv.includes("--fullscreen")

    const windowOptions = {
        ...savedPlacement.bounds,
        fullscreen: isFullscreenArg ? true : undefined,
        show: isDev ? true : false,
        backgroundColor: "#111111",
        acceptFirstMouse: false,
        icon: path.join(__dirname, "../../assets/icon.png"),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, "../preload.js"),
            webSecurity: true,
            // allowRunningInsecureContent is enabled to allow streaming local network media content
            // (e.g. from local DLNA servers or HTTP-only NAS devices) when the app runs in a secure context.
            allowRunningInsecureContent: true,
            enableBlinkFeatures: "FontAccess, AudioVideoTracks",
            backgroundThrottling: true,
            webviewTag: true,
        }
    }

    if (!isDev) {
        if (process.platform === "darwin") {
            windowOptions.titleBarStyle = "hiddenInset"
        }
        if (process.platform === "win32") {
            windowOptions.titleBarStyle = "hidden"
        }
    }

    mainWindow = new BrowserWindow(windowOptions)

    if (isDev) {
        mainWindow.webContents.openDevTools()
    }

    mainWindow.once("ready-to-show", () => {
        log.info("[Window] Main window ready-to-show event, displaying window")
        showMainWindow()
        if (isFullscreenArg) {
            mainWindow.setFullScreen(true)
        }
    })

    mainWindow.webContents.on("did-start-loading", () => {
        log.info("[Window] Main window did-start-loading")
    })

    mainWindow.webContents.on("did-finish-load", () => {
        log.info("[Window] Main window did-finish-load")
    })

    mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
        log.error(`[Window] Main window did-fail-load: ${errorDescription} (${errorCode}) for URL: ${validatedURL}`)
    })

    mainWindow.webContents.once("dom-ready", () => {
        if (!mainWindowStartupReady) {
            mainWindowStartupReady = true
            log.info("[Window] Main window dom-ready event (auto-fallback)")
        }
    })

    mainWindow.webContents.on("context-menu", (event, params) => {
        if (!params.isEditable) return
        event.preventDefault()
        showEditableContextMenu(mainWindow.webContents, params)
    })

    if (process.platform === "win32" || process.platform === "linux") {
        mainWindow.setMenuBarVisibility(false)
    }

    mainWindow.on("render-process-gone", (event, details) => {
        log.error("[Window] Main window render process gone:", JSON.stringify(details))
        if (crashScreen && !crashScreen.isDestroyed()) {
            crashScreen.show()
            crashScreen.webContents.send(
                "crash",
                `The desktop window stopped unexpectedly (${details.reason || "unknown reason"}${typeof details.exitCode === "number" ? `, exit code ${details.exitCode}` : ""}). The background server may still be running.`
            )
        }
    })

    mainWindow.webContents.on("will-attach-webview", (event, webPreferences, params) => {
        const isAllowed = (() => {
            if (!localPort) return false
            try {
                const parsed = new URL(params.src)
                return parsed.protocol === "http:"
                    && parsed.hostname === "127.0.0.1"
                    && parsed.port === String(localPort)
                    && parsed.pathname.startsWith("/player/")
            } catch {
                return false
            }
        })()

        if (!isAllowed) {
            log.warn(`[Window] Blocked unexpected webview src ${params.src}`)
            event.preventDefault()
            return
        }

        delete webPreferences.preload
        delete webPreferences.preloadURL
        delete params.preload

        webPreferences.nodeIntegration = false
        webPreferences.contextIsolation = true
        webPreferences.sandbox = true
        webPreferences.webSecurity = true
        // Allow running insecure content in webview tag to support HTTP-only local media streams
        webPreferences.allowRunningInsecureContent = true

        params.allowpopups = false
    })

    mainWindow.webContents.setWindowOpenHandler(({ frameName, url }) => {
        if (url.startsWith("http://") || url.startsWith("https://")) {
            shell.openExternal(url)
            return { action: "deny" }
        }
        try {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.loadURL(url)
            }
        } catch (e) {
            log.warn("[Window] setWindowOpenHandler fallback loadURL failed", e)
        }
        return { action: "deny" }
    })

    // Load the web content
    if (isDev) {
        log.info("[Window] Loading from dev server http://127.0.0.1:43210")
        mainWindow.loadURL("http://127.0.0.1:43210")
    } else {
        log.info("[Window] Loading production build with custom protocol")
        mainWindow.loadURL("app://-")
    }

    mainWindow.on("close", (event) => {
        const { getShutdown } = require("../server/sidecar")
        if (!getShutdown()) {
            const currentSettings = loadSettings()
            if (currentSettings.minimizeToTray) {
                event.preventDefault()
                hideMainWindow()
            } else {
                const { cleanupAndExit } = require("../main-coordinator")
                cleanupAndExit()
            }
        }
    })

    function safeSendToMainWindow(channel, ...args) {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindowStartupReady) {
            try {
                mainWindow.webContents.send(channel, ...args)
            } catch (err) {
                log.warn(`[Window] Failed to send ${channel} to renderer:`, err.message)
            }
        }
    }

    // Window events for renderer
    mainWindow.on("minimize", () => {
        safeSendToMainWindow("window:minimized")
    })
    mainWindow.on("hide", () => {
        safeSendToMainWindow("window:hidden")
    })
    mainWindow.on("maximize", () => {
        safeSendToMainWindow("window:maximized")
    })
    mainWindow.on("unmaximize", () => {
        safeSendToMainWindow("window:unmaximized")
    })
    mainWindow.on("enter-full-screen", () => {
        safeSendToMainWindow("window:fullscreen", true)
    })
    mainWindow.on("leave-full-screen", () => {
        safeSendToMainWindow("window:fullscreen", false)
    })
}

function createSplashScreen(isDev) {
    log.info("[Window] Creating splash screen")
    const settings = loadSettings()
    splashScreen = new BrowserWindow({
        width: 800,
        height: 600,
        frame: false,
        resizable: false,
        show: !settings.openInBackground,
        backgroundColor: "#0c0c0c",
        icon: path.join(__dirname, "../../assets/icon.png"),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, "../preload.js")
        }
    })

    if (isDev) {
        log.info("[Window] Loading splash from dev server http://127.0.0.1:43210/splashscreen")
        splashScreen.loadURL("http://127.0.0.1:43210/splashscreen")
    } else {
        log.info("[Window] Loading splash screen with custom protocol")
        splashScreen.loadURL("app://-/splashscreen")
    }
}

function createCrashScreen(isDev) {
    log.info("[Window] Creating crash screen")
    crashScreen = new BrowserWindow({
        width: 800,
        height: 600,
        frame: false,
        resizable: false,
        show: false,
        icon: path.join(__dirname, "../../assets/icon.png"),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, "../preload.js")
        }
    })

    if (isDev) {
        crashScreen.loadURL("http://127.0.0.1:43210/splashscreen/crash")
    } else {
        crashScreen.loadURL("app://-/splashscreen/crash")
    }
}

// Register Window Control IPC handlers
function setupWindowIpc() {
    ipcMain.on("window:minimize", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.minimize()
        }
    })

    ipcMain.on("window:maximize", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.maximize()
        }
    })

    ipcMain.on("window:close", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.close()
        }
    })

    ipcMain.on("window:toggleMaximize", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize()
            } else {
                mainWindow.maximize()
            }
        }
    })

    ipcMain.on("window:setFullscreen", (_, fullscreen) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setFullScreen(fullscreen)
        }
    })

    ipcMain.on("window:hide", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            hideMainWindow()
        }
    })

    ipcMain.on("window:show", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            showMainWindow()
        }
    })

    ipcMain.handle("window:getCurrentWindow", () => {
        return mainWindow?.id
    })

    ipcMain.handle("window:isMainWindow", (event) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        return win === mainWindow
    })

    ipcMain.handle("window:isMaximized", () => {
        return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false
    })

    ipcMain.handle("window:isMinimizable", () => {
        return mainWindow && !mainWindow.isDestroyed() ? mainWindow.minimizable : false
    })

    ipcMain.handle("window:isMaximizable", () => {
        return mainWindow && !mainWindow.isDestroyed() ? mainWindow.maximizable : false
    })

    ipcMain.handle("window:isClosable", () => {
        return mainWindow && !mainWindow.isDestroyed() ? mainWindow.closable : false
    })

    ipcMain.handle("window:isFullscreen", () => {
        return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isFullScreen() : false
    })

    ipcMain.handle("window:isVisible", () => {
        return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isVisible() : false
    })
}

module.exports = {
    getMainWindow,
    getSplashScreen,
    getCrashScreen,
    isMainWindowStartupReady,
    setMainWindowStartupReady,
    hideMainWindow,
    showMainWindow,
    saveMainWindowState,
    createMainWindow,
    createSplashScreen,
    createCrashScreen,
    setupWindowIpc,
}
