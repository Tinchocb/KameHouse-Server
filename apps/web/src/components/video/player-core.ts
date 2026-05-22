import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import Hls from "hls.js"
import JASSUB from "jassub"
import { useAniSkipTimes } from "@/api/hooks/aniskip.hooks"
import { usePlayerShortcuts } from "./usePlayerShortcuts"
import { usePlayerJassub } from "./usePlayerJassub"
import { usePlayerHls } from "./usePlayerHls"
import { useAnimeTracking } from "@/api/hooks/useAnimeTracking"
import { useWebSocket } from "@/hooks/use-websocket"
import { getApiWebSocketUrl } from "@/api/client/server-url"
import { useMediastreamShutdownTranscodeStream } from "@/api/hooks/mediastream.hooks"
import { useAppStore } from "@/lib/store"
import { usePlayerProgressSync } from "@/api/hooks/usePlayerProgressSync"
import { useGetContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"
import { useGetStatus } from "@/api/hooks/settings.hooks"
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

function getAbsoluteLanUrl(playableUrl: string, serverIPs?: string[], serverPort?: number): string {
    if (!playableUrl) return ""
    let lanIp = "127.0.0.1"
    if (serverIPs && serverIPs.length > 0) {
        const preferredIp = serverIPs.find(ip => 
            ip.startsWith("192.168.") || 
            ip.startsWith("10.") || 
            ip.startsWith("172.")
        )
        lanIp = preferredIp || serverIPs[0]
    } else if (typeof window !== "undefined") {
        const hn = window.location.hostname
        if (hn !== "localhost" && hn !== "127.0.0.1" && hn !== "::1") {
            lanIp = hn
        }
    }
    const port = serverPort || 43211

    if (playableUrl.startsWith("/")) {
        return `http://${lanIp}:${port}${playableUrl}`
    }

    try {
        const url = new URL(playableUrl)
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]") {
            url.hostname = lanIp
            url.port = String(port)
            return url.toString()
        }
        if (typeof window !== "undefined" && url.host === window.location.host) {
            url.hostname = lanIp
            url.port = String(port)
            return url.toString()
        }
    } catch (e) {
        if (playableUrl.includes("localhost") || playableUrl.includes("127.0.0.1")) {
            return playableUrl
                .replace("localhost", lanIp)
                .replace("127.0.0.1", lanIp)
                .replace(/:\d+\//, `:${port}/`)
        }
    }
    return playableUrl
}

export function usePlayerCore(props: PlayerCoreProps): PlayerCore {
    const {
        playableUrl,
        backendTracks,
        initialProgressSeconds = 0,
        onClose,
        onProgress,
        onNextEpisode,
        hasNextEpisode = false,
        mediaId,
        episodeNumber,
        malId,
        clientId,
        mediaFormat,
    } = props

    const { data: statusQuery } = useGetStatus()
    const serverIPs = statusQuery?.serverIPs
    const serverPort = statusQuery?.serverPort

    const absoluteLanUrl = useMemo(() => {
        return getAbsoluteLanUrl(playableUrl, serverIPs, serverPort)
    }, [playableUrl, serverIPs, serverPort])

    const absoluteLanUrlRef = useRef(absoluteLanUrl)
    const playableUrlRef = useRef(playableUrl)

    useEffect(() => {
        absoluteLanUrlRef.current = absoluteLanUrl
    }, [absoluteLanUrl])

    useEffect(() => {
        playableUrlRef.current = playableUrl
    }, [playableUrl])

    const castingSavedStateRef = useRef<{
        src: string
        currentTime: number
        wasPlaying: boolean
        wasHls: boolean
    } | null>(null)

    const isCastingRef = useRef(false)

    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const hlsRef = useRef<Hls | null>(null)
    const jassubRef = useRef<JASSUB | null>(null)

    const progressBarRef = useRef<HTMLDivElement>(null)
    const progressInputRef = useRef<HTMLInputElement>(null)
    const timeTextRef = useRef<HTMLSpanElement>(null)

    const hasAutoSkippedIntroRef = useRef(false)
    const hasAutoSkippedOutroRef = useRef(false)
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null)

    const [isPlaying, setIsPlaying] = useState(false)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)
    const [isMuted, setIsMuted] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [controlsVisible, setControlsVisible] = useState(true)
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
    const [errorMsg, setErrorMsg] = useState("")
    const [isBuffering, setIsBuffering] = useState(false)
    const [flash, setFlash] = useState<"play" | "pause" | null>(null)

    const [skipMode, setSkipMode] = useState<"intro" | "outro" | null>(null)
    const [skipRemainingSeconds, setSkipRemainingSeconds] = useState(0)
    const [segmentProgress, setSegmentProgress] = useState(0)
    const [showNextEpisode, setShowNextEpisode] = useState(false)
    const [countdownSeconds, setCountdownSeconds] = useState(10)
    const [showAutoSkipToast, setShowAutoSkipToast] = useState<"intro" | "outro" | null>(null)
    const [activeChapter, setActiveChapter] = useState<string | null>(null)
    const [isCastSupported, setIsCastSupported] = useState(() => {
        if (typeof window === "undefined") return false
        const video = document.createElement("video")
        return 'remote' in video || 'webkitShowPlaybackTargetPicker' in video
    })
    const [castState, setCastState] = useState<"disconnected" | "connecting" | "connected">("disconnected")

    const prepareForCast = useCallback(() => {
        const video = videoRef.current
        if (!video || isCastingRef.current) return

        isCastingRef.current = true

        // We only save local playback state if it wasn't saved already by promptCast
        if (!castingSavedStateRef.current) {
            const isPlayingLocal = !video.paused
            const timeLocal = video.currentTime
            const isHls = hlsRef.current !== null

            castingSavedStateRef.current = {
                src: video.src,
                currentTime: timeLocal,
                wasPlaying: isPlayingLocal,
                wasHls: isHls
            }

            if (isHls && hlsRef.current) {
                hlsRef.current.detachMedia()
            }
        }

        const timeLocal = castingSavedStateRef.current.currentTime
        const targetUrl = absoluteLanUrlRef.current
        console.log("Preparing Cast: Swapping source to absolute LAN URL:", targetUrl)
        video.src = targetUrl
        video.load()
        video.currentTime = timeLocal
    }, [])

    const restoreLocalPlayback = useCallback(() => {
        const video = videoRef.current
        if (!video || !castingSavedStateRef.current) return

        isCastingRef.current = false
        const saved = castingSavedStateRef.current
        castingSavedStateRef.current = null

        const restoreTime = video.currentTime || saved.currentTime
        console.log("Restoring local playback. Time:", restoreTime)

        if (saved.wasHls && hlsRef.current) {
            video.removeAttribute("src")
            video.load()
            hlsRef.current.attachMedia(video)
            hlsRef.current.loadSource(playableUrlRef.current)

            const handleManifestParsed = () => {
                video.currentTime = restoreTime
                if (saved.wasPlaying) {
                    video.play().catch(e => console.error("Error playing local video:", e))
                }
                hlsRef.current?.off(Hls.Events.MANIFEST_PARSED, handleManifestParsed)
            }
            hlsRef.current.on(Hls.Events.MANIFEST_PARSED, handleManifestParsed)
        } else {
            video.src = saved.src
            video.load()
            video.currentTime = restoreTime
            if (saved.wasPlaying) {
                video.play().catch(e => console.error("Error playing local video:", e))
            }
        }
    }, [])

    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const hasRemote = 'remote' in video && (video as any).remote;
        const hasWebkit = 'webkitShowPlaybackTargetPicker' in video;

        if (hasRemote) {
            setIsCastSupported(true)
            const remote = (video as any).remote

            const handleStateChange = () => {
                const state = remote.state
                setCastState(state)
                console.log("RemotePlayback state changed to:", state)

                if (state === "connecting" || state === "connected") {
                    prepareForCast()
                } else if (state === "disconnected") {
                    restoreLocalPlayback()
                }
            }

            handleStateChange()
            remote.addEventListener('connect', handleStateChange)
            remote.addEventListener('connecting', handleStateChange)
            remote.addEventListener('disconnect', handleStateChange)

            return () => {
                remote.removeEventListener('connect', handleStateChange)
                remote.removeEventListener('connecting', handleStateChange)
                remote.removeEventListener('disconnect', handleStateChange)
            }
        } else if (hasWebkit) {
            setIsCastSupported(true)

            const handleAvailability = (event: any) => {
                setIsCastSupported(event.availability === 'available')
            }

            const handleWebkitTargetChange = () => {
                const isWireless = (video as any).webkitCurrentPlaybackTargetIsWireless
                setCastState(isWireless ? "connected" : "disconnected")
                console.log("WebKit wireless target changed, isWireless:", isWireless)

                if (isWireless) {
                    prepareForCast()
                } else {
                    restoreLocalPlayback()
                }
            }

            video.addEventListener('webkitplaybacktargetavailabilitychanged', handleAvailability)
            video.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleWebkitTargetChange)
            return () => {
                video.removeEventListener('webkitplaybacktargetavailabilitychanged', handleAvailability)
                video.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleWebkitTargetChange)
            }
        }
    }, [status, prepareForCast, restoreLocalPlayback])

    const triggerToast = useCallback((type: "intro" | "outro") => {
        setShowAutoSkipToast(type)
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        toastTimerRef.current = setTimeout(() => setShowAutoSkipToast(null), 3000)
    }, [])

    const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
    const [activeAudioIndex, setActiveAudioIndex] = useState(0)
    const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])
    const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number | null>(null)
    const [isJassubLoading, setIsJassubLoading] = useState(false)
    const [isJassubActive, setIsJassubActive] = useState(false)
    const [hlsLevels, setHlsLevels] = useState<{ index: number; label: string; height: number }[]>([])
    const [activeHlsLevel, setActiveHlsLevel] = useState<number>(-1) // -1 = auto

    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    const setGlobalFullscreen = useAppStore(state => state.setFullscreen)
    const autoSkipIntroPref = useAppStore(state => state.autoSkipIntro)
    const setAutoSkipIntro = useAppStore(state => state.setAutoSkipIntro)
    const autoSkipOutroPref = useAppStore(state => state.autoSkipOutro)
    const setAutoSkipOutro = useAppStore(state => state.setAutoSkipOutro)
    const playbackRatePref = useAppStore(state => state.playbackRate)
    const setPlaybackRatePref = useAppStore(state => state.setPlaybackRate)
    const preferredAudioLang = useAppStore(state => state.preferredAudioLang)
    const setPreferredAudioLang = useAppStore(state => state.setPreferredAudioLang)
    const preferredSubtitleLang = useAppStore(state => state.preferredSubtitleLang)
    const setPreferredSubtitleLang = useAppStore(state => state.setPreferredSubtitleLang)
    const showHeatmapPref = useAppStore(state => state.showHeatmap)
    const setShowHeatmapPref = useAppStore(state => state.setShowHeatmap)
    const aspectRatioPref = useAppStore(state => state.aspectRatio)
    const setAspectRatioPref = useAppStore(state => state.setAspectRatio)
    const subtitleSizePref = useAppStore(state => state.subtitleSize)
    const setSubtitleSizePref = useAppStore(state => state.setSubtitleSize)
    const loopEnabledPref = useAppStore(state => state.loopEnabled)
    const setLoopEnabledPref = useAppStore(state => state.setLoopEnabled)
    const autoDisableSubtitlesWhenDubbed = useAppStore(state => state.autoDisableSubtitlesWhenDubbed)
    const marathonMode = useAppStore(state => state.marathonMode)
    const setMarathonMode = useAppStore(state => state.setMarathonMode)
    const tvMode = useAppStore(state => state.tvMode)
    const setTvMode = useAppStore(state => state.setTvMode)
    const ambilightEnabled = useAppStore(state => state.ambilightEnabled)
    const setAmbilightEnabled = useAppStore(state => state.setAmbilightEnabled)

    const [showStats, setShowStats] = useState(false)
    const [statsData, setStatsData] = useState<PlayerStats | null>(null)

    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const nextEpisodeTimerRef = useRef<NodeJS.Timeout | null>(null)
    const hasTriggeredNextEpisodeRef = useRef<boolean>(false)
    const lastReportedTimeRef = useRef(0)

    const wsUrl = useMemo(() => getApiWebSocketUrl(), [])
    const { sendJsonMessage } = useWebSocket(wsUrl)
    const lastSentHeartbeatRef = useRef(0)

    const sendHeartbeat = useCallback((curr: number, dur: number) => {
        if (!mediaId || !episodeNumber) return
        const progress = dur > 0 ? curr / dur : 0
        sendJsonMessage({
            type: "native-player",
            payload: {
                eventType: "playback-heartbeat-progress",
                mediaId,
                episodeNumber,
                currentTime: curr,
                duration: dur,
                progress: Math.round(progress * 10000) / 10000,
            }
        })
    }, [mediaId, episodeNumber, sendJsonMessage])

    const { data: skipTimes } = useAniSkipTimes({
        malId: malId ?? null,
        episodeNumber: episodeNumber ?? null,
        episodeDuration: duration > 0 ? duration : undefined,
        enabled: !!(malId && episodeNumber),
    })

    const chapters = useMemo(() => {
        return backendTracks?.chapters || []
    }, [backendTracks])

    const skipTimesOp = useMemo(() => {
        if (skipTimes?.op) return skipTimes.op
        const opChap = chapters.find(c => c.type === "opening" || c.name.toLowerCase().includes("op") || c.name.toLowerCase().includes("opening"))
        if (opChap) {
            return { startTime: opChap.startTime, endTime: opChap.endTime }
        }
        return undefined
    }, [skipTimes, chapters])

    const skipTimesEd = useMemo(() => {
        if (skipTimes?.ed) return skipTimes.ed
        const edChap = chapters.find(c => c.type === "ending" || c.name.toLowerCase().includes("ed") || c.name.toLowerCase().includes("ending") || c.name.toLowerCase().includes("outro"))
        if (edChap) {
            return { startTime: edChap.startTime, endTime: edChap.endTime }
        }
        return undefined
    }, [skipTimes, chapters])

    const { mutate: shutdownTranscode } = useMediastreamShutdownTranscodeStream()

    const { onProgress: onTrackingProgress, reset: resetTracking } = useAnimeTracking({
        mediaId,
        episodeNumber,
        filepath: playableUrl,
        enabled: !!(mediaId && episodeNumber),
    })

    const { onProgress: onSyncProgress } = usePlayerProgressSync({
        mediaId,
        episodeNumber,
        filepath: playableUrl,
        enabled: !!(mediaId && episodeNumber),
    })

    const { data: historyData } = useGetContinuityWatchHistoryItem(mediaId || 0)
    const [showResume, setShowResume] = useState(false)
    const [resumeTime, setResumeTime] = useState(0)

    useEffect(() => {
        return () => {
            if (clientId) {
                shutdownTranscode({ clientId })
            }
        }
    }, [clientId, shutdownTranscode])

    useEffect(() => {
        resetTracking()
    }, [mediaId, episodeNumber, playableUrl, resetTracking])

    const formatTime = (secs: number) => {
        if (!secs || isNaN(secs)) return "00:00"
        const m = Math.floor(secs / 60)
        const s = Math.floor(secs % 60)
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    // HLS and Native video stream management hook
    usePlayerHls({
        videoRef,
        hlsRef,
        playableUrl,
        absoluteLanUrl,
        isCastingRef,
        backendTracks: backendTracks || null,
        initialProgressSeconds,
        episodeNumber,
        historyData,
        setStatus,
        setIsBuffering,
        setErrorMsg,
        setHlsLevels,
        setAudioTracks,
        setSubtitleTracks,
        setActiveAudioIndex,
        setResumeTime,
        setShowResume,
        setIsPlaying,
    })

    // JASSUB Subtitle renderer hook
    usePlayerJassub({
        videoRef,
        canvasRef,
        jassubRef,
        activeSubtitleIndex,
        subtitleTracks,
        subtitleSizePref,
        setIsJassubLoading,
        setIsJassubActive,
    })

    // Auto-select preferred tracks
    const onSelectAudio = useCallback((track: AudioTrack) => {
        if (hlsRef.current) {
            hlsRef.current.audioTrack = track.index
            setActiveAudioIndex(track.index)
        }
        if (track.language) {
            setPreferredAudioLang(track.language)
        }
    }, [setPreferredAudioLang])

    const onSelectSubtitle = useCallback((track: SubtitleTrack | null) => {
        if (track === null) {
            setActiveSubtitleIndex(null)
            if (hlsRef.current) {
                hlsRef.current.subtitleTrack = -1
            }
        } else {
            if (hlsRef.current) {
                hlsRef.current.subtitleTrack = track.index
            }
            setActiveSubtitleIndex(track.index)
            if (track.language) {
                setPreferredSubtitleLang(track.language)
            }
        }
    }, [setPreferredSubtitleLang])

    useEffect(() => {
        if (audioTracks.length > 0) {
            const preferred = audioTracks.find(t => t.language === preferredAudioLang)
            if (preferred && activeAudioIndex !== preferred.index) {
                setTimeout(() => onSelectAudio(preferred), 0)
            }
        }
    }, [audioTracks, preferredAudioLang, activeAudioIndex, onSelectAudio])

    useEffect(() => {
        if (subtitleTracks.length > 0) {
            const currentAudio = audioTracks.find(t => t.index === activeAudioIndex)
            const isDubbed = currentAudio && ["spa", "spa-lat", "es", "eng"].includes(currentAudio.language)

            if (autoDisableSubtitlesWhenDubbed && isDubbed) {
                if (activeSubtitleIndex !== null) {
                    setTimeout(() => onSelectSubtitle(null), 0)
                }
            } else {
                const preferred = subtitleTracks.find(t => t.language === preferredSubtitleLang)
                if (preferred && activeSubtitleIndex !== preferred.index) {
                    setTimeout(() => onSelectSubtitle(preferred), 0)
                }
            }
        }
    }, [subtitleTracks, audioTracks, activeAudioIndex, preferredSubtitleLang, autoDisableSubtitlesWhenDubbed, activeSubtitleIndex, onSelectSubtitle])

    const triggerControlsVisibility = useCallback(() => {
        setControlsVisible(true)
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current)
        }
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) {
                setControlsVisible(false)
            }
        }, 3000)
    }, [isPlaying])

    useEffect(() => {
        Promise.resolve().then(() => {
            triggerControlsVisibility()
        })
        return () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
        }
    }, [triggerControlsVisibility])

    const togglePlay = useCallback(() => {
        const video = videoRef.current
        if (!video || status !== "ready") return

        if (video.paused) {
            video.play()
                .then(() => {
                    setIsPlaying(true)
                    setFlash("play")
                    setTimeout(() => setFlash(null), 400)
                })
                .catch((e) => console.error("Playback failed:", e))
        } else {
            video.pause()
            setIsPlaying(false)
            setFlash("pause")
            setTimeout(() => setFlash(null), 400)
        }
    }, [status])

    const checkManualSkipOverrides = useCallback((target: number) => {
        const video = videoRef.current
        if (!video) return
        const total = video.duration
        const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"

        // Check intro override
        if (skipTimesOp) {
            if (target >= skipTimesOp.startTime && target < skipTimesOp.endTime) {
                hasAutoSkippedIntroRef.current = true
            }
        } else if (isTvSeries) {
            // Decoupled fallback intro window is [0, 120]
            if (target >= 0 && target < 120) {
                hasAutoSkippedIntroRef.current = true
            }
        }

        // Check outro override
        if (skipTimesEd) {
            if (target >= skipTimesEd.startTime && target < skipTimesEd.endTime) {
                hasAutoSkippedOutroRef.current = true
            }
        } else if (isTvSeries && total > 300) {
            // Decoupled fallback outro window is [total - 120, total - 5]
            if (target >= total - 120 && target < total - 5) {
                hasAutoSkippedOutroRef.current = true
            }
        }
    }, [skipTimesOp, skipTimesEd, mediaFormat])

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current
        if (!video) return
        const val = parseFloat(e.target.value)

        checkManualSkipOverrides(val)

        video.currentTime = val
        triggerControlsVisibility()
    }

    const handleResume = () => {
        const video = videoRef.current
        if (!video) return
        video.currentTime = resumeTime
        setShowResume(false)
        video.play()
    }

    const skipTime = useCallback((amount: number) => {
        const video = videoRef.current
        if (!video) return
        const target = Math.max(0, Math.min(video.duration, video.currentTime + amount))

        checkManualSkipOverrides(target)

        video.currentTime = target
        triggerControlsVisibility()
    }, [checkManualSkipOverrides, triggerControlsVisibility])

    const skipOpening = useCallback(() => {
        const video = videoRef.current
        if (!video) return
        video.currentTime = Math.min(video.duration, video.currentTime + 85)
        triggerControlsVisibility()
    }, [triggerControlsVisibility])

    const skipToNextChapter = useCallback(() => {
        const video = videoRef.current
        if (!video || chapters.length === 0) return
        const curr = video.currentTime
        const next = chapters.find(c => c.startTime > curr + 0.5)
        if (next) {
            const target = next.startTime
            checkManualSkipOverrides(target)
            video.currentTime = target
            triggerControlsVisibility()
        }
    }, [chapters, checkManualSkipOverrides, triggerControlsVisibility])

    const skipToPrevChapter = useCallback(() => {
        const video = videoRef.current
        if (!video || chapters.length === 0) return
        const curr = video.currentTime
        const prevs = chapters.filter(c => c.startTime < curr - 1.5)
        let target = 0
        if (prevs.length > 0) {
            const prev = prevs[prevs.length - 1]
            target = prev.startTime
        } else {
            target = 0
        }
        checkManualSkipOverrides(target)
        video.currentTime = target
        triggerControlsVisibility()
    }, [chapters, checkManualSkipOverrides, triggerControlsVisibility])

    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current
        if (!video) return
        const val = parseFloat(e.target.value)
        video.volume = val
        setVolume(val)
        setIsMuted(val === 0)
        video.muted = val === 0
    }

    const toggleMute = useCallback(() => {
        const video = videoRef.current
        if (!video) return
        const nextMute = !isMuted
        video.muted = nextMute
        setIsMuted(nextMute)
    }, [isMuted])

    const toggleFullscreen = () => {
        const container = containerRef.current
        if (!container) return

        if (!document.fullscreenElement) {
            container.requestFullscreen()
                .then(() => setIsFullscreen(true))
                .catch((err) => console.error("Error entering fullscreen:", err))
        } else {
            document.exitFullscreen()
                .then(() => setIsFullscreen(false))
        }
    }

    const takeScreenshot = useCallback(() => {
        const video = videoRef.current
        if (!video) return
        const canvas = document.createElement("canvas")
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL("image/png")
        const link = document.createElement("a")
        link.download = `kamehouse-cap-${mediaId || "video"}-${Date.now()}.png`
        link.href = dataUrl
        link.click()
    }, [mediaId])

    const togglePip = useCallback(async () => {
        const video = videoRef.current
        if (!video || !document.pictureInPictureEnabled) return
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture()
            } else {
                await video.requestPictureInPicture()
            }
        } catch (err) {
            console.error("PIP failed:", err)
        }
    }, [])

    const changePlaybackRate = (rate: number) => {
        const video = videoRef.current
        if (!video) return
        video.playbackRate = rate
        setPlaybackRatePref(rate)
    }

    const handleSetAutoSkipIntro = useCallback((val: boolean) => {
        setAutoSkipIntro(val)
        const video = videoRef.current
        if (video && val) {
            const curr = video.currentTime
            const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"
            
            // OP / Intro skip
            if (skipTimesOp) {
                const { startTime, endTime } = skipTimesOp
                if (curr >= startTime && curr < endTime) {
                    video.currentTime = endTime
                    setSkipMode(null)
                    return
                }
            } else if (isTvSeries) {
                // Fallback intro skip
                const introTarget = curr < 30 ? 90 : 120
                if (curr >= 0 && curr < introTarget) {
                    video.currentTime = introTarget
                    setSkipMode(null)
                    return
                }
            }
        }
    }, [setAutoSkipIntro, skipTimesOp, mediaFormat])

    const handleSetAutoSkipOutro = useCallback((val: boolean) => {
        setAutoSkipOutro(val)
        const video = videoRef.current
        if (video && val) {
            const curr = video.currentTime
            const total = video.duration
            const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"

            if (skipTimesEd) {
                const { startTime, endTime } = skipTimesEd
                if (!skipTimesOp || curr >= skipTimesOp.endTime) {
                    if (curr >= startTime && curr < endTime) {
                        video.currentTime = endTime
                        setSkipMode(null)
                        return
                    }
                }
            } else if (isTvSeries && total > 300) {
                // Fallback outro skip
                const outroStart = total - 120
                const outroEnd = total - 5
                const opEndTime = skipTimesOp ? skipTimesOp.endTime : 120
                if (curr >= opEndTime) {
                    if (curr >= outroStart && curr < outroEnd) {
                        video.currentTime = outroEnd
                        setSkipMode(null)
                        return
                    }
                }
            }
        }
    }, [setAutoSkipOutro, skipTimesOp, skipTimesEd, mediaFormat])

    const handleSetMarathonMode = useCallback((val: boolean) => {
        setMarathonMode(val)
        if (val && showNextEpisode && countdownSeconds === 0 && onNextEpisode) {
            onNextEpisode()
        }
    }, [setMarathonMode, showNextEpisode, countdownSeconds, onNextEpisode])

    const handleSetTvMode = useCallback((val: boolean) => {
        setTvMode(val)
        if (val) {
            setAutoSkipIntro(true)
            setAutoSkipOutro(true)
            setMarathonMode(true)
        }
    }, [setTvMode, setAutoSkipIntro, setAutoSkipOutro, setMarathonMode])

    useEffect(() => {
        const video = videoRef.current
        if (video) {
            video.loop = loopEnabledPref
        }
    }, [loopEnabledPref, status])

    useEffect(() => {
        const video = videoRef.current
        if (video && playbackRatePref !== 1) {
            video.playbackRate = playbackRatePref
        }
    }, [status, playbackRatePref]) // Reset/Apply rate when video is ready

    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFs = Boolean(document.fullscreenElement)
            setIsFullscreen(isFs)
            setGlobalFullscreen(isFs)
        }
        document.addEventListener("fullscreenchange", handleFullscreenChange)
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange)
            setGlobalFullscreen(false)
        }
    }, [setGlobalFullscreen])

    const handleSkipIntro = useCallback(() => {
        const video = videoRef.current
        if (!video) return
        const curr = video.currentTime
        const total = video.duration
        const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"

        // Resolve active mode based on current skipMode overlay status
        const activeMode = skipMode || (curr < 120 ? "intro" : "outro")

        if (activeMode === "intro") {
            if (skipTimesOp && curr >= skipTimesOp.startTime && curr < skipTimesOp.endTime) {
                video.currentTime = skipTimesOp.endTime
            } else if (isTvSeries) {
                video.currentTime = 120
            }
        } else if (activeMode === "outro") {
            if (skipTimesEd && curr >= skipTimesEd.startTime && curr < skipTimesEd.endTime) {
                video.currentTime = skipTimesEd.endTime
            } else if (isTvSeries && total > 300) {
                video.currentTime = total - 5
            }
        }
        setSkipMode(null)
    }, [skipMode, skipTimesOp, skipTimesEd, mediaFormat])

    // Keyboard shortcuts hook
    usePlayerShortcuts({
        videoRef,
        isPlaying,
        isMuted,
        volume,
        isFullscreen,
        skipMode,
        showNextEpisode,
        onNextEpisode,
        handleSkipIntro,
        onClose,
        skipOpening,
        skipTime,
        takeScreenshot,
        toggleMute,
        togglePip,
        togglePlay,
        toggleFullscreen,
        setVolume,
        setIsMuted,
        setIsSettingsOpen,
        setShowStats,
        skipToNextChapter,
        skipToPrevChapter,
    })

    const handleTimeUpdate = useCallback(() => {
        const video = videoRef.current
        if (!video) return
        
        const curr = video.currentTime
        const total = video.duration
        

        if (chapters.length > 0) {
            const current = chapters.find(c => curr >= c.startTime && curr < c.endTime)
            const name = current ? current.name : null
            if (activeChapter !== name) {
                setActiveChapter(name)
            }
        }

        if (progressBarRef.current) {
            const percent = total > 0 ? (curr / total) * 100 : 0
            progressBarRef.current.style.width = `${percent}%`
        }

        if (progressInputRef.current) {
            progressInputRef.current.value = String(curr)
        }

        if (timeTextRef.current) {
            timeTextRef.current.innerText = formatTime(curr)
        }

        if (onProgress && Math.abs(curr - lastReportedTimeRef.current) >= 10) {
            onProgress(curr)
            lastReportedTimeRef.current = curr
        }

        onTrackingProgress(curr, total)
        onSyncProgress(curr, total)

        const now = Date.now()
        if (now - lastSentHeartbeatRef.current >= 5000) {
            sendHeartbeat(curr, total)
            lastSentHeartbeatRef.current = now
        }

        // Reset the auto-skip flags when outside the respective windows
        if (skipTimesOp) {
            if (curr < skipTimesOp.startTime || curr >= skipTimesOp.endTime) {
                hasAutoSkippedIntroRef.current = false
            }
        } else {
            const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"
            if (isTvSeries) {
                if (curr < 0 || curr >= 120) {
                    hasAutoSkippedIntroRef.current = false
                }
            }
        }

        if (skipTimesEd) {
            if (curr < skipTimesEd.startTime || curr >= skipTimesEd.endTime) {
                hasAutoSkippedOutroRef.current = false
            }
        } else {
            const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"
            if (isTvSeries && total > 300) {
                if (curr < total - 120 || curr >= total - 5) {
                    hasAutoSkippedOutroRef.current = false
                }
            }
        }

        const isTvSeries = !mediaFormat || mediaFormat === "TV" || mediaFormat === "TV_SHORT"

        // ─── OP / Intro window ────────────────────────────────────────────
        let activeOp = skipTimesOp
        if (!activeOp && isTvSeries) {
            // Adaptive fallback intro
            activeOp = { startTime: 0, endTime: 120 }
        }

        if (activeOp) {
            const { startTime, endTime } = activeOp
            const inOpWindow = curr >= startTime && curr < endTime
            if (autoSkipIntroPref && inOpWindow && !hasAutoSkippedIntroRef.current) {
                hasAutoSkippedIntroRef.current = true
                video.currentTime = endTime
                setSkipMode(null)
                triggerToast("intro")
                return
            }
            if (inOpWindow) {
                const remaining = Math.ceil(endTime - curr)
                const progress = Math.round(((curr - startTime) / (endTime - startTime)) * 100)
                if (skipMode !== "intro") setSkipMode("intro")
                if (skipRemainingSeconds !== remaining) setSkipRemainingSeconds(remaining)
                if (segmentProgress !== progress) setSegmentProgress(progress)
            } else if (skipMode === "intro") {
                setSkipMode(null)
            }
        }

        // ─── ED / Outro window ────────────────────────────────────────────
        let activeEd = skipTimesEd
        if (!activeEd && isTvSeries && total > 300) {
            // Fallback outro: last 120 seconds, ending 5 seconds before absolute end
            activeEd = { startTime: total - 120, endTime: total - 5 }
        }

        if (activeEd) {
            const { startTime, endTime } = activeEd
            const inEdWindow = curr >= startTime && curr < endTime
            if (autoSkipOutroPref && inEdWindow && !hasAutoSkippedOutroRef.current) {
                hasAutoSkippedOutroRef.current = true
                video.currentTime = endTime
                setSkipMode(null)
                triggerToast("outro")
                return
            }
            // Only show outro UI if we are past the intro
            const opEnd = activeOp ? activeOp.endTime : 120
            if (curr >= opEnd) {
                if (inEdWindow) {
                    const remaining = Math.ceil(endTime - curr)
                    const progress = Math.round(((curr - startTime) / (endTime - startTime)) * 100)
                    if (skipMode !== "outro") setSkipMode("outro")
                    if (skipRemainingSeconds !== remaining) setSkipRemainingSeconds(remaining)
                    if (segmentProgress !== progress) setSegmentProgress(progress)
                } else if (skipMode === "outro") {
                    setSkipMode(null)
                }
            }
        }

        // ─── Next episode trigger ─────────────────────────────────────────
        const ed = skipTimesEd
        const edTriggered = ed ? curr >= ed.startTime : false

        const shouldShowNext =
            (total > 0 && total - curr <= 30) ||
            (edTriggered && hasNextEpisode)

        if (shouldShowNext && hasNextEpisode) {
            if (!showNextEpisode) {
                setShowNextEpisode(true)
                setCountdownSeconds(10)
            }
        } else {
            if (showNextEpisode) setShowNextEpisode(false)
        }

        // Stats for Nerds calculation
        if (showStats && now - lastSentHeartbeatRef.current >= 1000) {
            setStatsData({
                currentTime: curr.toFixed(2),
                duration: total.toFixed(2),
                buffer: video.buffered.length > 0 ? (video.buffered.end(video.buffered.length - 1) - curr).toFixed(2) : "0.00",
                resolution: `${video.videoWidth}x${video.videoHeight}`,
                playbackRate: video.playbackRate.toString(),
                volume: Math.round(video.volume * 100).toString(),
                source: playableUrl.substring(0, 50) + "...",
            })
        }
    }, [showStats, lastSentHeartbeatRef, skipTimesOp, skipTimesEd, autoSkipIntroPref, autoSkipOutroPref, skipMode, skipRemainingSeconds, segmentProgress, showNextEpisode, hasNextEpisode, onNextEpisode, onProgress, onTrackingProgress, onSyncProgress, playableUrl, sendHeartbeat, mediaFormat, chapters, activeChapter, triggerToast])

    // Apply playback rate instantly
    useEffect(() => {
        const video = videoRef.current
        if (video && video.playbackRate !== playbackRatePref) {
            video.playbackRate = playbackRatePref
        }
    }, [playbackRatePref])



    // Force skip check when preferences change
    useEffect(() => {
        handleTimeUpdate()
    }, [autoSkipIntroPref, autoSkipOutroPref, handleTimeUpdate])

    // Reset the navigation guard ref when next episode prompt toggles off or episode changes
    useEffect(() => {
        if (!showNextEpisode) {
            hasTriggeredNextEpisodeRef.current = false
        }
    }, [showNextEpisode])

    useEffect(() => {
        if (showNextEpisode && countdownSeconds > 0 && isPlaying) {
            if (tvMode && onNextEpisode) {
                if (!hasTriggeredNextEpisodeRef.current) {
                    hasTriggeredNextEpisodeRef.current = true
                    onNextEpisode()
                }
            } else {
                nextEpisodeTimerRef.current = setTimeout(() => {
                    setCountdownSeconds((c) => c - 1)
                }, 1000)
            }
        } else if (showNextEpisode && countdownSeconds === 0 && marathonMode && onNextEpisode) {
            if (!hasTriggeredNextEpisodeRef.current) {
                hasTriggeredNextEpisodeRef.current = true
                onNextEpisode()
            }
        }

        return () => {
            if (nextEpisodeTimerRef.current) clearTimeout(nextEpisodeTimerRef.current)
        }
    }, [showNextEpisode, countdownSeconds, isPlaying, marathonMode, tvMode, onNextEpisode])

    const remainingProgress = useMemo(() => {
        return (countdownSeconds / 10) * 100
    }, [countdownSeconds])

    const handleSetHlsLevel = useCallback((levelIndex: number) => {
        if (hlsRef.current) {
            hlsRef.current.currentLevel = levelIndex
            setActiveHlsLevel(levelIndex)
        }
    }, [])

    const promptCast = useCallback(async () => {
        const video = videoRef.current
        if (!video) return

        const hasRemote = 'remote' in video && (video as any).remote;
        const hasWebkit = 'webkitShowPlaybackTargetPicker' in video;

        if (hasRemote) {
            const remote = (video as any).remote
            console.log("promptCast: Invoking remote.prompt() directly")
            try {
                await remote.prompt()
            } catch (err) {
                console.warn("User cancelled cast or prompt failed:", err)
            }
        } else if (hasWebkit) {
            console.log("promptCast: Invoking webkitShowPlaybackTargetPicker() directly")
            try {
                (video as any).webkitShowPlaybackTargetPicker()
            } catch (err) {
                console.error("Webkit casting error:", err)
            }
        } else {
            console.warn("Casting not supported in this browser.")
        }
    }, [])

    return {
        domElements: {
            videoElement: videoRef,
            containerElement: containerRef,
            canvasElement: canvasRef,
            progressBarElement: progressBarRef,
            progressInputElement: progressInputRef,
            timeTextElement: timeTextRef,
        },
        state: {
            isPlaying, duration, volume, isMuted, isFullscreen, controlsVisible, status, errorMsg, isBuffering, flash, skipMode, skipRemainingSeconds, segmentProgress, showNextEpisode, countdownSeconds, marathonMode, tvMode, audioTracks, activeAudioIndex, subtitleTracks, activeSubtitleIndex, isJassubLoading, isJassubActive, isSettingsOpen, remainingProgress, showAutoSkipToast,
            autoSkipIntro: autoSkipIntroPref,
            autoSkipOutro: autoSkipOutroPref,
            playbackRate: playbackRatePref,
            showHeatmap: showHeatmapPref,
            aspectRatio: aspectRatioPref,
            subtitleSize: subtitleSizePref,
            loopEnabled: loopEnabledPref,
            ambilightEnabled,
            showStats,
            statsData,
            hlsLevels,
            activeHlsLevel,
            get currentTime() {
                return videoRef.current?.currentTime || 0
            },
            showResume,
            resumeTime,
            autoDisableSubtitlesWhenDubbed,
            skipTimesOp,
            skipTimesEd,
            chapters,
            activeChapter,
            isCastSupported,
            castState,
            serverIPs,
            serverPort,
        },
        actions: {
            setIsPlaying, setDuration, setIsBuffering, setControlsVisible, setIsSettingsOpen, triggerControlsVisibility, togglePlay, handleSeek, skipTime, skipOpening, handleVolume, toggleMute, onSelectAudio, onSelectSubtitle, toggleFullscreen, handleSkipIntro, handleTimeUpdate,
            takeScreenshot, togglePip, changePlaybackRate, setShowStats,
            setAutoSkipIntro: handleSetAutoSkipIntro,
            setAutoSkipOutro: handleSetAutoSkipOutro,
            setHlsLevel: handleSetHlsLevel,
            setShowHeatmap: setShowHeatmapPref,
            setAspectRatio: setAspectRatioPref,
            setSubtitleSize: setSubtitleSizePref,
            setLoopEnabled: setLoopEnabledPref,
            setAmbilightEnabled,
            setMarathonMode: handleSetMarathonMode,
            setTvMode: handleSetTvMode,
            handleResume,
            setShowResume,
            setAutoDisableSubtitlesWhenDubbed: (val: boolean) => { useAppStore.setState(s => ({ ...s, autoDisableSubtitlesWhenDubbed: val })) },
            skipToNextChapter,
            skipToPrevChapter,
            promptCast,
        }
    }
}
