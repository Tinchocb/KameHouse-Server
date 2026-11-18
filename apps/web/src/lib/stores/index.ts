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
                    version: 1,
                    migrate: (persisted, version) => {
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
                    partialize: (state) => ({
                        // UI state
                        bgMusicEnabled: state.bgMusicEnabled,
                        bgMusicVolume: state.bgMusicVolume,
                        bgMusicDir: state.bgMusicDir,
                        bgMusicTracks: state.bgMusicTracks,
                        uiSoundsEnabled: state.uiSoundsEnabled,
                        uiSoundsVolume: state.uiSoundsVolume,
                        seriesSoundtrackMode: state.seriesSoundtrackMode,
                        dynamicBackdropEnabled: state.dynamicBackdropEnabled,
                        dynamicBackdropMotionEnabled: state.dynamicBackdropMotionEnabled,
                        themeVisual: state.themeVisual,
                        hideAudienceScore: state.hideAudienceScore,
                        // Player state
                        playerVolume: state.playerVolume,
                        autoSkipIntro: state.autoSkipIntro,
                        autoSkipOutro: state.autoSkipOutro,
                        skipStepSeconds: state.skipStepSeconds,
                        playbackRate: state.playbackRate,
                        preferredAudioProfile: state.preferredAudioProfile,
                        preferredAudioLang: state.preferredAudioLang,
                        preferredAudioTrackIndex: state.preferredAudioTrackIndex,
                        preferredSubtitleLang: state.preferredSubtitleLang,
                        subtitlesEnabled: state.subtitlesEnabled,
                        autoDisableSubtitlesWhenDubbed: state.autoDisableSubtitlesWhenDubbed,
                        aspectRatio: state.aspectRatio,
                        aspectRatioBySeries: state.aspectRatioBySeries,
                        subtitleSize: state.subtitleSize,
                        loopEnabled: state.loopEnabled,
                        marathonMode: state.marathonMode,
                        // Queue state
                        playlistQueue: Array.isArray(state.playlistQueue) ? state.playlistQueue.slice(0, 50) : [],
                        currentQueueIndex: typeof state.currentQueueIndex === 'number' ? Math.min(state.currentQueueIndex, 49) : -1,
                        queueRepeatMode: state.queueRepeatMode,
                    }),
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
