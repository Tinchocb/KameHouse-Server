import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react"
import Hls from "hls.js"
import type JASSUB from "jassub"
import { usePlayerShortcuts } from "./usePlayerShortcuts"
import { usePlayerJassub } from "./usePlayerJassub"
import { useDriveSubtitleWindow } from "./useDriveSubtitleWindow"
import { usePlayerPgs } from "./usePlayerPgs"
import { usePlayerMediaSession } from "./usePlayerMediaSession"
import { PlayerPreviewManager } from "./player-preview"
import { usePlayerHls } from "./usePlayerHls"
import { useWebSocket } from "@/hooks/use-websocket"
import { useApiWebSocketUrl } from "@/api/client/use-api-websocket-url"
import { useMediastreamShutdownTranscodeStream, usePreloadMediastreamMediaContainer } from "@/api/hooks/mediastream.hooks"
import { usePlayerStore } from "@/lib/store"
import { persistLibraryPatch } from "@/lib/server/persist-settings"
import { useShallow } from "zustand/react/shallow"
import { useGetStatus } from "@/api/hooks/settings.hooks"
import type { PlayerCoreProps, PlayerCore, PlayerStats } from "./player-core.types"

import { usePlayerSkip } from "./usePlayerSkip"
import { usePlayerVolume } from "./usePlayerVolume"
import { usePlayerTrackSelection } from "./usePlayerTrackSelection"
import { resolveLanUrl } from "./lan-url"
import { usePlayerDuration } from "./usePlayerDuration"
import { usePlayerSeek } from "./usePlayerSeek"
import { usePlayerFullscreen } from "./usePlayerFullscreen"
import { usePlayerBackendSync } from "./usePlayerBackendSync"
import { formatPlaybackTime } from "./format-playback-time"
import { usePlayerStreamSwitch } from "./usePlayerStreamSwitch"
import { usePlayerPlaybackPrefs } from "./usePlayerPlaybackPrefs"
import { usePlayerControlsVisibility } from "./usePlayerControlsVisibility"
import { usePlayerVisibilityPause } from "./usePlayerVisibilityPause"
import { usePlayerHlsLevel } from "./usePlayerHlsLevel"



export type { PlayerStats, PlayerCore }


export function usePlayerCore(props: PlayerCoreProps): PlayerCore {
    const {
        playableUrl,
        streamUrl,
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
        nextStreamUrl,
        nextStreamType,
        streamType,
        onRequestStreamTypeChange,
        onDirectPlayFailed,
        streamRequestError,
        metadataDuration,
        onToggleSubtitle,
    } = props

    const { data: statusQuery } = useGetStatus()
    const serverIPs = statusQuery?.serverIPs
    const serverPort = statusQuery?.serverPort

    const absoluteLanUrl = useMemo(() => {
        return resolveLanUrl(playableUrl, serverIPs, serverPort)
    }, [playableUrl, serverIPs, serverPort])

    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const hlsRef = useRef<Hls | null>(null)
    const jassubRef = useRef<JASSUB | null>(null)
    const streamSwitchResumeRef = useRef<number | null>(null)
    
    const [previewManager, setPreviewManager] = useState<PlayerPreviewManager | null>(null)

    const thumbRef = useRef<HTMLDivElement>(null)
    const progressInputRef = useRef<HTMLInputElement>(null)

    const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    useEffect(() => {
        return () => {
            if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
        }
    }, [])

    const [isPlaying, setIsPlaying] = useState(false)
    // Duración saneada con fallback a ffprobe (ver usePlayerDuration).
    const { duration, setDuration } = usePlayerDuration(metadataDuration)
    // Volumen con persistencia (hook extraído; ver usePlayerVolume).
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
    const { volume, isMuted, setVolume, setIsMuted, handleVolume, toggleMute } = usePlayerVolume({ videoRef, status })
    // Cambios de stream a mitad de reproducción (ver usePlayerStreamSwitch).
    const { isStreamSwitching, streamSwitchReason, setFallbackStreamSwitching, onAudioStreamSwitch, switchSource } = usePlayerStreamSwitch({
        videoRef,
        streamSwitchResumeRef,
        status,
        mediaId,
        episodeNumber,
        streamType,
        onRequestStreamTypeChange,
    })
    const [errorMsg, setErrorMsg] = useState("")
    const [isBuffering, setIsBuffering] = useState(false)
    const [flash, setFlash] = useState<"play" | "pause" | null>(null)
    const [retryNonce, setRetryNonce] = useState(0)

    const retryStream = useCallback(() => {
        setStatus("loading")
        setIsBuffering(true)
        setErrorMsg("")
        setRetryNonce(n => n + 1)
    }, [])

    const [isJassubLoading, setIsJassubLoading] = useState(false)
    const [isJassubActive, setIsJassubActive] = useState(false)
    const [isPgsLoading, setIsPgsLoading] = useState(false)
    const [isPgsActive, setIsPgsActive] = useState(false)
    const { hlsLevels, setHlsLevels, activeHlsLevel, setActiveHlsLevel, setHlsLevel } = usePlayerHlsLevel({ hlsRef })

    // Auto-ocultado de controles y panel de ajustes (ver usePlayerControlsVisibility).
    const { controlsVisible, setControlsVisible, isSettingsOpen, setIsSettingsOpen, triggerControlsVisibility } = usePlayerControlsVisibility({ isPlaying })

    const {
        setFullscreen: setGlobalFullscreen,
        autoSkipIntro: autoSkipIntroPref,
        setAutoSkipIntro,
        autoSkipOutro: autoSkipOutroPref,
        setAutoSkipOutro,
        skipStepSeconds: skipStepSecondsPref,
        setSkipStepSeconds: setSkipStepSecondsPref,
        playbackRate: playbackRatePref,
        setPlaybackRate: setPlaybackRatePref,
        preferredAudioLang,
        preferredSubtitleLang,
        aspectRatio: globalAspectRatioPref,
        setAspectRatio: setGlobalAspectRatioPref,
        aspectRatioBySeries,
        setAspectRatioForSeries,
        subtitleSize: subtitleSizePref,
        setSubtitleSize: setSubtitleSizePref,
        loopEnabled: loopEnabledPref,
        setLoopEnabled: setLoopEnabledPref,
        autoDisableSubtitlesWhenDubbed,
        marathonMode,
        tvMode,
        setTvMode,
    } = usePlayerStore(
        // Note: playerVolume/setPlayerVolume already destructured above (D3).
        useShallow(state => ({
            setFullscreen: state.setFullscreen,
            autoSkipIntro: state.autoSkipIntro,
            setAutoSkipIntro: state.setAutoSkipIntro,
            autoSkipOutro: state.autoSkipOutro,
            setAutoSkipOutro: state.setAutoSkipOutro,
            skipStepSeconds: state.skipStepSeconds,
            setSkipStepSeconds: state.setSkipStepSeconds,
            playbackRate: state.playbackRate,
            setPlaybackRate: state.setPlaybackRate,
            preferredAudioLang: state.preferredAudioLang,
            preferredSubtitleLang: state.preferredSubtitleLang,
            aspectRatio: state.aspectRatio,
            setAspectRatio: state.setAspectRatio,
            aspectRatioBySeries: state.aspectRatioBySeries,
            setAspectRatioForSeries: state.setAspectRatioForSeries,
            subtitleSize: state.subtitleSize,
            setSubtitleSize: state.setSubtitleSize,
            loopEnabled: state.loopEnabled,
            setLoopEnabled: state.setLoopEnabled,
            autoDisableSubtitlesWhenDubbed: state.autoDisableSubtitlesWhenDubbed,
            marathonMode: state.marathonMode,
            setMarathonMode: state.setMarathonMode,
            tvMode: state.tvMode,
            setTvMode: state.setTvMode,
        }))
    )
    
    const { isFullscreen, toggleFullscreen } = usePlayerFullscreen({ containerRef, videoRef, setGlobalFullscreen })

    // Aspect ratio efectivo: el override de esta serie gana; el global es fallback.
    // El setter escribe en el mapa por serie cuando hay mediaId, así el ajuste
    // queda recordado para esta serie sin pisar el de las demás.
    const aspectRatioPref = (mediaId && aspectRatioBySeries[mediaId]) || globalAspectRatioPref
    const setAspectRatioPref = useCallback((ratio: "contain" | "fill" | "cover" | "16/9" | "21/9") => {
        if (mediaId) {
            setAspectRatioForSeries(mediaId, ratio)
        } else {
            setGlobalAspectRatioPref(ratio)
        }
    }, [mediaId, setAspectRatioForSeries, setGlobalAspectRatioPref])

    const {
        audioTracks,
        setAudioTracks,
        activeAudioIndex,
        setActiveAudioIndex,
        subtitleTracks,
        setSubtitleTracks,
        activeSubtitleIndex,
        onSelectAudio,
        onSelectSubtitle,
    } = usePlayerTrackSelection({
        videoRef,
        hlsRef,
        playableUrl,
        mediaId,
        streamType,
        onRequestStreamTypeChange,
        onAudioStreamSwitch,
    })

    const [showStats, setShowStats] = useState(false)
    const [showShortcuts, setShowShortcuts] = useState(false)
    const [statsData, setStatsData] = useState<PlayerStats | null>(null)

    const lastReportedTimeRef = useRef(0)

    const wsUrl = useApiWebSocketUrl()
    const { sendJsonMessage } = useWebSocket(wsUrl)
    const lastStatsUpdateRef = useRef(0)

    const chapters = useMemo(() => {
        return backendTracks?.chapters || []
    }, [backendTracks])

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
        handleSetMarathonMode,
        handleSkipIntro,
        undoSkip,
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
        skipStepSecondsPref,
        tvMode,
        hasNextEpisode,
        onNextEpisode,
        setAutoSkipIntro,
        setAutoSkipOutro,
        setTvMode,
        triggerControlsVisibility,
        clientId,
        nextStreamUrl,
        nextStreamType,
        streamType,
        mediaId,
        preferredAudioLang,
    })

    // Seek con throttle y scrub sin inundar de peticiones (ver usePlayerSeek).
    const { progressBarRef, timeTextRef, isSeeking, setIsSeeking, isSeekingRef, handleSeekStart, handleSeek, handleSeekEnd, skipTime } = usePlayerSeek({
        videoRef,
        checkManualSkipOverrides,
        triggerControlsVisibility,
    })

    const { mutate: shutdownTranscode } = useMediastreamShutdownTranscodeStream()
    const { mutate: preloadMutate } = usePreloadMediastreamMediaContainer()

    // Proactive preload for TRANSCODE only: kicks off keyframe extraction + the
    // first segments in the background so playback starts without waiting on the
    // on-demand encode. The direct-play branch was removed as redundant — the
    // detail pages (series/movies) now warm the container on hover/page-load, and
    // the RequestMediastreamMediaContainer POST already forces ffprobe for the
    // current episode, so a second direct preload here only duplicated work.
    useEffect(() => {
        const path = streamUrl || playableUrl
        if (!path || streamType !== "transcode") return
        try {
            preloadMutate(
                { path, streamType: "transcode", audioStreamIndex: 0, preferredAudioLang },
                { onError: (err) => console.warn("[player-core] preload transcode failed (silencioso):", err) }
            )
        } catch (err) {
            console.warn("[player-core] preloadMutate error:", err)
        }
    }, [streamUrl, playableUrl, streamType, preferredAudioLang, preloadMutate])


    // Heartbeat, tracking y continuidad hacia el servidor (ver usePlayerBackendSync).
    const { flushBackendSync } = usePlayerBackendSync({
        videoRef,
        mediaId,
        episodeNumber,
        filepath: streamUrl || playableUrl,
        resetKey: playableUrl,
        duration,
        sendJsonMessage,
    })

    useEffect(() => {
        return () => {
            if (clientId) {
                shutdownTranscode({ clientId })
            }
        }
    }, [clientId, shutdownTranscode])


    // HLS and Native video stream management hook
    usePlayerHls({
        videoRef,
        hlsRef,
        playableUrl,
        absoluteLanUrl,
        backendTracks: backendTracks || null,
        initialProgressSeconds,
        streamSwitchResumeRef,
        setStatus,
        setIsBuffering,
        setErrorMsg,
        setHlsLevels,
        onMaxLevelLocked: setActiveHlsLevel,
        setAudioTracks,
        setSubtitleTracks,
        setActiveAudioIndex,
        setIsPlaying,
        onDirectPlayFailed,
        setIsStreamSwitching: setFallbackStreamSwitching,
        retryNonce,
        streamRequestError,
    })

    // Subtítulos embebidos de Drive leídos por franjas: informa la posición al servidor y
    // avisa cuando hay subtítulos nuevos para recargar la pista.
    const activeSubtitleTrack = subtitleTracks.find((t) => t.index === activeSubtitleIndex)
    const subtitleRefreshKey = useDriveSubtitleWindow({
        videoRef,
        path: streamUrl,
        active: !!activeSubtitleTrack?.progressive,
    })

    // JASSUB Subtitle renderer hook
    usePlayerJassub({
        videoRef,
        jassubRef,
        activeSubtitleIndex,
        subtitleTracks,
        subtitleSizePref,
        fontUrls: backendTracks?.fontUrls,
        refreshKey: subtitleRefreshKey,
        setIsJassubLoading,
        setIsJassubActive,
    })

    // --- PGS Plugin ---
    usePlayerPgs({
        videoRef,
        subtitleTracks,
        activeSubtitleIndex,
        setIsPgsLoading,
        setIsPgsActive,
    })

    // Preview Manager
    useEffect(() => {
        const video = videoRef.current
        if (!video || !playableUrl) return

        const pm = new PlayerPreviewManager(video, playableUrl as string, (streamType || "direct") as "local" | "online" | "direct" | "transcode" | "optimized")
        setPreviewManager(pm)

        return () => {
            pm.cleanup()
            setPreviewManager(null)
        }
    }, [playableUrl, streamType])

    const togglePlay = useCallback(() => {
        const video = videoRef.current
        if (!video || status !== "ready") return

        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)

        if (video.paused) {
            video.play()
                .then(() => {
                    setIsPlaying(true)
                    setFlash("play")
                    flashTimeoutRef.current = setTimeout(() => setFlash(null), 400)
                })
                .catch((e) => console.error("Playback failed:", e))
        } else {
            video.pause()
            flushBackendSync(true)
            setIsPlaying(false)
            setFlash("pause")
            flashTimeoutRef.current = setTimeout(() => setFlash(null), 400)
        }
    }, [status, flushBackendSync])




    const handleToggleSubtitle = useCallback(() => {
        if (onToggleSubtitle) {
            onToggleSubtitle()
            return
        }
        if (subtitleTracks.length === 0) return
        if (activeSubtitleIndex !== null) {
            onSelectSubtitle(null)
        } else {
            const preferred = (preferredSubtitleLang && subtitleTracks.find(t => t.language?.toLowerCase() === preferredSubtitleLang?.toLowerCase())) || subtitleTracks[0]
            onSelectSubtitle(preferred)
        }
    }, [onToggleSubtitle, subtitleTracks, activeSubtitleIndex, preferredSubtitleLang, onSelectSubtitle])

    const { changePlaybackRate } = usePlayerPlaybackPrefs({
        videoRef,
        status,
        playbackRate: playbackRatePref,
        setPlaybackRate: setPlaybackRatePref,
        loopEnabled: loopEnabledPref,
    })


    // Media Session API hook (moved here to ensure togglePlay and skipTime are defined)
    usePlayerMediaSession({
        videoRef,
        isPlaying,
        title,
        episodeNumber,
        togglePlay,
        skipTime,
        onNextEpisode,
        hasNextEpisode,
    })


    usePlayerVisibilityPause({ videoRef, setIsPlaying })

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
        toggleMute,
        togglePlay,
        toggleFullscreen,
        setVolume,
        setIsMuted,
        setIsSettingsOpen,
        setShowStats,
        skipToNextChapter,
        skipToPrevChapter,
        onToggleEpisodesSidebar: props.onToggleEpisodesSidebar,
        onToggleQueueSidebar: props.onToggleQueueSidebar,
        onToggleSubtitle: props.onToggleSubtitle ?? handleToggleSubtitle,
        handleVolume,
        onToggleShortcuts: () => setShowShortcuts((prev) => !prev),
        onEscape: props.onEscape,
    })

    const handleTimeUpdate = useCallback(() => {
        const video = videoRef.current
        if (!video) return
        if (isSeekingRef.current) return

        const curr = video.currentTime
        const rawDur = video.duration
        const total = Number.isFinite(rawDur) && rawDur > 0 ? rawDur : duration

        if (progressBarRef.current) {
            const percent = total > 0 ? (curr / total) : 0
            progressBarRef.current.style.transform = `scaleX(${percent})`
        }

        if (thumbRef.current) {
            const percent = total > 0 ? (curr / total) * 100 : 0
            thumbRef.current.style.left = `${percent}%`
        }

        if (progressInputRef.current) {
            progressInputRef.current.value = String(curr)
            progressInputRef.current.setAttribute("aria-valuetext", `${formatPlaybackTime(curr)} de ${formatPlaybackTime(total)}`)
        }

        if (timeTextRef.current) {
            timeTextRef.current.innerText = formatPlaybackTime(curr)
        }

        if (onProgress && Math.abs(curr - lastReportedTimeRef.current) >= 10) {
            onProgress(curr)
            lastReportedTimeRef.current = curr
        }

        const now = Date.now()
        // Sin force: flushBackendSync respeta su propio intervalo.
        flushBackendSync(false)

        processTimeUpdates(curr, total)

        // Stats for Nerds calculation
        if (showStats && now - lastStatsUpdateRef.current >= 1000) {
            lastStatsUpdateRef.current = now
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
    }, [showStats, processTimeUpdates, onProgress, flushBackendSync, playableUrl, duration, isSeekingRef, progressBarRef, timeTextRef])

    // Última versión de handleTimeUpdate para el efecto de abajo, que solo debe
    // re-evaluar al cambiar las preferencias de skip (no en cada render).
    const handleTimeUpdateRef = useRef(handleTimeUpdate)
    useLayoutEffect(() => {
        handleTimeUpdateRef.current = handleTimeUpdate
    }, [handleTimeUpdate])

    useEffect(() => {
        handleTimeUpdateRef.current()
    }, [autoSkipIntroPref, autoSkipOutroPref, marathonMode])


    const domElements = useMemo(() => ({
        videoElement: videoRef as React.RefObject<HTMLVideoElement>,
        containerElement: containerRef as React.RefObject<HTMLDivElement>,
        progressBarElement: progressBarRef as React.RefObject<HTMLDivElement>,
        thumbElement: thumbRef as React.RefObject<HTMLDivElement>,
        progressInputElement: progressInputRef as React.RefObject<HTMLInputElement>,
        timeTextElement: timeTextRef as React.RefObject<HTMLSpanElement>,
    }), [progressBarRef, timeTextRef])

    const state = useMemo(() => ({
        isPlaying, duration, volume, isMuted, isFullscreen, controlsVisible, status, isStreamSwitching, streamSwitchReason, errorMsg, isBuffering, isSeeking, flash, skipMode, skipRemainingSeconds, segmentProgress, showNextEpisode, hasNextEpisode, countdownSeconds, showCountdown, tvMode, audioTracks, activeAudioIndex, subtitleTracks, activeSubtitleIndex, isJassubLoading, isJassubActive, isPgsLoading, isPgsActive, isSettingsOpen, remainingProgress, showAutoSkipToast,
        autoSkipIntro: autoSkipIntroPref,
        autoSkipOutro: autoSkipOutroPref,
        skipStepSeconds: skipStepSecondsPref,
        playbackRate: playbackRatePref,
        aspectRatio: aspectRatioPref,
        subtitleSize: subtitleSizePref,
        loopEnabled: loopEnabledPref,
        showStats,
        showShortcuts,
        statsData,
        hlsLevels,
        activeHlsLevel,
        previewManager,
        get currentTime() {
            return videoRef.current?.currentTime || 0
        },
        autoDisableSubtitlesWhenDubbed,
        marathonMode,
        skipTimesOp,
        skipTimesEd,
        chapters,
        activeChapter,
        absoluteLanUrl,
        serverIPs,
        serverPort,
    }), [isPlaying, duration, volume, isMuted, isFullscreen, controlsVisible, status, isStreamSwitching, streamSwitchReason, errorMsg, isBuffering, isSeeking, flash, skipMode, skipRemainingSeconds, segmentProgress, showNextEpisode, hasNextEpisode, countdownSeconds, showCountdown, tvMode, audioTracks, activeAudioIndex, subtitleTracks, activeSubtitleIndex, isJassubLoading, isJassubActive, isPgsLoading, isPgsActive, isSettingsOpen, remainingProgress, showAutoSkipToast, autoSkipIntroPref, autoSkipOutroPref, skipStepSecondsPref, playbackRatePref, aspectRatioPref, subtitleSizePref, loopEnabledPref, showStats, showShortcuts, statsData, hlsLevels, activeHlsLevel, previewManager, autoDisableSubtitlesWhenDubbed, marathonMode, skipTimesOp, skipTimesEd, chapters, activeChapter, absoluteLanUrl, serverIPs, serverPort])

    const actions = useMemo(() => ({
        setIsPlaying, setDuration, setIsBuffering, setIsSeeking, setControlsVisible, setIsSettingsOpen, triggerControlsVisibility, togglePlay, handleSeek, handleSeekStart, handleSeekEnd, skipTime, skipOpening, handleVolume, toggleMute, onSelectAudio, onSelectSubtitle, toggleSubtitle: handleToggleSubtitle, toggleFullscreen, handleSkipIntro, undoSkip, handleTimeUpdate,
        changePlaybackRate, setShowStats, setShowShortcuts,
        // Los flags de Biblioteca se persisten al servidor: Ajustes sincroniza el
        // store desde el servidor al montarse y, si no, revertía lo cambiado aquí.
        setAutoSkipIntro: (val: boolean) => { handleSetAutoSkipIntro(val); persistLibraryPatch({ autoSkipIntro: val }) },
        setAutoSkipOutro: (val: boolean) => { handleSetAutoSkipOutro(val); persistLibraryPatch({ autoSkipOutro: val }) },
        setSkipStepSeconds: setSkipStepSecondsPref,
        setHlsLevel,
        setAspectRatio: setAspectRatioPref,
        setSubtitleSize: setSubtitleSizePref,
        setLoopEnabled: setLoopEnabledPref,
        setTvMode: handleSetTvMode,
        setMarathonMode: (val: boolean) => { handleSetMarathonMode(val); persistLibraryPatch({ marathonMode: val }) },
        setAutoDisableSubtitlesWhenDubbed: (val: boolean) => { usePlayerStore.getState().setAutoDisableSubtitlesWhenDubbed(val); persistLibraryPatch({ autoDisableSubtitlesWhenDubbed: val }) },
        skipToNextChapter,
        skipToPrevChapter,
        retryStream,
        switchSource,
        flushProgressSync: () => flushBackendSync(true),
    }), [switchSource, setDuration, setIsSeeking, setControlsVisible, setIsSettingsOpen, triggerControlsVisibility, togglePlay, handleSeek, handleSeekStart, handleSeekEnd, skipTime, skipOpening, handleVolume, toggleMute, onSelectAudio, onSelectSubtitle, handleToggleSubtitle, toggleFullscreen, handleSkipIntro, undoSkip, handleTimeUpdate, changePlaybackRate, handleSetAutoSkipIntro, handleSetAutoSkipOutro, setHlsLevel, handleSetTvMode, handleSetMarathonMode, skipToNextChapter, skipToPrevChapter, retryStream, flushBackendSync, setSkipStepSecondsPref, setAspectRatioPref, setSubtitleSizePref, setLoopEnabledPref])

    return { domElements, state, actions }
}
