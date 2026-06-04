import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import Hls from "hls.js"
import JASSUB from "jassub"
import { usePlayerShortcuts } from "./usePlayerShortcuts"
import { usePlayerJassub } from "./usePlayerJassub"
import { usePlayerHls } from "./usePlayerHls"
import { useAnimeTracking } from "@/api/hooks/useAnimeTracking"
import { useWebSocket } from "@/hooks/use-websocket"
import { getApiWebSocketUrl } from "@/api/client/server-url"
import { useMediastreamShutdownTranscodeStream } from "@/api/hooks/mediastream.hooks"
import { useAppStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { usePlayerProgressSync } from "@/api/hooks/usePlayerProgressSync"
import { useGetContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"
import { useGetStatus } from "@/api/hooks/settings.hooks"
import type { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"
import type { PlayerCoreProps, PlayerCore, PlayerStats } from "./player-core.types"
import { usePlayerCast } from "./usePlayerCast"
import { usePlayerSkip } from "./usePlayerSkip"
import { __DEV_SERVER_PORT } from "@/lib/server/config"
import { buildSeaQuery } from "@/api/client/requests"


export type { PlayerStats, PlayerCoreProps, PlayerCore }

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
    const port = serverPort || __DEV_SERVER_PORT

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
        title,
    } = props

    const { data: statusQuery } = useGetStatus()
    const serverIPs = statusQuery?.serverIPs
    const serverPort = statusQuery?.serverPort

    const absoluteLanUrl = useMemo(() => {
        return getAbsoluteLanUrl(playableUrl, serverIPs, serverPort)
    }, [playableUrl, serverIPs, serverPort])

    useEffect(() => {
        if (!playableUrl) return

        const localServerUrl = (() => {
            if (serverIPs && serverIPs.length > 0) {
                const lanIp = serverIPs.find(ip =>
                    ip.startsWith("192.168.") ||
                    ip.startsWith("10.") ||
                    ip.startsWith("172.")
                ) || serverIPs[0]
                const port = serverPort || __DEV_SERVER_PORT
                return `http://${lanIp}:${port}`
            }
            return typeof window !== "undefined" ? window.location.origin : `http://localhost:${__DEV_SERVER_PORT}`
        })()
        const castUrl = `${localServerUrl}/api/v1/cast/player?url=${encodeURIComponent(absoluteLanUrl)}&title=${encodeURIComponent(title || "KameHouse")}`

        buildSeaQuery({
            endpoint: "/api/v1/cast/samsung/launch",
            method: "POST",
            data: {
                ip: "",
                url: castUrl,
            }
        }).catch(err => console.error("Error registering manual cast URL:", err))
    }, [playableUrl, absoluteLanUrl, serverIPs, serverPort, title])

    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const hlsRef = useRef<Hls | null>(null)
    const jassubRef = useRef<JASSUB | null>(null)

    const progressBarRef = useRef<HTMLDivElement>(null)
    const progressInputRef = useRef<HTMLInputElement>(null)
    const timeTextRef = useRef<HTMLSpanElement>(null)

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

    const {
        isCastSupported,
        castState,
        isCastingRef,
        promptCast
    } = usePlayerCast({
        videoRef,
        hlsRef,
        absoluteLanUrl,
        playableUrl,
        status
    })

    const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
    const [activeAudioIndex, setActiveAudioIndex] = useState(0)
    const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])
    const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number | null>(null)
    const [isJassubLoading, setIsJassubLoading] = useState(false)
    const [isJassubActive, setIsJassubActive] = useState(false)
    const [hlsLevels, setHlsLevels] = useState<{ index: number; label: string; height: number }[]>([])
    const [activeHlsLevel, setActiveHlsLevel] = useState<number>(-1) // -1 = auto

    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    const {
        setFullscreen: setGlobalFullscreen,
        autoSkipIntro: autoSkipIntroPref,
        setAutoSkipIntro,
        autoSkipOutro: autoSkipOutroPref,
        setAutoSkipOutro,
        playbackRate: playbackRatePref,
        setPlaybackRate: setPlaybackRatePref,
        preferredAudioLang,
        setPreferredAudioLang,
        preferredSubtitleLang,
        setPreferredSubtitleLang,
        showHeatmap: showHeatmapPref,
        setShowHeatmap: setShowHeatmapPref,
        aspectRatio: aspectRatioPref,
        setAspectRatio: setAspectRatioPref,
        subtitleSize: subtitleSizePref,
        setSubtitleSize: setSubtitleSizePref,
        loopEnabled: loopEnabledPref,
        setLoopEnabled: setLoopEnabledPref,
        autoDisableSubtitlesWhenDubbed,
        tvMode,
        setTvMode,
        ambilightEnabled,
        setAmbilightEnabled,
    } = useAppStore(
        useShallow(state => ({
            setFullscreen: state.setFullscreen,
            autoSkipIntro: state.autoSkipIntro,
            setAutoSkipIntro: state.setAutoSkipIntro,
            autoSkipOutro: state.autoSkipOutro,
            setAutoSkipOutro: state.setAutoSkipOutro,
            playbackRate: state.playbackRate,
            setPlaybackRate: state.setPlaybackRate,
            preferredAudioLang: state.preferredAudioLang,
            setPreferredAudioLang: state.setPreferredAudioLang,
            preferredSubtitleLang: state.preferredSubtitleLang,
            setPreferredSubtitleLang: state.setPreferredSubtitleLang,
            showHeatmap: state.showHeatmap,
            setShowHeatmap: state.setShowHeatmap,
            aspectRatio: state.aspectRatio,
            setAspectRatio: state.setAspectRatio,
            subtitleSize: state.subtitleSize,
            setSubtitleSize: state.setSubtitleSize,
            loopEnabled: state.loopEnabled,
            setLoopEnabled: state.setLoopEnabled,
            autoDisableSubtitlesWhenDubbed: state.autoDisableSubtitlesWhenDubbed,
            tvMode: state.tvMode,
            setTvMode: state.setTvMode,
            ambilightEnabled: state.ambilightEnabled,
            setAmbilightEnabled: state.setAmbilightEnabled,
        }))
    )

    const [showStats, setShowStats] = useState(false)
    const [statsData, setStatsData] = useState<PlayerStats | null>(null)

    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
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

    const chapters = useMemo(() => {
        return backendTracks?.chapters || []
    }, [backendTracks])

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

    const {
        skipTimesOp,
        skipTimesEd,
        skipMode,
        skipRemainingSeconds,
        segmentProgress,
        showNextEpisode,
        countdownSeconds,
        showAutoSkipToast,
        activeChapter,
        remainingProgress,
        skipOpening,
        skipToNextChapter,
        skipToPrevChapter,
        handleSetAutoSkipIntro,
        handleSetAutoSkipOutro,
        handleSetTvMode,
        handleSkipIntro,
        showCountdown,
        processTimeUpdates,
        checkManualSkipOverrides
    } = usePlayerSkip({
        videoRef,
        playableUrl,
        duration,
        isPlaying,
        malId,
        episodeNumber,
        chapters,
        mediaFormat,
        autoSkipIntroPref,
        autoSkipOutroPref,
        tvMode,
        hasNextEpisode,
        onNextEpisode,
        setAutoSkipIntro,
        setAutoSkipOutro,
        setTvMode,
        triggerControlsVisibility
    })

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

    const formatTime = useCallback((secs: number) => {
        if (!secs || isNaN(secs)) return "00:00"
        const m = Math.floor(secs / 60)
        const s = Math.floor(secs % 60)
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }, [])

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
    }, [status, playbackRatePref])

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

        processTimeUpdates(curr, total)

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
    }, [showStats, lastSentHeartbeatRef, processTimeUpdates, onProgress, onTrackingProgress, onSyncProgress, playableUrl, sendHeartbeat, formatTime])

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

    const handleSetHlsLevel = useCallback((levelIndex: number) => {
        if (hlsRef.current) {
            hlsRef.current.currentLevel = levelIndex
            setActiveHlsLevel(levelIndex)
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
            isPlaying, duration, volume, isMuted, isFullscreen, controlsVisible, status, errorMsg, isBuffering, flash, skipMode, skipRemainingSeconds, segmentProgress, showNextEpisode, countdownSeconds, showCountdown, tvMode, audioTracks, activeAudioIndex, subtitleTracks, activeSubtitleIndex, isJassubLoading, isJassubActive, isSettingsOpen, remainingProgress, showAutoSkipToast,
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
            absoluteLanUrl,
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
