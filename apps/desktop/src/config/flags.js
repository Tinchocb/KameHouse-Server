const { app } = require("electron")
const log = require("electron-log/main")

function setupChromiumFlags() {
    // Suppress noisy Chromium/FFmpeg warnings and errors (like unsupported pixel formats) in console
    app.commandLine.appendSwitch("log-level", "3")
    app.commandLine.appendSwitch("no-zygote")
    app.commandLine.appendSwitch("disable-gpu-sandbox")
    app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required")
    app.commandLine.appendSwitch("force_high_performance_gpu")
    app.commandLine.appendSwitch("disk-cache-size", (400 * 1000 * 1000).toString())
    app.commandLine.appendSwitch("force-effective-connection-type", "4g")
    app.commandLine.appendSwitch("disable-features", [
        "WidgetLayering",
        "ColorProviderRedirection",
        "WebContentsForceDarkMode",
        "HardwareMediaKeyHandling",
        "AudioServiceSandbox"
    ].join(","))
    app.commandLine.appendSwitch("force-high-performance-gpu")
    app.commandLine.appendSwitch("enable-zero-copy")
    app.commandLine.appendSwitch("enable-hardware-overlays", "single-fullscreen,single-on-top,underlay")
    app.commandLine.appendSwitch("ignore-gpu-blocklist")
    app.commandLine.appendSwitch("enable-accelerated-video-decode")
    app.commandLine.appendSwitch("enable-features", [
        "WebAssemblyLazyCompilation",
        "PlatformEncryptedDolbyVision"
    ].join(","))
    app.commandLine.appendSwitch("enable-unsafe-webgpu")
    app.commandLine.appendSwitch("enable-gpu-rasterization")
    app.commandLine.appendSwitch("enable-oop-rasterization")
    app.commandLine.appendSwitch("disable-background-timer-throttling")
    app.commandLine.appendSwitch("disable-backgrounding-occluded-windows")
    app.commandLine.appendSwitch("disable-renderer-backgrounding")
    app.commandLine.appendSwitch("disable-background-media-suspend")

    if (process.platform === "linux") {
        log.info(`Passing --gtk-version=3 to Electron`)
        app.commandLine.appendSwitch("gtk-version", "3")
    }
}

module.exports = { setupChromiumFlags }
