import { create, StateCreator } from "zustand"
import { persist } from "zustand/middleware"
import { subscribeWithSelector } from "zustand/middleware"
import { devtools } from "zustand/middleware"

export interface PlaylistItem {
    id: string | number
    title: string
    subtitle?: string
    playableUrl: string
    thumbnail?: string
    mediaId: number
    episodeNumber?: number
    malId?: number | null
    mediaFormat?: string | null
}

export interface PlayerState {
    playerVolume: number
    isFullscreen: boolean
    setPlayerVolume: (volume: number) => void
    setFullscreen: (fullscreen: boolean) => void
    autoSkipIntro: boolean
    setAutoSkipIntro: (auto: boolean) => void
    autoSkipOutro: boolean
    setAutoSkipOutro: (auto: boolean) => void
    skipStepSeconds: number
    setSkipStepSeconds: (seconds: number) => void
    playbackRate: number
    setPlaybackRate: (rate: number) => void
    preferredAudioProfile: "latino" | "castellano" | "japanese" | "english" | "auto"
    setPreferredAudioProfile: (profile: "latino" | "castellano" | "japanese" | "english" | "auto") => void
    preferredAudioLang: string
    setPreferredAudioLang: (lang: string) => void
    preferredAudioTrackIndex: Record<number, number>
    setPreferredAudioTrackIndex: (mediaId: number, index: number) => void
    preferredSubtitleLang: string
    setPreferredSubtitleLang: (lang: string) => void
    subtitlesEnabled: boolean
    setSubtitlesEnabled: (enabled: boolean) => void
    filterFillers: boolean
    setFilterFillers: (enabled: boolean) => void
    autoSkipFiller: boolean
    setAutoSkipFiller: (enabled: boolean) => void
    showHeatmap: boolean
    setShowHeatmap: (show: boolean) => void
    aspectRatio: "contain" | "fill" | "cover" | "16/9" | "21/9"
    setAspectRatio: (ratio: "contain" | "fill" | "cover" | "16/9" | "21/9") => void
    aspectRatioBySeries: Record<number, "contain" | "fill" | "cover" | "16/9" | "21/9">
    setAspectRatioForSeries: (mediaId: number, ratio: "contain" | "fill" | "cover" | "16/9" | "21/9") => void
    subtitleSize: number
    setSubtitleSize: (size: number) => void
    loopEnabled: boolean
    setLoopEnabled: (enabled: boolean) => void
    autoDisableSubtitlesWhenDubbed: boolean
    setAutoDisableSubtitlesWhenDubbed: (auto: boolean) => void
    marathonMode: boolean
    setMarathonMode: (enabled: boolean) => void
    tvMode: boolean
    setTvMode: (enabled: boolean) => void
    tvModePrevPrefs: { autoSkipIntro: boolean; autoSkipOutro: boolean; marathonMode: boolean } | null
    ambientModeEnabled: boolean
    setAmbientModeEnabled: (enabled: boolean) => void
}

export const usePlayerStore = create<PlayerState>()(
    devtools(
        subscribeWithSelector(
            persist(
                (set) => ({
                    playerVolume: 1,
                    isFullscreen: false,
                    autoSkipIntro: false,
                    autoSkipOutro: false,
                    skipStepSeconds: 85,
                    playbackRate: 1,
                    setPlayerVolume: (volume) => set({ playerVolume: volume }),
                    setFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),
                    setAutoSkipIntro: (autoSkipIntro) => set({ autoSkipIntro }),
                    setAutoSkipOutro: (autoSkipOutro) => set({ autoSkipOutro }),
                    setSkipStepSeconds: (skipStepSeconds) => set({ skipStepSeconds }),
                    setPlaybackRate: (playbackRate) => set({ playbackRate }),
                    preferredAudioProfile: "latino",
                    setPreferredAudioProfile: (preferredAudioProfile) => set({ preferredAudioProfile }),
                    preferredAudioLang: "spa-lat",
                    setPreferredAudioLang: (preferredAudioLang) => set({ preferredAudioLang }),
                    preferredAudioTrackIndex: {},
                    setPreferredAudioTrackIndex: (mediaId, index) => set((state) => ({
                        preferredAudioTrackIndex: { ...state.preferredAudioTrackIndex, [mediaId]: index }
                    })),
                    preferredSubtitleLang: "spa",
                    setPreferredSubtitleLang: (preferredSubtitleLang) => set({ preferredSubtitleLang }),
                    subtitlesEnabled: true,
                    setSubtitlesEnabled: (subtitlesEnabled) => set({ subtitlesEnabled }),
                    filterFillers: false,
                    setFilterFillers: (filterFillers) => set({ filterFillers }),
                    autoSkipFiller: false,
                    setAutoSkipFiller: (autoSkipFiller) => set({ autoSkipFiller }),
                    showHeatmap: true,
                    setShowHeatmap: (showHeatmap) => set({ showHeatmap }),
                    aspectRatio: "contain",
                    setAspectRatio: (aspectRatio) => set({ aspectRatio }),
                    aspectRatioBySeries: {},
                    setAspectRatioForSeries: (mediaId, ratio) => set((state) => ({
                        aspectRatioBySeries: { ...state.aspectRatioBySeries, [mediaId]: ratio }
                    })),
                    subtitleSize: 100,
                    setSubtitleSize: (subtitleSize) => set({ subtitleSize }),
                    loopEnabled: false,
                    setLoopEnabled: (loopEnabled) => set({ loopEnabled }),
                    autoDisableSubtitlesWhenDubbed: true,
                    setAutoDisableSubtitlesWhenDubbed: (autoDisableSubtitlesWhenDubbed) => set({ autoDisableSubtitlesWhenDubbed }),
                    marathonMode: false,
                    setMarathonMode: (marathonMode) => set({ marathonMode }),
                    tvMode: false,
                    tvModePrevPrefs: null,
                    setTvMode: (tvMode) => set((state) => {
                        if (tvMode) {
                            return {
                                tvMode: true,
                                tvModePrevPrefs: state.tvModePrevPrefs ?? {
                                    autoSkipIntro: state.autoSkipIntro,
                                    autoSkipOutro: state.autoSkipOutro,
                                    marathonMode: state.marathonMode,
                                },
                                autoSkipIntro: true,
                                autoSkipOutro: true,
                                marathonMode: true,
                            }
                        }
                        const prev = state.tvModePrevPrefs ?? { autoSkipIntro: false, autoSkipOutro: false, marathonMode: false }
                        return {
                            tvMode: false,
                            tvModePrevPrefs: null,
                            autoSkipIntro: prev.autoSkipIntro,
                            autoSkipOutro: prev.autoSkipOutro,
                            marathonMode: prev.marathonMode,
                        }
                    }),
                    ambientModeEnabled: true,
                    setAmbientModeEnabled: (ambientModeEnabled) => set({ ambientModeEnabled }),
                }),
                {
                    name: "kamehouse-player-settings",
                    partialize: (state) => ({
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
                    }),
                }
            )
        )
    )
)