import { create } from "zustand"
import { persist } from "zustand/middleware"
import { subscribeWithSelector } from "zustand/middleware"
import { devtools } from "zustand/middleware"
import { useQueueStore } from "./queue-store"

export interface BackgroundMusicTrack {
    name: string
    file: string
}

/**
 * Parche visual de tema con efecto inmediato. Cada clave es opcional:
 * `undefined` = sin override local (manda el servidor). Al tocar un control
 * de Apariencia se escribe aquí al instante (preview local hasta Guardar);
 * syncStoresWithSettings vuelca el servidor aquí al cargar/guardar/descartar.
 */
export interface ThemeVisualPatch {
    themeEra?: string
    themeMode?: string
    enableColorSettings?: boolean
    backgroundColor?: string
    accentColor?: string
    themeEnableBlurringEffects?: boolean
    themeEnableLiquidGlass?: boolean
    themeEnableSidebarGradient?: boolean
    themeEnableCinematicGrain?: boolean
    themeMediaPageBannerType?: string
    themeMediaPageBannerSize?: string
    themeMediaPageBannerInfoBoxSize?: string
    themeEnableMediaPageBlurredBackground?: boolean
    themeAnimeLibraryCollectionDefaultSorting?: string
}

export interface UIState {
    sidebarOpen: boolean
    sidebarMode: "expanded" | "collapsed" | "hidden"
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
    themeVisual: ThemeVisualPatch
    hideAudienceScore: boolean | undefined
    setSidebarOpen: (open: boolean) => void
    setSidebarMode: (mode: "expanded" | "collapsed" | "hidden") => void
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
    setThemeVisual: (patch: Partial<ThemeVisualPatch>) => void
    clearThemeVisual: () => void
    setHideAudienceScore: (hide: boolean) => void
}

export const useUIStore = create<UIState>()(
    devtools(
        subscribeWithSelector(
            persist(
                (set) => ({
                    sidebarOpen: false,
                    sidebarMode: "collapsed",
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
                    themeVisual: {},
                    hideAudienceScore: undefined,
                    setSidebarOpen: (open) => set({ sidebarOpen: open }),
                    setSidebarMode: (mode) => set({ sidebarMode: mode }),
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
                    setThemeVisual: (patch) => set((state) => ({ themeVisual: { ...state.themeVisual, ...patch } })),
                    clearThemeVisual: () => set({ themeVisual: {} }),
                    setHideAudienceScore: (hide) => set({ hideAudienceScore: hide }),
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
                        themeVisual: state.themeVisual,
                        hideAudienceScore: state.hideAudienceScore,
                    }),
                }
            )
        )
    )
)

// La UI reacciona a los `addToQueue` del dominio abriendo el sidebar.
// Dirección única ui->queue (el queue-store ya no importa este módulo).
if (typeof window !== "undefined") {
    useQueueStore.subscribe(
        (s) => s.queueOpenSignal,
        (signal, prevSignal) => {
            if (signal !== prevSignal) {
                useUIStore.getState().setGlobalQueueOpen(true)
            }
        }
    )
}