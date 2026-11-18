import { useUIStore } from "./ui-store"
import { usePlayerStore } from "./player-store"
import { useQueueStore } from "./queue-store"

import { create, StateCreator } from "zustand"
import { persist, subscribeWithSelector, devtools, type PersistStorage, type StorageValue } from "zustand/middleware"

function shallowEqualRecord<T extends object>(a: T, b: T): boolean {
    const keysA = Object.keys(a) as (keyof T)[]
    const keysB = Object.keys(b) as (keyof T)[]
    if (keysA.length !== keysB.length) return false
    for (const key of keysA) {
        if (!Object.is(a[key], b[key])) return false
    }
    return true
}

/**
 * Envuelve el storage de Zustand `persist` para omitir `JSON.stringify` y `localStorage.setItem`
 * cuando solo cambian campos efímeros excluidos de `partialize`.
 */
function createDeduplicatedJSONStorage<T extends object>(): PersistStorage<T> {
    let lastValue: StorageValue<T> | null = null
    let lastJson: string | null = null

    return {
        getItem: (name) => {
            if (typeof window === "undefined") return null
            try {
                const raw = window.localStorage.getItem(name)
                if (!raw) return null
                lastJson = raw
                const parsed = JSON.parse(raw) as StorageValue<T>
                lastValue = parsed
                return parsed
            } catch {
                return null
            }
        },
        setItem: (name, value) => {
            if (typeof window === "undefined") return
            if (
                lastValue !== null &&
                value.version === lastValue.version &&
                shallowEqualRecord(lastValue.state, value.state)
            ) {
                return
            }
            const json = JSON.stringify(value)
            if (json === lastJson) {
                lastValue = value
                return
            }
            lastValue = value
            lastJson = json
            window.localStorage.setItem(name, json)
        },
        removeItem: (name) => {
            lastValue = null
            lastJson = null
            if (typeof window !== "undefined") {
                window.localStorage.removeItem(name)
            }
        },
    }
}

type CombinedState = 
    ReturnType<typeof useUIStore.getState> &
    ReturnType<typeof usePlayerStore.getState> &
    ReturnType<typeof useQueueStore.getState>

const createCombinedSlice: StateCreator<
    CombinedState,
    [],
    [],
    CombinedState
> = () => ({
    ...useUIStore.getState(),
    ...usePlayerStore.getState(),
    ...useQueueStore.getState(),
})

export const useAppStore = create<CombinedState>()(
    devtools(
        subscribeWithSelector(
            persist(
                (set, get, store) => ({
                    ...createCombinedSlice(set, get, store),
                }),
                {
                    name: "kamehouse-app-settings",
                    storage: createDeduplicatedJSONStorage(),
                    version: 2,
                    migrate: (persisted, version) => {
                        // Desde la v2 el espejo no guarda nada (partialize vacío): lo viejo se descarta (DT-05).
                        if (version < 2) return {} as CombinedState
                        const p = (persisted ?? {}) as Partial<CombinedState>
                        if (version < 1) {
                            // Limpia colas/índices potencialmente obsoletos de versiones sin versionado
                            if (Array.isArray(p.playlistQueue) && p.playlistQueue.length > 50) {
                                p.playlistQueue = p.playlistQueue.slice(0, 50)
                            }
                            if (typeof p.currentQueueIndex === "number" && Array.isArray(p.playlistQueue) && p.currentQueueIndex >= p.playlistQueue.length) {
                                p.currentQueueIndex = p.playlistQueue.length === 0 ? -1 : p.playlistQueue.length - 1
                            }
                        }
                        return p as CombinedState
                    },
                    merge: (persistedState, currentState) => {
                        const rec = persistedState as Record<string, unknown> | undefined
                        const p = (rec ?? {}) as Partial<CombinedState>
                        if (rec) {
                            delete rec.tvMode
                            delete rec.tvModePrevPrefs
                            if ('sidebarOpen' in rec) delete rec.sidebarOpen
                            if ('globalQueueOpen' in rec) delete rec.globalQueueOpen
                            if ('activeQueuePlayItem' in rec) delete rec.activeQueuePlayItem
                            if (Array.isArray(p.playlistQueue)) {
                                p.playlistQueue = p.playlistQueue.slice(0, 50)
                                if (typeof p.currentQueueIndex === 'number' && p.currentQueueIndex >= p.playlistQueue.length) {
                                    p.currentQueueIndex = p.playlistQueue.length === 0 ? -1 : Math.max(0, p.playlistQueue.length - 1)
                                }
                            }
                        }
                        return { ...currentState, ...p }
                    },
                    // Sin datos propios: cada campo ya lo persiste su sub-store (ui, player o queue).
                    // Un espejo persistido podía pisar al sub-store al hidratar (DT-05).
                    partialize: () => ({}),
                }
            )
        )
    )
)

if (typeof window !== "undefined") {
    // useAppStore es un read-model: los sub-stores (ui/player/queue) son la
    // única fuente de escritura y se propagan aquí en una sola dirección.
    // NO escribir useAppStore.setState desde componentes: usar el sub-store
    // dueño (useUIStore/usePlayerStore/useQueueStore).
    let isSyncing = false
    const guardedSync = (fn: () => void) => {
        if (isSyncing) return
        isSyncing = true
        try {
            fn()
        } finally {
            isSyncing = false
        }
    }

    useUIStore.subscribe((state) => {
        guardedSync(() => useAppStore.setState(state))
    })

    usePlayerStore.subscribe((state) => {
        guardedSync(() => useAppStore.setState(state))
    })

    useQueueStore.subscribe((state) => {
        guardedSync(() => useAppStore.setState(state))
    })

    useAppStore.subscribe((state, prevState) => {
        const bgAudio = window.__kamehouse_bg_audio
        if (!bgAudio) return
        try {
            if (
                (state.isVideoActive && !prevState.isVideoActive) ||
                (!state.bgMusicEnabled && prevState.bgMusicEnabled) ||
                (state.eraOpeningPlaying && !prevState.eraOpeningPlaying)
            ) {
                bgAudio.pause()
                window.__kamehouse_bg_audio_outgoing?.pause()
            }
            if (state.bgMusicVolume !== prevState.bgMusicVolume && !window.__kamehouse_bg_audio_outgoing) {
                bgAudio.volume = Math.pow(state.bgMusicVolume, 2)
            }
        } catch {}
    })
}
