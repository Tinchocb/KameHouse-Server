import { getServerBaseUrl } from "./server-url"

export const AUTH_CHANGED_EVENT = "kamehouse-auth-changed"
type ServerSession = { required: boolean; sessionToken?: string; streamToken?: string; expiresAt?: number }
let session: ServerSession | null = null
let sessionServer = ""

function serverOrigin(): string {
    return getServerBaseUrl() || (typeof window === "undefined" ? "http://localhost" : window.location.origin)
}

function storageKey(): string { return `kamehouse-session:${serverOrigin()}` }

export function getServerSession(): ServerSession | null {
    const server = serverOrigin()
    if (sessionServer !== server) {
        sessionServer = server
        session = null
        try { session = JSON.parse(sessionStorage.getItem(storageKey()) || "null") as ServerSession | null } catch { /* private mode */ }
    }
    if (session?.expiresAt && session.expiresAt * 1000 <= Date.now()) return null
    return session
}

export function setServerSession(value: ServerSession | null): void {
    sessionServer = serverOrigin()
    session = value
    try {
        if (value?.required) sessionStorage.setItem(storageKey(), JSON.stringify(value))
        else sessionStorage.removeItem(storageKey())
    } catch { /* memory-only session when storage is unavailable */ }
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

export function getAuthorizationHeaders(): Record<string, string> {
    const token = getServerSession()?.sessionToken
    return token ? { Authorization: `Bearer ${token}` } : {}
}

export function getWebSocketProtocols(): string[] {
    const token = getServerSession()?.sessionToken
    return token ? [`kamehouse.token.${token}`] : []
}

const RESOURCE_PATHS = ["/api/v1/mediastream/direct/play", "/api/v1/mediastream/transcode/", "/api/v1/mediastream/hls/", "/api/v1/mediastream/subs", "/api/v1/mediastream/subtitles", "/api/v1/mediastream/att/", "/api/v1/drive/play", "/api/v1/video-thumbnail", "/api/v1/video-storyboard", "/api/v1/image-proxy", "/api/v1/music/stream"]

export function authorizeResourceUrl(raw: string): string {
    const token = getServerSession()?.streamToken
    if (!token || !raw) return raw
    try {
        const base = serverOrigin()
        const url = new URL(raw, base)
        if (url.origin !== new URL(base).origin || !RESOURCE_PATHS.some(path => url.pathname.startsWith(path))) return raw
        url.searchParams.set("token", token)
        return url.toString()
    } catch { return raw }
}

export class SessionError extends Error {
    constructor(public status: number, public retryAfter: number) { super(status === 429 ? "Esperá unos segundos antes de volver a intentar." : status === 401 ? "La contraseña no es correcta." : "No se pudo conectar con el servidor.") }
}

export async function requestServerSession(password?: string, signal?: AbortSignal): Promise<ServerSession> {
    const headers = password === undefined ? getAuthorizationHeaders() : { Authorization: `Bearer ${password}` }
    const response = await fetch(new URL("/api/v1/auth/session", serverOrigin()), { headers, signal, cache: "no-store" })
    if (!response.ok) throw new SessionError(response.status, Number(response.headers.get("Retry-After")) || 5)
    const body = await response.json() as { data?: ServerSession }
    if (!body.data || typeof body.data.required !== "boolean" || (body.data.required && (!body.data.sessionToken || !body.data.streamToken || !body.data.expiresAt))) throw new Error("Respuesta de acceso inválida")
    return body.data
}
