const { protocol, net } = require("electron")
const path = require("path")
const fs = require("fs")
const log = require("electron-log/main")

function setupCustomProtocol() {
    protocol.registerSchemesAsPrivileged([{
        scheme: "app", privileges: {
            standard: true,
            secure: true,
            allowServiceWorkers: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true,
        }
    }])
}

function setupAppProtocol(appPath, isDev) {
    if (isDev) return

    const webPath = path.join(appPath, "web")

    protocol.handle("app", async (request) => {
        const requestUrl = new URL(request.url)
        const urlPath = requestUrl.pathname
        let filePath = path.join(webPath, urlPath)

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const response = await net.fetch(`file://${filePath}`)
            const newHeaders = new Headers(response.headers)
            newHeaders.set("Cross-Origin-Opener-Policy", "same-origin")
            newHeaders.set("Cross-Origin-Embedder-Policy", "credentialless")
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders,
            })
        }

        const ext = path.extname(urlPath)
        if (!ext || ext === ".html") {
            const fallbackPath = path.join(webPath, "index.html")
            const response = await net.fetch(`file://${fallbackPath}`)
            const newHeaders = new Headers(response.headers)
            newHeaders.set("Cross-Origin-Opener-Policy", "same-origin")
            newHeaders.set("Cross-Origin-Embedder-Policy", "credentialless")
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders,
            })
        }

        log.error(`[App Protocol] 404 Not Found: ${urlPath}`)
        return new Response("Not Found", { status: 404 })
    })
}

module.exports = {
    setupCustomProtocol,
    setupAppProtocol,
}
