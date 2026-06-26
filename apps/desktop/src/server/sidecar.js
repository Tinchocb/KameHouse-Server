const { spawn, execSync } = require("child_process")
const fs = require("fs")
const path = require("path")
const { net, app } = require("electron")
const log = require("electron-log/main")

let serverProcess = null
let serverStarted = false
let isShutdown = false
let serverRestartPromise = null
let dynamicServerPort = null

const DESKTOP_SERVER_HOST = "127.0.0.1"
const DESKTOP_SERVER_DEFAULT_PORT = 43211
const DESKTOP_SERVER_DEV_PORT = 43212

function isDevelopment() {
    return process.env.NODE_ENV === "development"
}

function getDesktopServerPort() {
    if (dynamicServerPort) {
        return dynamicServerPort
    }

    if (isDevelopment()) {
        return DESKTOP_SERVER_DEV_PORT
    }

    const envPort = Number.parseInt(process.env.KAMEHOUSE_SERVER_PORT || "", 10)
    if (Number.isInteger(envPort) && envPort > 0) {
        return envPort
    }

    return DESKTOP_SERVER_DEFAULT_PORT
}

function getDesktopServerBaseUrl() {
    return `http://${DESKTOP_SERVER_HOST}:${getDesktopServerPort()}`
}

async function isDesktopServerReachable() {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1000)

    try {
        const response = await net.fetch(`${getDesktopServerBaseUrl()}/api/v1/status`, {
            signal: controller.signal,
        })
        return response.ok
    } catch {
        return false
    } finally {
        clearTimeout(timeoutId)
    }
}

function killServer() {
    if (serverProcess) {
        log.info("[Sidecar] Sending SIGTERM to server process for graceful shutdown")
        try {
            // Under Windows, child_process.kill() works by calling TerminateProcess which is NOT graceful.
            // But Node does have some options, or we rely on SIGTERM for Unix.
            serverProcess.kill("SIGTERM")
            
            // Setup a fallback force kill if it doesn't shut down in 2 seconds
            const pid = serverProcess.pid
            const p = serverProcess
            setTimeout(() => {
                try {
                    if (p && !p.killed) {
                        log.warn(`[Sidecar] Server process did not exit gracefully, force killing PID ${pid}`)
                        if (process.platform === "win32") {
                            execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" })
                        } else {
                            p.kill("SIGKILL")
                        }
                    }
                } catch (e) {
                    // Ignore error if already dead
                }
            }, 2000)

            serverProcess = null
        } catch (err) {
            log.error("[Sidecar] Error killing server process:", err)
        }
        return true
    }
    return false
}

function setShutdown(val) {
    isShutdown = val
}

function getShutdown() {
    return isShutdown
}

function isServerStarted() {
    return serverStarted
}

function getServerProcess() {
    return serverProcess
}

async function launchkamehouseServer(opts = {}) {
    const {
        logStartupEvent = () => {},
        onReadyToFinalize = () => {},
        onCrash = () => {},
        isMainWindowStartupReady = () => false
    } = opts

    return new Promise((resolve, reject) => {
        let startupResolved = false
        let startupPollInterval = null
        let waitingForRenderer = false

        function clearStartupProbe() {
            if (startupPollInterval) {
                clearInterval(startupPollInterval)
                startupPollInterval = null
            }
        }

        function checkFinalizeStartup(source) {
            if (startupResolved) {
                return
            }

            if (!isMainWindowStartupReady()) {
                if (!waitingForRenderer) {
                    waitingForRenderer = true
                    logStartupEvent("WAITING FOR RENDERER", source)
                }
                return
            }

            finalizeStartup(source)
        }

        function finalizeStartup(source) {
            if (startupResolved) {
                return
            }

            startupResolved = true
            clearStartupProbe()

            log.info(`[Sidecar] Server started via ${source}`)
            serverStarted = true
            resolve()
            onReadyToFinalize(source)
        }

        async function probeServerStartup() {
            if (startupResolved || !serverProcess || serverProcess.killed) {
                return
            }

            if (await isDesktopServerReachable()) {
                checkFinalizeStartup("HTTP status probe")
            }
        }

        // Check for -no-binary flag
        if (process.argv.includes("-no-binary")) {
            logStartupEvent("SKIPPING SERVER LAUNCH", "Detected -no-binary flag")
            serverStarted = true
            resolve()
            onReadyToFinalize("no-binary-flag")
            return
        }

        // Determine binary path
        let binaryName = ""
        if (process.platform === "win32") {
            binaryName = "kamehouse-server-windows.exe"
        } else if (process.platform === "darwin") {
            const arch = process.arch === "arm64" ? "arm64" : "amd64"
            binaryName = `kamehouse-server-darwin-${arch}`
        } else if (process.platform === "linux") {
            const arch = process.arch === "arm64" ? "arm64" : "amd64"
            binaryName = `kamehouse-server-linux-${arch}`
        }

        let binaryPath
        if (isDevelopment()) {
            const serverBinaryName = process.platform === "win32" ? "kamehouse.exe" : "kamehouse"
            binaryPath = path.join(__dirname, "../../../server", serverBinaryName)
        } else {
            binaryPath = path.join(process.resourcesPath, "binaries", binaryName)
        }

        logStartupEvent("Using binary", `${binaryPath} (${process.arch})`)

        if (!fs.existsSync(binaryPath)) {
            const error = new Error(`Server binary not found at ${binaryPath}`)
            logStartupEvent("ERROR", error.message)
            return reject(error)
        }

        if (process.platform !== "win32") {
            try {
                fs.chmodSync(binaryPath, "755")
            } catch (error) {
                log.error(`[Sidecar] Failed to make binary executable: ${error}`)
            }
        }

        const args = []
        if (isDevelopment()) {
            if (process.env.TEST_DATADIR) {
                args.push("-datadir", process.env.TEST_DATADIR)
            } else {
                const devDataDir = path.join(app.getPath("appData"), "kamehouse-dev")
                args.push("-datadir", devDataDir)
            }
        }
        args.push("-desktop-sidecar", "true")

        log.info(`[Sidecar] Spawning server process: ${binaryPath}`)

        try {
            const spawnEnv = {
                ...process.env,
                KAMEHOUSE_PORT: String(getDesktopServerPort()),
                KAMEHOUSE_ENV: "production", // Force sidecar mode
            }
            if (isDevelopment()) {
                spawnEnv.KAMEHOUSE_DEV_CORS_ORIGINS = "http://localhost:43210,http://127.0.0.1:43210,http://localhost,http://127.0.0.1"
            }
            serverProcess = spawn(binaryPath, args, { env: spawnEnv })
        } catch (spawnError) {
            log.error("[Sidecar] Failed to spawn server process synchronously:", spawnError)
            return reject(spawnError)
        }

        startupPollInterval = setInterval(() => {
            void probeServerStartup()
        }, 500)
        void probeServerStartup()

        serverProcess.stdout.on("data", (data) => {
            const dataStr = data.toString()
            
            // Check for port handshake
            const portMatch = dataStr.match(/\[KAMEHOUSE_PORT_HANDSHAKE:\s*(\d+)\]/)
            if (portMatch) {
                const port = parseInt(portMatch[1], 10)
                if (port > 0) {
                    dynamicServerPort = port
                    log.info(`[Sidecar] Received port handshake: ${dynamicServerPort}`)
                }
            }

            // Check if the frontend is connected
            if (!serverStarted && dataStr.includes("Client connected")) {
                checkFinalizeStartup("websocket client connection")
            }
        })

        serverProcess.stderr.on("data", (data) => {
            log.error(`[Go Server STDERR] ${data.toString().trim()}`)
        })

        serverProcess.on("close", (code) => {
            clearStartupProbe()
            log.info(`[Sidecar] Server process exited with code ${code}`)

            if (!startupResolved && !isShutdown) {
                reject(new Error(`Server process exited prematurely with code ${code} before starting.`))
                onCrash(code)
            }
        })

        serverProcess.on("error", (err) => {
            clearStartupProbe()
            log.error("[Sidecar] Server process spawn error event:", err)
            reject(err)
        })
    })
}

async function restartkamehouseServer(opts = {}) {
    if (serverRestartPromise) {
        log.info("[Sidecar] Restart already in progress, skipping duplicate request")
        return serverRestartPromise
    }

    serverRestartPromise = (async () => {
        const currentServerProcess = serverProcess
        if (currentServerProcess && !currentServerProcess.killed) {
            log.info("[Sidecar] Waiting for existing server process to exit before relaunching")

            await new Promise((resolve) => {
                let settled = false
                let killTimeout = null
                function finish() {
                    if (settled) return
                    settled = true
                    if (killTimeout) clearTimeout(killTimeout)
                    currentServerProcess.removeListener("close", finish)
                    currentServerProcess.removeListener("error", finish)
                    if (serverProcess === currentServerProcess) {
                        serverProcess = null
                    }
                    resolve()
                }

                currentServerProcess.once("close", finish)
                currentServerProcess.once("error", finish)

                try {
                    currentServerProcess.kill()
                } catch (error) {
                    log.error("[Sidecar] Failed to kill server during restart:", error)
                    finish()
                    return
                }

                killTimeout = setTimeout(() => {
                    log.warn("[Sidecar] Timed out waiting for server process to exit, force killing")
                    try {
                        if (process.platform === "win32") {
                            execSync(`taskkill /PID ${currentServerProcess.pid} /F`, { stdio: "ignore" })
                        } else {
                            currentServerProcess.kill("SIGKILL")
                        }
                    } catch (e) {
                        log.error("[Sidecar] Failed to force kill server:", e)
                    }
                    finish()
                }, 3000)
            })
        } else {
            serverProcess = null
        }

        await launchkamehouseServer(opts)
    })().finally(() => {
        serverRestartPromise = null
    })

    return serverRestartPromise
}

module.exports = {
    getDesktopServerPort,
    isDesktopServerReachable,
    killServer,
    setShutdown,
    getShutdown,
    isServerStarted,
    getServerProcess,
    launchkamehouseServer,
    restartkamehouseServer,
}
