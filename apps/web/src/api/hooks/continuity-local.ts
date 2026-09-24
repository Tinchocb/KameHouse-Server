import type { Continuity_WatchHistoryItem, Continuity_WatchHistoryItemResponse } from "@/api/generated/types"

// ─── Espejo local de progreso ─────────────────────────────────────────────────
// Guarda el último progreso visto en este navegador que el servidor todavía no
// confirmó (cierre de pestaña con keepalive sin respuesta, red caída, crash).
// Al reabrir la serie, si es más reciente que lo que tiene el servidor, el
// resume parte de aquí. Un guardado confirmado igual o posterior lo borra.

const STORAGE_KEY = "kamehouse:continuity:local:v1"

export interface LocalProgress {
    mediaId: number
    episodeNumber: number
    currentTime: number
    duration: number
    filepath?: string
    updatedAt: number
}
type LocalMap = Record<string, LocalProgress>

// Cache de la última lectura: mientras el JSON guardado no cambie, read()
// devuelve los mismos objetos y los consumidores pueden memoizar por referencia.
let cachedRaw: string | null | undefined
let cachedMap: LocalMap = {}

function read(): LocalMap {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw === cachedRaw) return cachedMap
        const parsed = raw ? (JSON.parse(raw) as unknown) : null
        cachedMap = parsed && typeof parsed === "object" ? (parsed as LocalMap) : {}
        cachedRaw = raw
        return cachedMap
    } catch {
        return {}
    }
}

function write(map: LocalMap): void {
    try {
        if (Object.keys(map).length === 0) localStorage.removeItem(STORAGE_KEY)
        else localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    } catch {
        // Storage bloqueado o lleno: el espejo es best-effort.
    }
}

export function saveLocalProgress(p: Omit<LocalProgress, "updatedAt">, now = Date.now()): void {
    if (!p.mediaId || !p.episodeNumber || !(p.currentTime > 0)) return
    const map = { ...read() }
    map[String(p.mediaId)] = { ...p, updatedAt: now }
    write(map)
}

/** Referencia estable mientras el espejo no cambie (apto para deps de useMemo). */
export function getLocalProgress(mediaId: number | undefined | null): LocalProgress | undefined {
    if (!mediaId) return undefined
    return read()[String(mediaId)]
}

/** El servidor confirmó `saved`: si cubre el espejo, este ya no aporta nada. */
export function confirmLocalProgress(saved: { mediaId: number; episodeNumber: number; currentTime: number }): void {
    const map = { ...read() }
    const local = map[String(saved.mediaId)]
    if (!local) return
    if (local.episodeNumber === saved.episodeNumber && local.currentTime <= saved.currentTime + 1) {
        delete map[String(saved.mediaId)]
        write(map)
    }
}

/**
 * Devuelve la respuesta del servidor o, si el espejo local es más reciente
 * (o el servidor aún no respondió), un item sintetizado desde el espejo.
 */
export function mergeWithLocalProgress(
    server: Continuity_WatchHistoryItemResponse | undefined,
    local: LocalProgress | undefined
): Continuity_WatchHistoryItemResponse | undefined {
    if (!local) return server
    const serverItem = server?.item
    const serverUpdated = serverItem ? Date.parse(serverItem.timeUpdated) : NaN
    if (serverItem && Number.isFinite(serverUpdated) && serverUpdated >= local.updatedAt) return server

    const iso = new Date(local.updatedAt).toISOString()
    const item: Continuity_WatchHistoryItem = {
        kind: serverItem?.kind ?? "mediastream",
        filepath: local.filepath ?? serverItem?.filepath ?? "",
        mediaId: local.mediaId,
        episodeNumber: local.episodeNumber,
        currentTime: local.currentTime,
        duration: local.duration,
        timeAdded: serverItem?.timeAdded ?? iso,
        timeUpdated: iso,
    }
    return { item, found: true }
}
