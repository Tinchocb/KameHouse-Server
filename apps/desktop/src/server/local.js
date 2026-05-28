const http = require("http")
const log = require("electron-log/main")

let localServerPort = null

function startLocalServer() {
    const server = http.createServer((req, res) => {
        const match = req.url.match(/^\/player\/([\w-]+)/)
        if (match) {
            const id = match[1]
            let url = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&enablejsapi=1&playsinline=1&modestbranding=1&rel=0e`
            if (id.startsWith("compact_")) {
                url = `https://www.youtube-nocookie.com/embed/${id.substring(8)}?autoplay=1&controls=0&mute=1&disablekb=1&loop=1&vq=medium&playlist=${id.substring(8)}&cc_lang_pref=ja&enablejsapi=true`
            }
            if (id.startsWith("banner_")) {
                url = `https://www.youtube-nocookie.com/embed/${id.substring(7)}?autoplay=1&controls=0&mute=1&disablekb=1&loop=1&playlist=${id.substring(7)}&cc_lang_pref=ja&enablejsapi=true`
            }
            const html = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <style>
              html, body { margin: 0; padding: 0; height: 100%; background-color: black; }
              iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; }
            </style>
          </head>
          <body>
            <iframe src="${url}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
          </body>
        </html>`
            res.writeHead(200, { "Content-Type": "text/html" })
            res.end(html)
            return
        }
        res.writeHead(404)
        res.end("Not found")
    })

    server.listen(0) // random free port
    localServerPort = server.address().port
    log.info(`[Local Server] YouTube embed server running at http://127.0.0.1:${localServerPort}`)
    return localServerPort
}

function getLocalServerPort() {
    return localServerPort
}

module.exports = {
    startLocalServer,
    getLocalServerPort,
}
