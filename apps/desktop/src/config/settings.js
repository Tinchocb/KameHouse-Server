const { app } = require("electron")
const fs = require("fs")
const path = require("path")
const log = require("electron-log/main")

const SETTINGS_DEFAULTS = {
    minimizeToTray: true,
    openInBackground: false,
    openAtLaunch: false,
    updateChannel: "github",
    windowBounds: null,
    windowMaximized: true,
}

function getSettingsPath() {
    return path.join(app.getPath("userData"), "denshi-settings.json")
}

function loadSettings() {
    try {
        const settingsPath = getSettingsPath()
        if (fs.existsSync(settingsPath)) {
            const data = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
            return { ...SETTINGS_DEFAULTS, ...data }
        }
    } catch (err) {
        log.error("[Settings] Failed to load settings:", err)
    }
    return { ...SETTINGS_DEFAULTS }
}

function saveSettings(settings) {
    try {
        const settingsPath = getSettingsPath()
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8")
    } catch (err) {
        log.error("[Settings] Failed to save settings:", err)
    }
}

module.exports = {
    SETTINGS_DEFAULTS,
    loadSettings,
    saveSettings,
}
