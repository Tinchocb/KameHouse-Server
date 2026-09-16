import { create, StateCreator } from "zustand"
import { persist } from "zustand/middleware"
import { subscribeWithSelector } from "zustand/middleware"
import { devtools } from "zustand/middleware"

export interface BackgroundMusicTrack {
    name: string
    file: string
}

export interface UIState {
    sidebarOpen: boolean
    searchQuery: string
    isVideoActive: boolean
    bgMusicEnabled: boolean
    bgMusicVolume: number
    bgMusicDir: string
    bgMusicTracks: BackgroundMusicTrack[]
    uiSoundsEnabled: boolean
    uiSoundsVolume: number
    globalQueueOpen: boolean
    dynamicBackdropEnabled: boolean
    dynamicBackdropMotionEnabled: boolean
    eraOpeningPlaying: boolean
    showInitialSetup: boolean
    activeSeriesContext: string | null
    seriesSoundtrackMode: boolean
    chronologyOpen: boolean
    setSidebarOpen: (open: boolean) => void
    setSearchQuery: (query: string) => void
    setVideoActive: (active: boolean) => void
    setBgMusicEnabled: (enabled: boolean) => void
    setBgMusicVolume: (volume: number) => void
    setBgMusicDir: (dir: string) => void
    setBgMusicTracks: (tracks: BackgroundMusicTrack[]) => void
    setUiSoundsEnabled: (enabled: boolean) => void
    setUiSoundsVolume: (volume: number) => void
    setGlobalQueueOpen: (open: boolean) => void
    setDynamicBackdropEnabled: (enabled: boolean) => void
    setDynamicBackdropMotionEnabled: (enabled: boolean) => void
    setEraOpeningPlaying: (playing: boolean) => void
    setShowInitialSetup: (show: boolean) => void
    setActiveSeriesContext: (context: string | null) => void
    setSeriesSoundtrackMode: (enabled: boolean) => void
    setChronologyOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()(
    devtools(
        subscribeWithSelector(
            persist(
                (set) => ({
                    sidebarOpen: false,
                    searchQuery: "",
                    isVideoActive: false,
                    bgMusicEnabled: true,
                    bgMusicVolume: 0.25,
                    bgMusicDir: "",
                    bgMusicTracks: [],
                    uiSoundsEnabled: true,
                    uiSoundsVolume: 1.0,
                    globalQueueOpen: false,
                    dynamicBackdropEnabled: true,
                    dynamicBackdropMotionEnabled: true,
                    eraOpeningPlaying: false,
                    showInitialSetup: false,
                    activeSeriesContext: null,
                    seriesSoundtrackMode: true,
                    chronologyOpen: false,
                    setSidebarOpen: (open) => set({ sidebarOpen: open }),
                    setSearchQuery: (query) => set({ searchQuery: query }),
                    setVideoActive: (active) => set({ isVideoActive: active }),
                    setBgMusicEnabled: (enabled) => set({ bgMusicEnabled: enabled }),
                    setBgMusicVolume: (volume) => set({ bgMusicVolume: volume }),
                    setBgMusicDir: (dir) => set({ bgMusicDir: dir }),
                    setBgMusicTracks: (tracks) => set({ bgMusicTracks: tracks }),
                    setUiSoundsEnabled: (enabled) => set({ uiSoundsEnabled: enabled }),
                    setUiSoundsVolume: (volume) => set({ uiSoundsVolume: volume }),
                    setGlobalQueueOpen: (open) => set({ globalQueueOpen: open }),
                    setDynamicBackdropEnabled: (enabled) => set({ dynamicBackdropEnabled: enabled }),
                    setDynamicBackdropMotionEnabled: (enabled) => set({ dynamicBackdropMotionEnabled: enabled }),
                    setEraOpeningPlaying: (playing) => set({ eraOpeningPlaying: playing }),
                    setShowInitialSetup: (show) => set({ showInitialSetup: show }),
                    setActiveSeriesContext: (context) => set((state) => (state.activeSeriesContext === context ? state : { activeSeriesContext: context })),
                    setSeriesSoundtrackMode: (enabled) => set({ seriesSoundtrackMode: enabled }),
                    setChronologyOpen: (open) => set({ chronologyOpen: open }),
                }),
                {
                    name: "kamehouse-ui-settings",
                    partialize: (state) => ({
                        bgMusicEnabled: state.bgMusicEnabled,
                        bgMusicVolume: state.bgMusicVolume,
                        bgMusicDir: state.bgMusicDir,
                        bgMusicTracks: state.bgMusicTracks,
                        uiSoundsEnabled: state.uiSoundsEnabled,
                        uiSoundsVolume: state.uiSoundsVolume,
                        seriesSoundtrackMode: state.seriesSoundtrackMode,
                        dynamicBackdropEnabled: state.dynamicBackdropEnabled,
                        dynamicBackdropMotionEnabled: state.dynamicBackdropMotionEnabled,
                    }),
                }
            )
        )
    )
)