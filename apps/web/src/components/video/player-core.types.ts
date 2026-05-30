import type { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"

export interface PlayerStats {
    currentTime: string
    duration: string
    buffer: string
    resolution: string
    playbackRate: string
    volume: string
    source: string
}

export interface PlayerCoreProps {
    playableUrl: string
    backendTracks?: {
        audioTracks: AudioTrack[]
        subtitleTracks: SubtitleTrack[]
        chapters?: { startTime: number; endTime: number; name: string; type?: string }[]
    }
    initialProgressSeconds?: number
    onProgress?: (seconds: number) => void
    onNextEpisode?: () => void
    hasNextEpisode?: boolean
    mediaId?: number
    episodeNumber?: number
    malId?: number | null
    clientId?: string
    onClose: () => void
    /** e.g. "TV", "TV_SHORT", "MOVIE", "OVA", "SPECIAL" — used to decide fallback skip window */
    mediaFormat?: string | null
}

export interface PlayerCore {
    domElements: {
        videoElement: React.RefObject<HTMLVideoElement | null>
        containerElement: React.RefObject<HTMLDivElement | null>
        canvasElement: React.RefObject<HTMLCanvasElement | null>
        progressBarElement: React.RefObject<HTMLDivElement | null>
        progressInputElement: React.RefObject<HTMLInputElement | null>
        timeTextElement: React.RefObject<HTMLSpanElement | null>
    }
    state: {
        isPlaying: boolean
        duration: number
        currentTime: number
        volume: number
        isMuted: boolean
        isFullscreen: boolean
        controlsVisible: boolean
        status: "loading" | "ready" | "error"
        errorMsg: string
        isBuffering: boolean
        flash: "play" | "pause" | null
        /** null = hidden, "intro" = showing skip-intro button, "outro" = showing skip-outro button */
        skipMode: "intro" | "outro" | null
        skipRemainingSeconds: number
        /** 0–100: how much of the current skip segment has elapsed (used for progress fill on the button) */
        segmentProgress: number
        showNextEpisode: boolean
        countdownSeconds: number
        marathonMode: boolean
        tvMode: boolean
        remainingProgress: number
        audioTracks: AudioTrack[]
        activeAudioIndex: number
        subtitleTracks: SubtitleTrack[]
        activeSubtitleIndex: number | null
        isJassubLoading: boolean
        isJassubActive: boolean
        isSettingsOpen: boolean
        autoSkipIntro: boolean
        autoSkipOutro: boolean
        playbackRate: number
        showHeatmap: boolean
        aspectRatio: "contain" | "fill" | "cover" | "16/9"
        subtitleSize: number
        loopEnabled: boolean
        ambilightEnabled: boolean
        showStats: boolean
        statsData: PlayerStats | null
        hlsLevels: { index: number; label: string; height: number }[]
        activeHlsLevel: number
        showResume: boolean
        resumeTime: number
        autoDisableSubtitlesWhenDubbed: boolean
        /** AniSkip intervals exposed to child components for rendering timeline markers */
        skipTimesOp?: { startTime: number; endTime: number }
        skipTimesEd?: { startTime: number; endTime: number }
        showAutoSkipToast: "intro" | "outro" | null
        chapters: { startTime: number; endTime: number; name: string; type?: string }[]
        activeChapter: string | null
        isCastSupported: boolean
        castState: "disconnected" | "connecting" | "connected"
        absoluteLanUrl?: string
        serverIPs?: string[]
        serverPort?: number
    }
    actions: {
        setIsPlaying: (playing: boolean) => void
        setDuration: (duration: number) => void
        setIsBuffering: (buffering: boolean) => void
        setControlsVisible: (visible: boolean) => void
        setIsSettingsOpen: (open: boolean) => void
        triggerControlsVisibility: () => void
        togglePlay: () => void
        handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void
        skipTime: (seconds: number) => void
        skipOpening: () => void
        handleVolume: (e: React.ChangeEvent<HTMLInputElement>) => void
        toggleMute: () => void
        onSelectAudio: (track: AudioTrack) => void
        onSelectSubtitle: (track: SubtitleTrack | null) => void
        toggleFullscreen: () => void
        handleSkipIntro: () => void
        handleTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) => void
        takeScreenshot: () => void
        togglePip: () => void
        changePlaybackRate: (rate: number) => void
        setShowStats: (show: boolean) => void
        setAutoSkipIntro: (val: boolean) => void
        setAutoSkipOutro: (val: boolean) => void
        setHlsLevel: (level: number) => void
        setShowHeatmap: (val: boolean) => void
        setAspectRatio: (val: "contain" | "fill" | "cover" | "16/9") => void
        setSubtitleSize: (val: number) => void
        setLoopEnabled: (val: boolean) => void
        setAmbilightEnabled: (val: boolean) => void
        setMarathonMode: (val: boolean) => void
        setTvMode: (val: boolean) => void
        handleResume: () => void
        setShowResume: (val: boolean) => void
        setAutoDisableSubtitlesWhenDubbed: (val: boolean) => void
        skipToNextChapter: () => void
        skipToPrevChapter: () => void
        promptCast: () => void
    }
}
