import { create } from "zustand"
import { persist } from "zustand/middleware"
import { subscribeWithSelector } from "zustand/middleware"
import { devtools } from "zustand/middleware"
import { languageFamily } from "@/components/video/track-selection"


interface PlayerState {
    playerVolume: number
    isFullscreen: boolean
    setPlayerVolume: (volume: number) => void
    setFullscreen: (fullscreen: boolean) => void
    autoSkipIntro: boolean
    setAutoSkipIntro: (auto: boolean) => void
    autoSkipOutro: boolean
    setAutoSkipOutro: (auto: boolean) => void
    skipStepSeconds: number
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
                }),
                {
                    name: "kamehouse-player-settings",
                    // Ignore retired TV fields left in an existing browser profile.
                    merge: (persisted, current) => {
                        const saved = { ...(persisted as Record<string, unknown> | undefined) }
                        delete saved.tvMode
                        delete saved.tvModePrevPrefs
                        // Un bug anterior guardaba "und" (pista sin idioma) como idioma de subtítulos
                        // preferido: no identifica ningún idioma, así que se descarta y vuelve el valor por defecto.
                        if (typeof saved.preferredSubtitleLang === "string" && !languageFamily(saved.preferredSubtitleLang)) {
                            delete saved.preferredSubtitleLang
                        }
                        return { ...current, ...saved }
                    },
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
                        aspectRatio: state.aspectRatio,
                        aspectRatioBySeries: state.aspectRatioBySeries,
                        subtitleSize: state.subtitleSize,
                        loopEnabled: state.loopEnabled,
                        marathonMode: state.marathonMode,
                    }),
                }
            )
        )
    )
)