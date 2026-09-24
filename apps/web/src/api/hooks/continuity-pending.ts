import type { UpdateContinuityWatchHistoryItem_Variables } from "@/api/generated/endpoint.types"
import { ApiError, isTransientStatus } from "@/api/client/requests"

// ─── Cola offline de continuidad ──────────────────────────────────────────────
// Los writers periódicos (sync cada 15 s, mpv, tracking) no deben perder el
// progreso si se cae la red. Se guarda el último save fallido por mediaId (solo
// el más reciente importa: continuity es "last write wins") y se reenvía al
// volver la conexión.

const STORAGE_KEY = "kamehouse:continuity:pending:v1"
/** Un progreso que no pudo enviarse en una semana ya no es fiable. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface PendingEntry {
    variables: UpdateContinuityWatchHistoryItem_Variables
    savedAt: number
}
type PendingMap = Record<string, PendingEntry>

function read(): PendingMap {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw) as unknown
        return parsed && typeof parsed === "object" ? (parsed as PendingMap) : {}
    } catch {
        return {}
    }
}

function write(map: PendingMap): void {
    try {
        if (Object.keys(map).length === 0) localStorage.removeItem(STORAGE_KEY)
        else localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    } catch {
        // Storage lleno o bloqueado: se pierde la cola, no el reproductor.
    }
}

/** Fallo de red / backend caído: vale la pena reintentar más tarde. */
export function isRecoverableSaveError(error: unknown): boolean {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return true
    if (error instanceof TypeError) return true // fetch() sin red
    return error instanceof ApiError && isTransientStatus(error.status)
}

export function queuePendingContinuity(variables: UpdateContinuityWatchHistoryItem_Variables, now = Date.now()): void {
    const mediaId = variables?.options?.mediaId
    if (mediaId == null) return
    const map = read()
    map[String(mediaId)] = { variables, savedAt: now }
    write(map)
}

export function clearPendingContinuity(mediaId: number | undefined | null): void {
    if (mediaId == null) return
    const map = read()
    if (!(String(mediaId) in map)) return
    delete map[String(mediaId)]
    write(map)
}

export function getPendingContinuity(now = Date.now()): UpdateContinuityWatchHistoryItem_Variables[] {
    const map = read()
    let dirty = false
    const out: UpdateContinuityWatchHistoryItem_Variables[] = []
    for (const [key, entry] of Object.entries(map)) {
        if (!entry?.variables || now - entry.savedAt > MAX_AGE_MS) {
            delete map[key]
            dirty = true
            continue
        }
        out.push(entry.variables)
    }
    if (dirty) write(map)
    return out
}

let flushing = false

/**
 * Reenvía la cola en serie. Se detiene en el primer fallo: el propio `send`
 * vuelve a encolar el save si el error sigue siendo recuperable.
 */
export async function flushPendingContinuity(
    send: (variables: UpdateContinuityWatchHistoryItem_Variables) => Promise<unknown>
): Promise<void> {
    if (flushing) return
    if (typeof navigator !== "undefined" && navigator.onLine === false) return
    flushing = true
    try {
        for (const variables of getPendingContinuity()) {
            clearPendingContinuity(variables.options.mediaId)
            await send(variables)
        }
    } catch {
        // Se reintenta en el próximo evento "online" / montaje.
    } finally {
        flushing = false
    }
}
