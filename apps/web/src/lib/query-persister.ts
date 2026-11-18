import { get, set, del } from "idb-keyval"
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client"
import type { Query } from "@tanstack/react-query"
import { version as appVersion } from "../../package.json"

const IDB_KEY = "kamehouse_react_query_cache"

/**
 * Palabras clave en queryKeys que NO deben persistirse en IndexedDB por ser
 * efímeras, de streaming, métricas en tiempo real o mutables con alta frecuencia.
 */
const EXCLUDED_KEY_PATTERNS = [
    "mediastream",
    "continuity",
    "diagnostics",
    "transcode-stats",
    "server-status",
    "system-cache",
    "pretranscode",
    "notifications",
    "google-drive-status",
    // Estado vivo del backend: evita falsos "listo" en frío desde IndexedDB al arrancar el sidecar.
    "status-get-status",
    // Logs del servidor, selector de carpetas y búsquedas semánticas: efímeros, y se guardaban 24 h (DT-07).
    "status-get-log-content",
    "status-get-latest-log-content",
    "status-get-log-filenames",
    "directory-selector",
    "intelligence-semantic-search",
    // Models_Settings trae tmdbApiKey y el clientSecret/refreshToken de Drive:
    // no se dejan en claro en IndexedDB.
    "settings",
]

function isExcludedKey(queryKey: readonly unknown[]): boolean {
    const firstKey = queryKey[0]
    if (typeof firstKey === "string") {
        const lower = firstKey.toLowerCase()
        if (EXCLUDED_KEY_PATTERNS.some((pattern) => lower.includes(pattern))) {
            return true
        }
    }
    return false
}

/**
 * Determina si una query individual califica para ser persistida en IndexedDB.
 */
function shouldDehydrateQuery(query: Query): boolean {
    // Solo persistir queries exitosas y con datos válidos
    if (query.state.status !== "success" || query.state.data === undefined) {
        return false
    }

    return !isExcludedKey(query.queryKey)
}

/** Espera mínima entre escrituras de la caché completa en IndexedDB. */
const PERSIST_THROTTLE_MS = 1000

function runWhenIdle(fn: () => void): () => void {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        const id = window.requestIdleCallback(() => fn(), { timeout: 2000 })
        return () => window.cancelIdleCallback(id)
    } else {
        const id = setTimeout(fn, 0)
        return () => clearTimeout(id)
    }
}

/**
 * Persister de React Query respaldado por IndexedDB mediante idb-keyval.
 * Protegido contra caídas silenciosas en modos privados/incógnito.
 *
 * React Query llama a persistClient en CADA evento de la caché y cada llamada
 * clona la caché entera (store.put hace structured clone): al entrar a una
 * ruta con varias queries eran ~220 ms de hilo principal bloqueado (medido en
 * /chronology). Se guarda solo el último estado, como mucho una vez por
 * throttleMs y en tiempo ocioso; al ocultar la ventana se escribe enseguida.
 */
export function createIDBPersister(idbKey: string = IDB_KEY, throttleMs: number = PERSIST_THROTTLE_MS): Persister {
    let pending: PersistedClient | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelIdle: (() => void) | null = null

    const cancelScheduled = () => {
        if (timer !== null) clearTimeout(timer)
        timer = null
        cancelIdle?.()
        cancelIdle = null
    }

    const write = async () => {
        const client = pending
        pending = null
        if (!client) return
        try {
            await set(idbKey, client)
        } catch (err) {
            console.warn("[QueryPersist] Error guardando caché en IndexedDB:", err)
        }
    }

    const flushNow = () => {
        cancelScheduled()
        return write()
    }

    if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") void flushNow()
        })
    }
    if (typeof window !== "undefined") {
        window.addEventListener("pagehide", () => void flushNow())
    }

    return {
        persistClient: async (client: PersistedClient) => {
            pending = client
            if (timer !== null || cancelIdle !== null) return
            timer = setTimeout(() => {
                timer = null
                cancelIdle = runWhenIdle(() => {
                    cancelIdle = null
                    void write()
                })
            }, throttleMs)
        },
        restoreClient: async () => {
            try {
                const client = await get<PersistedClient>(idbKey)
                if (!client?.clientState?.queries) return client
                client.clientState.queries = client.clientState.queries.filter(
                    (q) => !isExcludedKey(q.queryKey),
                )
                return client
            } catch (err) {
                console.warn("[QueryPersist] Error restaurando caché de IndexedDB:", err)
                return undefined
            }
        },
        removeClient: async () => {
            pending = null
            cancelScheduled()
            try {
                await del(idbKey)
            } catch (err) {
                console.warn("[QueryPersist] Error eliminando caché de IndexedDB:", err)
            }
        },
    }
}

/** Se resuelve cuando la caché persistida ya está en memoria (o a los 2 s, si IndexedDB no responde). */
let markCacheRestored: () => void = () => {}
const cacheRestored = new Promise<void>((resolve) => {
    markCacheRestored = resolve
    setTimeout(resolve, 2000)
})

/** Espera a que la caché de IndexedDB esté restaurada antes de decidir si hace falta pedir a red. */
export function whenCacheRestored(): Promise<void> {
    return cacheRestored
}

/** Lo llama PersistQueryClientProvider al terminar de restaurar la caché. */
export function onCacheRestored(): void {
    markCacheRestored()
}

const idbPersister = createIDBPersister()

export const queryPersistOptions = {
    persister: idbPersister,
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    // Atado a la versión de la app: cada release invalida la caché persistida automáticamente.
    buster: `kamehouse-web-v${appVersion}`,
    dehydrateOptions: {
        shouldDehydrateQuery,
    },
}
