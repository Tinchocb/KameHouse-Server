// Resolución de URLs reproducibles en red local (desktop sidecar / LAN).
// Extraído de player-core: lógica sin hooks; `window` se lee directo
// igual que antes para no cambiar comportamiento.
import { __DEV_SERVER_PORT } from "@/lib/server/config"

export function resolveLanUrl(playableUrl: string, serverIPs?: string[] | null, serverPort?: number | null): string {
    if (!playableUrl) return ""
    if (typeof window !== "undefined" && (window.location.protocol === "https:" || !window.location.hostname.match(/^(192\.168\.|10\.|172\.|localhost|127\.0\.0\.1)/))) {
        return playableUrl.startsWith("/") ? `${window.location.origin}${playableUrl}` : playableUrl;
    }
    let lanIp = "127.0.0.1"

    if (serverIPs && serverIPs.length > 0) {
        const preferredIp = serverIPs.find(ip =>
            ip.startsWith("192.168.") ||
            ip.startsWith("10.") ||
            ip.startsWith("172.")
        )
        lanIp = preferredIp || serverIPs[0]
    } else if (typeof window !== "undefined") {
        const hn = window.location.hostname
        if (hn !== "localhost" && hn !== "127.0.0.1" && hn !== "::1") {
            lanIp = hn
        }
    }
    const port = serverPort || __DEV_SERVER_PORT

    const protocol = typeof window !== "undefined" ? window.location.protocol : "http:"

    if (playableUrl.startsWith("/")) {
        return `${protocol}//${lanIp}:${port}${playableUrl}`
    }

    try {
        const url = new URL(playableUrl)
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]") {
            url.hostname = lanIp
            url.port = String(port)
            return url.toString()
        }
        if (typeof window !== "undefined" && url.host === window.location.host) {
            url.hostname = lanIp
            url.port = String(port)
            return url.toString()
        }
    } catch {
        if (playableUrl.includes("localhost") || playableUrl.includes("127.0.0.1")) {
            return playableUrl
                .replace("localhost", lanIp)
                .replace("127.0.0.1", lanIp)
                .replace(/:\d+\//, `:${port}/`)
        }
    }
    return playableUrl
}
