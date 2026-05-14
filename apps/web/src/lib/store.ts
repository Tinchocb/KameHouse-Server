import { create, StateCreator } from "zustand"
import { persist } from "zustand/middleware"

// --- UI Slice ---
export interface UIState {
    sidebarOpen: boolean
    activeTheme: string
    searchQuery: string
    setSidebarOpen: (open: boolean) => void
    setActiveTheme: (theme: string) => void
    setSearchQuery: (query: string) => void
}

import { type ScannerMessage } from "@/lib/server/ws-events"

export interface ScanEvent extends ScannerMessage {
    id: string
    timestamp: number
}

// --- Scanner Slice ---
export interface ScannerState {
    isScanning: boolean
    scanProgress: number
    currentScanningFile: string
    events: ScanEvent[]
    activeStageIdx: number
    lastFinish: ScanEvent | null
    pruneCount: number
    setScanning: (isScanning: boolean) => void
    setScanProgress: (progress: number) => void
    setScanningFile: (file: string) => void
    setEvents: (events: ScanEvent[] | ((prev: ScanEvent[]) => ScanEvent[])) => void
    setScannerState: (state: Partial<ScannerState>) => void
}

export const createScannerSlice: StateCreator<UIState & PlayerState & ScannerState, [], [], ScannerState> = (set) => ({
    isScanning: false,
    scanProgress: 0,
    currentScanningFile: "",
    events: [],
    activeStageIdx: -1,
    lastFinish: null,
    pruneCount: 0,
    setScanning: (isScanning) => set({ isScanning }),
    setScanProgress: (scanProgress) => set({ scanProgress }),
    setScanningFile: (currentScanningFile) => set({ currentScanningFile }),
    setEvents: (events) => set((state) => ({ 
        events: typeof events === "function" ? events(state.events) : events 
    })),
    setScannerState: (state) => set((s) => ({ ...s, ...state })),
})

export const createUISlice: StateCreator<UIState & PlayerState, [], [], UIState> = (set) => ({
    sidebarOpen: true,
    activeTheme: "dark",
    searchQuery: "",
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    setActiveTheme: (theme) => set({ activeTheme: theme }),
    setSearchQuery: (query) => set({ searchQuery: query }),
})

// --- Player Slice ---
export interface PlayerState {
    playerVolume: number
    videoQualities: string[]
    currentQuality: string
    isFullscreen: boolean
    setPlayerVolume: (volume: number) => void
    setVideoQualities: (qualities: string[]) => void
    setCurrentQuality: (quality: string) => void
    setFullscreen: (fullscreen: boolean) => void
    autoSkipIntro: boolean
    setAutoSkipIntro: (auto: boolean) => void
    playbackRate: number
    setPlaybackRate: (rate: number) => void
    preferredAudioLang: string
    setPreferredAudioLang: (lang: string) => void
    preferredSubtitleLang: string
    setPreferredSubtitleLang: (lang: string) => void
}

export const createPlayerSlice: StateCreator<UIState & PlayerState, [], [], PlayerState> = (set) => ({
    playerVolume: 1,
    videoQualities: ["1080p"],
    currentQuality: "1080p",
    isFullscreen: false,
    autoSkipIntro: false,
    playbackRate: 1,
    setPlayerVolume: (volume) => set({ playerVolume: volume }),
    setVideoQualities: (qualities) => set({ videoQualities: qualities }),
    setCurrentQuality: (quality) => set({ currentQuality: quality }),
    setFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),
    setAutoSkipIntro: (autoSkipIntro) => set({ autoSkipIntro }),
    setPlaybackRate: (playbackRate) => set({ playbackRate }),
    preferredAudioLang: "jpn",
    setPreferredAudioLang: (preferredAudioLang) => set({ preferredAudioLang }),
    preferredSubtitleLang: "spa",
    setPreferredSubtitleLang: (preferredSubtitleLang) => set({ preferredSubtitleLang }),
})

// --- Combined Store ---
export const useAppStore = create<UIState & PlayerState & ScannerState>()((...a) => ({
    ...createUISlice(...a),
    ...createPlayerSlice(...a),
    ...createScannerSlice(...a),
}))

// --- Progress Store (Persisted) ---
// Uses Record<string, true> instead of string[] for O(1) isWatched() lookups.
interface ProgressState {
    watchedEpisodes: Record<string, true>
    markWatched: (episodeId: string) => void
    unmarkWatched: (episodeId: string) => void
    isWatched: (episodeId: string) => boolean
}

export const useProgressStore = create<ProgressState>()(
    persist(
        (set, get) => ({
            watchedEpisodes: {},
            markWatched: (episodeId) =>
                set((state) => ({
                    watchedEpisodes: { ...state.watchedEpisodes, [episodeId]: true },
                })),
            unmarkWatched: (episodeId) =>
                set((state) => {
                    const next = { ...state.watchedEpisodes }
                    delete next[episodeId]
                    return { watchedEpisodes: next }
                }),
            isWatched: (episodeId) => episodeId in get().watchedEpisodes,
        }),
        {
            name: "kamehouse-minimal-progress",
            // Migrate old string[] format from localStorage to Record<string, true>
            merge: (persisted, current) => {
                const p = persisted as Partial<ProgressState> & { watchedEpisodes?: unknown }
                if (Array.isArray(p.watchedEpisodes)) {
                    const migrated: Record<string, true> = {}
                    for (const id of p.watchedEpisodes as string[]) migrated[id] = true
                    return { ...current, watchedEpisodes: migrated }
                }
                return { ...current, ...p }
            },
        }
    )
)
