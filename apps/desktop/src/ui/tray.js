const { Tray, Menu, nativeImage, app } = require("electron")
const path = require("path")
const { showMainWindow, hideMainWindow, getMainWindow } = require("./window")
const { isServerStarted } = require("../server/sidecar")
const { cleanupAndExit } = require("../main-coordinator")

let tray = null

function createTray(isDev) {
    const iconName = process.platform === "darwin" ? "18x18.png" : "icon.png"
    let iconPath = path.join(__dirname, "../../assets", iconName)
    if (isDev) {
        iconPath = path.join(app.getAppPath(), "assets", iconName)
    }
    const icon = nativeImage.createFromPath(iconPath)
    tray = new Tray(icon)

    const contextMenu = Menu.buildFromTemplate([
        {
            id: "toggle_visibility",
            label: "Toggle Visibility",
            click: () => {
                if (!isServerStarted()) return
                const mainWindow = getMainWindow()
                if (mainWindow.isVisible()) {
                    hideMainWindow()
                } else {
                    showMainWindow()
                }
            }
        },
        ...(process.platform === "darwin" ? [{
            id: "accessory_mode",
            label: "Remove from Dock",
            click: () => {
                app.dock.hide()
            }
        }] : []),
        {
            id: "quit",
            label: "Quit KameHouse",
            click: () => {
                cleanupAndExit()
            }
        }
    ])

    tray.setToolTip("KameHouse")

    if (process.platform !== "darwin") {
        tray.setContextMenu(contextMenu)
    }

    tray.on("click", () => {
        if (!isServerStarted()) return
        const mainWindow = getMainWindow()
        if (mainWindow.isVisible()) {
            hideMainWindow()
        } else {
            showMainWindow()
        }
    })

    if (process.platform === "darwin") {
        tray.on("right-click", () => {
            tray.popUpContextMenu(contextMenu)
        })
    }

    return tray
}

function getTray() {
    return tray
}

module.exports = {
    createTray,
    getTray,
}
