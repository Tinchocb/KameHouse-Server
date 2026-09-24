import { __DEV_SERVER_PORT } from "@/lib/server/config"
import { __isDesktop__ } from "@/types/constants"

declare global {
    interface Window {
        /** Puerto dinámico del server local, seteado por el runtime desktop (ver main.tsx). */
        __KAMEHOUSE_PORT__?: number | string
    }
}

function devOrProd(dev: string, prod: string): string {
    return import.meta.env.MODE === "development" ? dev : prod
}

let cachedClientId: string | null = null
function getWebClientId(): string {
    if (typeof window === "undefined") return "0"
    if (cachedClientId) return cachedClientId
    try {
        let stored = window.sessionStorage.getItem("kamehouse_client_id")
        if (!stored) {
            stored = "web-" + Math.random().toString(36).substring(2, 9) + "-" + Date.now().toString(36)
            window.sessionStorage.setItem("kamehouse_client_id", stored)
        }
        cachedClientId = stored
        return stored
    } catch {
        cachedClientId = "web-" + Math.random().toString(36).substring(2, 9)
        return cachedClientId
    }
}

/**
 * WebSocket URL for `/api/v1/ws`, derived from the same rules as HTTP base URL.
 */
export function getApiWebSocketUrl(): string {
    const clientId = getWebClientId()
    const query = `?id=${encodeURIComponent(clientId)}`
    const base = getServerBaseUrl()
    if (base.startsWith("http://")) return base.replace("http://", "ws://") + "/api/v1/ws" + query
    if (base.startsWith("https://")) return base.replace("https://", "wss://") + "/api/v1/ws" + query
    if (typeof window !== "undefined") {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
        return `${protocol}//${window.location.host}/api/v1/ws${query}`
    }
    return `ws://127.0.0.1:${__DEV_SERVER_PORT}/api/v1/ws${query}`
}

function parseKamehousePort(raw: unknown): number | null {
    const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : typeof raw === "number" ? raw : NaN
    if (!Number.isInteger(n) || n <= 0 || n > 65535) return null
    return n
}

function resolveRuntimePort(): number {
    if (typeof window !== "undefined") {
        const parsed = parseKamehousePort(window.__KAMEHOUSE_PORT__)
        if (parsed != null) return parsed
    }
    return __DEV_SERVER_PORT
}

export function getServerBaseUrl(removeProtocol: boolean = false): string {
    // Si el runtime de desktop (Tauri / sidecar) definió el puerto local, conectarse directamente a él.
    // Se valida rango entero 1-65535 para evitar hijack de baseURL/WS vía inyección.
    if (typeof window !== "undefined" && window.__KAMEHOUSE_PORT__ != null) {
        const port = parseKamehousePort(window.__KAMEHOUSE_PORT__)
        if (port != null) {
            let ret = `http://127.0.0.1:${port}`
            if (removeProtocol) {
                ret = ret.replace("http://", "").replace("https://", "")
            }
            return ret
        }
    }

    if (typeof window !== "undefined") {
        const o = window.location?.origin ?? ""
        if (o.includes("wails.localhost") || o.startsWith("wails://")) {
            const port = resolveRuntimePort()
            let ret = `http://127.0.0.1:${port}`
            if (removeProtocol) {
                ret = ret.replace("http://", "").replace("https://", "")
            }
            return ret
        }
    }

    if (__isDesktop__) {
        let ret: string
        const runtimePort = resolveRuntimePort()
        if (typeof window !== "undefined" && parseKamehousePort(window.__KAMEHOUSE_PORT__) != null) {
            ret = `http://127.0.0.1:${runtimePort}`
        } else if (import.meta.env.MODE === "development") {
            if (typeof window !== "undefined") {
                const o = window.location?.origin ?? ""
                if (o.startsWith("http://") || o.startsWith("https://")) {
                    ret = ""
                } else {
                    ret = `http://127.0.0.1:${runtimePort}`
                }
            } else {
                ret = `http://127.0.0.1:${__DEV_SERVER_PORT}`
            }
        } else if (typeof window !== "undefined") {
            const o = window.location?.origin ?? ""
            if (o.startsWith("http://") || o.startsWith("https://")) {
                ret = o
            } else {
                ret = `http://127.0.0.1:${runtimePort}`
            }
        } else {
            ret = `http://127.0.0.1:${__DEV_SERVER_PORT}`
        }
        if (removeProtocol) {
            ret = ret.replace("http://", "").replace("https://", "")
        }
        return ret
    }

    // For standard web environments (dev proxy or production self-hosted),
    // relative paths are preferred because the server and client share an origin.
    if (import.meta.env.MODE === "development") {
        return ""
    }

    const ret = typeof window !== "undefined"
        ? (devOrProd("", "")) // Use relative implicitly for web
        : ""
    return ret
}
