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
]

/**
 * Determina si una query individual califica para ser persistida en IndexedDB.
 */
export function shouldDehydrateQuery(query: Query): boolean {
    // Solo persistir queries exitosas y con datos válidos
    if (query.state.status !== "success" || query.state.data === undefined) {
        return false
    }

    const firstKey = query.queryKey[0]
    if (typeof firstKey === "string") {
        const lower = firstKey.toLowerCase()
        if (EXCLUDED_KEY_PATTERNS.some((pattern) => lower.includes(pattern))) {
            return false
        }
    }

    return true
}

/**
 * Persister de React Query respaldado por IndexedDB mediante idb-keyval.
 * Protegido contra caídas silenciosas en modos privados/incógnito.
 */
export function createIDBPersister(idbKey: string = IDB_KEY): Persister {
    return {
        persistClient: async (client: PersistedClient) => {
            try {
                await set(idbKey, client)
            } catch (err) {
                console.warn("[QueryPersist] Error guardando caché en IndexedDB:", err)
            }
        },
        restoreClient: async () => {
            try {
                return await get<PersistedClient>(idbKey)
            } catch (err) {
                console.warn("[QueryPersist] Error restaurando caché de IndexedDB:", err)
                return undefined
            }
        },
        removeClient: async () => {
            try {
                await del(idbKey)
            } catch (err) {
                console.warn("[QueryPersist] Error eliminando caché de IndexedDB:", err)
            }
        },
    }
}

export const idbPersister = createIDBPersister()

export const queryPersistOptions = {
    persister: idbPersister,
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    // Atado a la versión de la app: cada release invalida la caché persistida automáticamente.
    buster: `kamehouse-web-v${appVersion}`,
    dehydrateOptions: {
        shouldDehydrateQuery,
    },
}
