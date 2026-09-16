export { useUIStore, type UIState, type BackgroundMusicTrack } from "./ui-store"
export { usePlayerStore, type PlayerState, type PlaylistItem } from "./player-store"
export { useQueueStore, type QueueState, type QueueRepeatMode } from "./queue-store"
export { useSkipTimesStore, type SkipTimesState } from "./skip-times-store"
export { useScannerStore, type ScanEvent, type ScannerState } from "./scanner-store"

import { useUIStore } from "./ui-store"
import { usePlayerStore } from "./player-store"
import { useQueueStore } from "./queue-store"

import { create, StateCreator } from "zustand"
import { persist } from "zustand/middleware"
import { subscribeWithSelector } from "zustand/middleware"
import { devtools } from "zustand/middleware"

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
                    merge: (persistedState, currentState) => {
                        const p = persistedState as Partial<CombinedState> | undefined
                        if (p) {
                            if (typeof p.sidebarOpen !== 'undefined') delete p.sidebarOpen
                            if (typeof p.globalQueueOpen !== 'undefined') delete p.globalQueueOpen
                            if (typeof p.activeQueuePlayItem !== 'undefined') delete p.activeQueuePlayItem
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
                        showHeatmap: state.showHeatmap,
                        aspectRatio: state.aspectRatio,
                        aspectRatioBySeries: state.aspectRatioBySeries,
                        subtitleSize: state.subtitleSize,
                        loopEnabled: state.loopEnabled,
                        marathonMode: state.marathonMode,
                        tvMode: state.tvMode,
                        filterFillers: state.filterFillers,
                        autoSkipFiller: state.autoSkipFiller,
                        ambientModeEnabled: state.ambientModeEnabled,
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
    // Bidirectional sync between isolated sub-stores and useAppStore
    let isSyncing = false

    useUIStore.subscribe((state) => {
        if (isSyncing) return
        isSyncing = true
        useAppStore.setState(state)
        isSyncing = false
    })

    usePlayerStore.subscribe((state) => {
        if (isSyncing) return
        isSyncing = true
        useAppStore.setState(state)
        isSyncing = false
    })

    useQueueStore.subscribe((state) => {
        if (isSyncing) return
        isSyncing = true
        useAppStore.setState(state)
        isSyncing = false
    })

    useAppStore.subscribe((state) => {
        if (isSyncing) return
        isSyncing = true
        useUIStore.setState(state)
        usePlayerStore.setState(state)
        useQueueStore.setState(state)
        isSyncing = false
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
            }
            if (state.bgMusicVolume !== prevState.bgMusicVolume) {
                bgAudio.volume = Math.pow(state.bgMusicVolume, 2)
            }
        } catch {}
    })
}