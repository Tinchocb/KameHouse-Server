import { create } from "zustand"
import { persist } from "zustand/middleware"
import { subscribeWithSelector } from "zustand/middleware"
import { devtools } from "zustand/middleware"
import { useQueueStore } from "./queue-store"
import { isNavDensity, type NavDensity } from "@/lib/nav-compact"
import { normalizeThemePreference } from "@/lib/theme/themes-registry"

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
interface ThemeVisualPatch {
    themeEra?: string
    themeMode?: string
    enableColorSettings?: boolean
    themeEnableBlurringEffects?: boolean
    themeEnableLiquidGlass?: boolean
    themeEnableMediaPageBlurredBackground?: boolean
    themeAnimeLibraryCollectionDefaultSorting?: string
}

interface UIState {
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
    scrollBlurEnabled: boolean
    /** Tarjeta que se contrae al desplazar la ficha de series. Solo este dispositivo. */
    seriesHeroCardEnabled: boolean
    /** Barra de navegación flotante: solo íconos al bajar (auto), siempre (compact) o nunca (expanded). */
    navDensity: NavDensity
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
    setScrollBlurEnabled: (enabled: boolean) => void
    setSeriesHeroCardEnabled: (enabled: boolean) => void
    setNavDensity: (density: NavDensity) => void
    setEraOpeningPlaying: (playing: boolean) => void
    setShowInitialSetup: (show: boolean) => void
    setActiveSeriesContext: (context: string | null) => void
    setSeriesSoundtrackMode: (enabled: boolean) => void
    setThemeVisual: (patch: Partial<ThemeVisualPatch>) => void
    setHideAudienceScore: (hide: boolean) => void
}

export const useUIStore = create<UIState>()(
    devtools(
        subscribeWithSelector(
            persist(
                (set) => ({
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
                    scrollBlurEnabled: true,
                    seriesHeroCardEnabled: true,
                    navDensity: "auto",
                    eraOpeningPlaying: false,
                    showInitialSetup: false,
                    activeSeriesContext: null,
                    seriesSoundtrackMode: true,
                    themeVisual: { themeMode: "era", themeEra: "era-universe" },
                    hideAudienceScore: undefined,
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
                    setScrollBlurEnabled: (enabled) => set({ scrollBlurEnabled: enabled }),
                    setSeriesHeroCardEnabled: (enabled) => set({ seriesHeroCardEnabled: enabled }),
                    setNavDensity: (density) => set({ navDensity: isNavDensity(density) ? density : "auto" }),
                    setEraOpeningPlaying: (playing) => set({ eraOpeningPlaying: playing }),
                    setShowInitialSetup: (show) => set({ showInitialSetup: show }),
                    setActiveSeriesContext: (context) => set((state) => (state.activeSeriesContext === context ? state : { activeSeriesContext: context })),
                    setSeriesSoundtrackMode: (enabled) => set({ seriesSoundtrackMode: enabled }),
                    setThemeVisual: (patch) => set((state) => ({ themeVisual: { ...state.themeVisual, ...patch } })),
                    setHideAudienceScore: (hide) => set({ hideAudienceScore: hide }),
                }),
                {
                    name: "kamehouse-ui-settings",
                    merge: (persistedState, currentState) => {
                        const rec = persistedState as Record<string, unknown> | undefined
                        const p = (rec ?? {}) as Partial<UIState>
                        if (rec && "uiStyle" in rec) {
                            delete rec.uiStyle
                        }
                        const tv = (p.themeVisual ?? {}) as ThemeVisualPatch
                        p.themeVisual = normalizeThemePreference(tv)
                        return { ...currentState, ...p }
                    },
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
                        scrollBlurEnabled: state.scrollBlurEnabled,
                        seriesHeroCardEnabled: state.seriesHeroCardEnabled,
                        navDensity: state.navDensity,
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
