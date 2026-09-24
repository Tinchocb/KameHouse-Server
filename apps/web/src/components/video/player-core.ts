import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react"
import Hls from "hls.js"
import type JASSUB from "jassub"
import { usePlayerShortcuts } from "./usePlayerShortcuts"
import { usePlayerJassub } from "./usePlayerJassub"
import { usePlayerPgs } from "./usePlayerPgs"
import { usePlayerMediaSession } from "./usePlayerMediaSession"
import { PlayerPreviewManager } from "./player-preview"
import { usePlayerHls } from "./usePlayerHls"
import { useAnimeTracking } from "@/api/hooks/useAnimeTracking"
import { useWebSocket } from "@/hooks/use-websocket"
import { getApiWebSocketUrl } from "@/api/client/server-url"
import { WSEvents, type WebSocketMessage } from "@/lib/server/ws-events"
import { useMediastreamShutdownTranscodeStream, usePreloadMediastreamMediaContainer } from "@/api/hooks/mediastream.hooks"
import { usePlayerStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { usePlayerProgressSync } from "@/api/hooks/usePlayerProgressSync"
import { useGetStatus, useGetSettings } from "@/api/hooks/settings.hooks"
import type { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"
import type { PlayerCoreProps, PlayerCore, PlayerStats } from "./player-core.types"

import { usePlayerSkip } from "./usePlayerSkip"
import { usePlayerVolume } from "./usePlayerVolume"
import { resolveLanUrl } from "./lan-url"
import {
    computeAudioTracksKey,
    computeSubtitleTracksKey,
    matchPendingAudioTrack,
    matchPreferredAudioTrack,
    resolveAutoSubtitleTarget,
} from "./track-selection"



export type { PlayerStats, PlayerCoreProps, PlayerCore }


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
        isFillerEpisode = false,
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
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const hlsRef = useRef<Hls | null>(null)
    const jassubRef = useRef<JASSUB | null>(null)
    const streamSwitchResumeRef = useRef<number | null>(null)
    
    const [previewManager, setPreviewManager] = useState<PlayerPreviewManager | null>(null)

    const progressBarRef = useRef<HTMLDivElement>(null)
    const thumbRef = useRef<HTMLDivElement>(null)
    const progressInputRef = useRef<HTMLInputElement>(null)
    const timeTextRef = useRef<HTMLSpanElement>(null)

    const isSeekingRef = useRef(false)
    const lastSeekTimeRef = useRef(0)
    const pendingSeekTimeRef = useRef<number | null>(null)
    const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const [isPlaying, setIsPlaying] = useState(false)
    const [duration, setDurationState] = useState(0)

    // El navegador puede reportar duration = Infinity/NaN en direct play de MKV
    // sin duración en el header. Si ese valor entra al estado, toda la lógica de
    // "cerca del final" (auto-skip de outro, avance marathon, panel de siguiente
    // episodio) se rompe: `total - curr <= N` nunca es cierto. Saneamos acá y
    // caemos a la duración de ffprobe (metadataDuration) que el server ya conoce.
    const metadataDurationRef = useRef(metadataDuration)
    useLayoutEffect(() => {
        metadataDurationRef.current = metadataDuration
    }, [metadataDuration])
    const setDuration = useCallback((dur: number) => {
        if (Number.isFinite(dur) && dur > 0) {
            setDurationState(dur)
            return
        }
        const meta = metadataDurationRef.current
        if (meta && Number.isFinite(meta) && meta > 0) {
            setDurationState(meta)
        }
        // Sin valor confiable: conservar el anterior en vez de guardar Infinity/0.
    }, [])

    // Semilla inicial: si la metadata del server llega antes (o el navegador nunca
    // emite un durationchange finito), partimos de la duración de ffprobe.
    useEffect(() => {
        if (duration === 0 && metadataDuration && Number.isFinite(metadataDuration) && metadataDuration > 0) {
            const timer = setTimeout(() => setDurationState(metadataDuration), 0)
            return () => clearTimeout(timer)
        }
    }, [metadataDuration, duration])
    // Volumen con persistencia (hook extraído; ver usePlayerVolume).
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [controlsVisible, setControlsVisible] = useState(true)
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
    const { volume, isMuted, setVolume, setIsMuted, handleVolume, toggleMute } = usePlayerVolume({ videoRef, status })
    // true durante un cambio de stream mid-playback (ej. direct→transcode por cambio de pista de audio).
    // En ese caso el overlay de loading debe ser semitransparente (no negro sólido) para que
    // la imagen congelada del video sea visible y la UI no parezca rota.
    const [isStreamSwitching, setIsStreamSwitching] = useState(false)
    // Motivo del cambio de stream, para que el overlay diga lo que realmente pasa.
    const [streamSwitchReason, setStreamSwitchReason] = useState<"audio" | "source" | "fallback">("audio")
    // usePlayerHls solo marca el switch en el fallback direct→transcode.
    const setFallbackStreamSwitching = useCallback((switching: boolean) => {
        if (switching) setStreamSwitchReason("fallback")
        setIsStreamSwitching(switching)
    }, [])
    const [errorMsg, setErrorMsg] = useState("")
    const [isBuffering, setIsBuffering] = useState(false)
    const [isSeeking, setIsSeeking] = useState(false)
    const [flash, setFlash] = useState<"play" | "pause" | null>(null)
    const [retryNonce, setRetryNonce] = useState(0)

    const retryStream = useCallback(() => {
        setStatus("loading")
        setIsBuffering(true)
        setErrorMsg("")
        setRetryNonce(n => n + 1)
    }, [])

    const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
    const [activeAudioIndex, setActiveAudioIndex] = useState(0)
    const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])
    const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number | null>(null)
    const [isJassubLoading, setIsJassubLoading] = useState(false)
    const [isJassubActive, setIsJassubActive] = useState(false)
    const [isPgsLoading, setIsPgsLoading] = useState(false)
    const [isPgsActive, setIsPgsActive] = useState(false)
    const [hlsLevels, setHlsLevels] = useState<{ index: number; label: string; height: number }[]>([])
    const [activeHlsLevel, setActiveHlsLevel] = useState<number>(-1) // -1 = auto

    const [isSettingsOpen, setIsSettingsOpenState] = useState(false)
    // Mirror ref so the auto-hide setTimeout callback always sees the current value
    // (setState closures capture the value at the time of creation).
    const isSettingsOpenRef = useRef(false)
    const setIsSettingsOpen = useCallback((action: React.SetStateAction<boolean>) => {
        setIsSettingsOpenState(prev => {
            const next = typeof action === "function" ? action(prev) : action
            isSettingsOpenRef.current = next
            return next
        })
    }, []) as React.Dispatch<React.SetStateAction<boolean>>

    const {
        setFullscreen: setGlobalFullscreen,
        autoSkipIntro: autoSkipIntroPref,
        setAutoSkipIntro,
        autoSkipOutro: autoSkipOutroPref,
        setAutoSkipOutro,
        autoSkipFiller: autoSkipFillerPref,
        setAutoSkipFiller: _setAutoSkipFiller,
        skipStepSeconds: skipStepSecondsPref,
        setSkipStepSeconds: setSkipStepSecondsPref,
        playbackRate: playbackRatePref,
        setPlaybackRate: setPlaybackRatePref,
        preferredAudioProfile,
        preferredAudioLang,
        setPreferredAudioLang,
        preferredAudioTrackIndexMap,
        setPreferredAudioTrackIndexMap,
        preferredSubtitleLang,
        setPreferredSubtitleLang,
        subtitlesEnabled,
        setSubtitlesEnabled,
        showHeatmap: showHeatmapPref,
        setShowHeatmap: setShowHeatmapPref,
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
        ambientModeEnabled,
        setAmbientModeEnabled,
    } = usePlayerStore(
        // Note: playerVolume/setPlayerVolume already destructured above (D3).
        useShallow(state => ({
            setFullscreen: state.setFullscreen,
            autoSkipIntro: state.autoSkipIntro,
            setAutoSkipIntro: state.setAutoSkipIntro,
            autoSkipOutro: state.autoSkipOutro,
            setAutoSkipOutro: state.setAutoSkipOutro,
            autoSkipFiller: state.autoSkipFiller,
            setAutoSkipFiller: state.setAutoSkipFiller,
            skipStepSeconds: state.skipStepSeconds,
            setSkipStepSeconds: state.setSkipStepSeconds,
            playbackRate: state.playbackRate,
            setPlaybackRate: state.setPlaybackRate,
            preferredAudioProfile: state.preferredAudioProfile,
            preferredAudioLang: state.preferredAudioLang,
            setPreferredAudioLang: state.setPreferredAudioLang,
            preferredAudioTrackIndexMap: state.preferredAudioTrackIndex,
            setPreferredAudioTrackIndexMap: state.setPreferredAudioTrackIndex,
            preferredSubtitleLang: state.preferredSubtitleLang,
            setPreferredSubtitleLang: state.setPreferredSubtitleLang,
            subtitlesEnabled: state.subtitlesEnabled,
            setSubtitlesEnabled: state.setSubtitlesEnabled,
            showHeatmap: state.showHeatmap,
            setShowHeatmap: state.setShowHeatmap,
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
            ambientModeEnabled: state.ambientModeEnabled,
            setAmbientModeEnabled: state.setAmbientModeEnabled,
        }))
    )
    
    const preferredAudioTrackIndex = mediaId ? (preferredAudioTrackIndexMap[mediaId] ?? -1) : -1

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
    const setPreferredAudioTrackIndex = useCallback((index: number) => {
        if (mediaId) setPreferredAudioTrackIndexMap(mediaId, index)
    }, [mediaId, setPreferredAudioTrackIndexMap])

    const [showStats, setShowStats] = useState(false)
    const [showShortcuts, setShowShortcuts] = useState(false)
    const [statsData, setStatsData] = useState<PlayerStats | null>(null)

    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const lastReportedTimeRef = useRef(0)

    const wsUrl = useMemo(() => getApiWebSocketUrl(), [])
    const { sendJsonMessage } = useWebSocket(wsUrl)
    const lastSentHeartbeatRef = useRef(0)
    const lastStatsUpdateRef = useRef(0)

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
            // Do not auto-hide while the settings panel is open: the panel is a
            // child of .player-bottom-bar and GSAP's autoAlpha:0 makes it
            // non-interactive even though isSettingsOpen stays true.
            if (isPlaying && !isSettingsOpenRef.current) {
                setControlsVisible(false)
                setIsSettingsOpen(false)
            }
        }, 3000)
    }, [isPlaying, setIsSettingsOpen])

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
        autoSkipFillerPref,
        isFillerEpisode,
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

    const { data: serverSettings } = useGetSettings()
    const enableWatchContinuity = serverSettings?.library?.enableWatchContinuity ?? true

    const { onProgress: onTrackingProgress, reset: resetTracking } = useAnimeTracking({
        mediaId,
        episodeNumber,
        filepath: streamUrl || playableUrl,
        enabled: !!(mediaId && episodeNumber && enableWatchContinuity),
    })

    const { onProgress: onSyncProgress } = usePlayerProgressSync({
        mediaId,
        episodeNumber,
        filepath: streamUrl || playableUrl,
        enabled: !!(mediaId && episodeNumber && enableWatchContinuity),
    })

    const lastBackendSyncTimeRef = useRef(0)

    const flushBackendSync = useCallback((force = false) => {
        const video = videoRef.current
        if (!video) return
        const curr = video.currentTime
        const rawDur = video.duration
        const total = Number.isFinite(rawDur) && rawDur > 0 ? rawDur : duration
        const now = Date.now()

        if (force || now - lastBackendSyncTimeRef.current >= 5000) {
            lastBackendSyncTimeRef.current = now
            lastSentHeartbeatRef.current = now
            sendHeartbeat(curr, total)
            onSyncProgress(curr, total)
            onTrackingProgress(curr, total)
        }
    }, [duration, sendHeartbeat, onSyncProgress, onTrackingProgress])

    useEffect(() => {
        return () => {
            flushBackendSync(true)
        }
    }, [flushBackendSync])

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

    useEffect(() => {
        const timer = setTimeout(() => {
            setAudioTracks([])
            setSubtitleTracks([])
            setActiveAudioIndex(0)
            setActiveSubtitleIndex(null)
            // Nuevo episodio o URL completamente distinta: nunca es un stream-switch de audio.
            // Resetear para que el loading inicial use fondo negro sólido.
            setIsStreamSwitching(false)
        }, 0)
        return () => clearTimeout(timer)
    }, [playableUrl])

    // Cuando el stream está listo (ya sea tras carga inicial o tras un switch de audio),
    // desactivar la bandera de stream-switching para limpiar el overlay.
    useEffect(() => {
        if (status === "ready") {
            const timer = setTimeout(() => {
                setIsStreamSwitching(false)
            }, 0)
            return () => clearTimeout(timer)
        }
    }, [status])

    const formatTime = useCallback((secs: number) => {
        if (!secs || isNaN(secs)) return "00:00"
        const h = Math.floor(secs / 3600)
        const m = Math.floor((secs % 3600) / 60)
        const s = Math.floor(secs % 60)

        const mm = m.toString().padStart(2, '0')
        const ss = s.toString().padStart(2, '0')

        return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
    }, [])

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
        setAudioTracks,
        setSubtitleTracks,
        setActiveAudioIndex,
        setIsPlaying,
        onDirectPlayFailed,
        setIsStreamSwitching: setFallbackStreamSwitching,
        retryNonce,
        streamRequestError,
    })

    // JASSUB Subtitle renderer hook
    usePlayerJassub({
        videoRef,
        canvasRef,
        jassubRef,
        activeSubtitleIndex,
        subtitleTracks,
        subtitleSizePref,
        fontUrls: backendTracks?.fontUrls,
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

    // Selección de audio pendiente tras un cambio de stream (direct → transcode):
    // se aplica cuando llega la nueva lista de pistas HLS.
    const pendingAudioSelectionRef = useRef<AudioTrack | null>(null)

    // Auto-select preferred tracks
    // opts.auto === true → selección automática (preferencia): nunca forzar transcode.
    // Sin opts (o auto === false) → selección manual del usuario.
    const onSelectAudio = useCallback((track: AudioTrack, opts?: { auto?: boolean }) => {
        const isAuto = opts?.auto === true
        if (hlsRef.current) {
            // Use hlsId (hls.js sequential manifest position) for hls.audioTrack.
            // `track.index` is the ABSOLUTE container index (used in backend URIs);
            // hls.js expects the positional id within its own audioTracks list.
            // hlsId is set during AUDIO_TRACKS_UPDATED merging; fall back to index
            // only when hlsId is not available (e.g. backend-only fallback list).
            hlsRef.current.audioTrack = track.hlsId ?? track.index
        } else if (videoRef.current && 'audioTracks' in videoRef.current && (videoRef.current as HTMLVideoElement & { audioTracks: AudioTrackList }).audioTracks?.length > 0) {
            const video = videoRef.current as HTMLVideoElement & { audioTracks: AudioTrackList }
            const trackList = Array.from(video.audioTracks)
            for (let i = 0; i < trackList.length; i++) {
                trackList[i].enabled = i === track.index
            }
        } else if (streamType === "direct" || streamType === "local") {
            // Chromium/WebView2 no soporta la API nativa de audioTracks en direct play.
            if (isAuto) {
                // Auto-selección: solo persistir la preferencia de idioma y mantener
                // direct play con la pista por defecto. No disparar transcode.
                if (track.language && track.language.toLowerCase() !== "und") {
                    setPreferredAudioLang(track.language)
                }
                return
            } else if (onRequestStreamTypeChange) {
                // Selección manual explícita del usuario. Chromium/WebView2 no puede
                // cambiar de pista sin reconstruir el stream, así que forzamos el salto a
                // HLS transcode aunque el toggle global esté apagado: force:true permite al
                // backend inicializar el transcoder on-demand. Para fuentes H264 el video se
                // copia (-c:v copy) y solo se re-encodea el audio a AAC, así que es barato.
                streamSwitchResumeRef.current = videoRef.current?.currentTime ?? null
                pendingAudioSelectionRef.current = track
                // Marcar como stream-switch para que el overlay use fondo semitransparente
                setStreamSwitchReason("audio")
                setIsStreamSwitching(true)
                onRequestStreamTypeChange("transcode", { force: true })
            }
        }
        setActiveAudioIndex(track.index)
        if (!isAuto) {
            // Guardar el índice como fallback persistido, ideal para "und".
            setPreferredAudioTrackIndex(track.index)
            // "und" (unlabeled track, común en MKVs de anime) no identifica un idioma:
            // persistirlo hacía que en el siguiente episodio se auto-seleccionara la
            // PRIMERA pista sin etiqueta (normalmente japonés) en vez de la elegida.
            if (track.language && track.language.toLowerCase() !== "und") {
                setPreferredAudioLang(track.language)
            }
        }
    }, [setPreferredAudioLang, setPreferredAudioTrackIndex, onRequestStreamTypeChange, streamType])


    const onSelectSubtitle = useCallback((track: SubtitleTrack | null, opts?: { auto?: boolean }) => {
        const isAuto = opts?.auto === true
        if (track === null) {
            setActiveSubtitleIndex(null)
            if (!isAuto) setSubtitlesEnabled(false)
            if (hlsRef.current) {
                hlsRef.current.subtitleTrack = -1
            }
        } else {
            if (hlsRef.current) {
                hlsRef.current.subtitleTrack = track.index
            }
            setActiveSubtitleIndex(track.index)
            if (!isAuto) setSubtitlesEnabled(true)
            if (!isAuto && track.language) {
                setPreferredSubtitleLang(track.language)
            }
        }
    }, [setPreferredSubtitleLang, setSubtitlesEnabled])

    // Guarda: auto-seleccionar UNA sola vez por lista de pistas (por stream).
    // Este efecto también se re-dispara cuando el usuario cambia de pista
    // manualmente (activeAudioIndex está en las deps) — sin esta guarda, la
    // heurística "Latino primero" revertía la selección manual al instante
    // y el menú de audio parecía no funcionar.
    //
    // D4: La guarda usa una clave de CONTENIDO estable en lugar de identidad de array.
    // Si React crea un nuevo array con los mismos elementos (ej. re-render de HLS),
    // la comparación por referencia fallaba y se re-ejecutaba la auto-selección,
    // pisando la elección manual. La clave "index:lang|..." es estable mientras
    // el contenido de las pistas no cambie.
    const audioAutoSelectedForRef = useRef<string | null>(null)
    const audioTracksKey = computeAudioTracksKey(audioTracks)
    useEffect(() => {
        if (audioTracks.length === 0) return

        // Prioridad máxima: pista elegida explícitamente por el usuario antes
        // de un cambio de stream (direct → transcode).
        const pending = pendingAudioSelectionRef.current
        if (pending) {
            pendingAudioSelectionRef.current = null
            const match = matchPendingAudioTrack(audioTracks, pending)
            if (match) {
                audioAutoSelectedForRef.current = audioTracksKey
                if (activeAudioIndex !== match.index) onSelectAudio(match)
                return
            }
        } else if (audioAutoSelectedForRef.current === audioTracksKey) {
            return
        }
        audioAutoSelectedForRef.current = audioTracksKey

        const preferred = matchPreferredAudioTrack({
            tracks: audioTracks,
            preferredAudioProfile,
            preferredAudioLang,
            preferredAudioTrackIndex,
        })

        if (preferred && activeAudioIndex !== preferred.index) {
            // Pasar { auto: true } para que en direct play no dispare transcode.
            onSelectAudio(preferred, { auto: true })
        }
    }, [audioTracksKey, preferredAudioProfile, preferredAudioLang, preferredAudioTrackIndex, activeAudioIndex, onSelectAudio, audioTracks])

    // Misma guarda que el audio: auto-configurar subtítulos UNA vez por lista
    // de pistas.
    const subtitleAutoSelectedForRef = useRef<string | null>(null)
    const subtitleTracksKey = computeSubtitleTracksKey(subtitleTracks)
    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = []
        if (subtitleTracks.length > 0 && subtitleAutoSelectedForRef.current !== subtitleTracksKey) {
            subtitleAutoSelectedForRef.current = subtitleTracksKey
            const currentAudio = audioTracks.find(t => t.index === activeAudioIndex)
            const targetSubtitle = resolveAutoSubtitleTarget({
                subtitleTracks,
                currentAudio,
                subtitlesEnabled,
                autoDisableSubtitlesWhenDubbed,
                preferredSubtitleLang,
            })

            if (targetSubtitle === null) {
                if (activeSubtitleIndex !== null) {
                    timers.push(setTimeout(() => onSelectSubtitle(null, { auto: true }), 0))
                }
            } else if (activeSubtitleIndex !== targetSubtitle.index) {
                timers.push(setTimeout(() => onSelectSubtitle(targetSubtitle, { auto: true }), 0))
            }
        }
        return () => timers.forEach(clearTimeout)
    }, [subtitleTracksKey, subtitleTracks, audioTracks, activeAudioIndex, preferredSubtitleLang, autoDisableSubtitlesWhenDubbed, activeSubtitleIndex, onSelectSubtitle, subtitlesEnabled])

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

    // Cambio de fuente desde el menú (Direct Play ↔ Transcodificado): retoma en el
    // mismo punto, igual que el cambio de pista de audio. Antes el nuevo stream
    // arrancaba desde 0.
    const switchSource = useCallback((type: string) => {
        if (type === streamType) return
        if (type !== "direct" && type !== "transcode") return
        if (!onRequestStreamTypeChange) return
        const current = videoRef.current?.currentTime ?? 0
        streamSwitchResumeRef.current = Number.isFinite(current) && current > 0 ? current : null
        setStreamSwitchReason("source")
        setIsStreamSwitching(true)
        // Elección explícita del usuario: igual que el cambio de pista de audio,
        // force permite transcodificar aunque el toggle global esté apagado.
        onRequestStreamTypeChange(type, { force: type === "transcode" })
    }, [streamType, onRequestStreamTypeChange])

    const performSeek = useCallback((time: number) => {
        const video = videoRef.current
        if (!video || !Number.isFinite(time)) return

        setIsSeeking(true)
        checkManualSkipOverrides(time)

        // Visual update of elements instantly
        if (progressBarRef.current) {
            const percent = video.duration > 0 ? (time / video.duration) : 0
            progressBarRef.current.style.transform = `scaleX(${percent})`
        }
        if (timeTextRef.current) {
            timeTextRef.current.innerText = formatTime(time)
        }

        if (isSeekingRef.current) {
            // Do not perform actual video seek while dragging to avoid flooding requests
            return
        }

        const now = Date.now()
        const SEEK_THROTTLE_MS = 180

        if (now - lastSeekTimeRef.current >= SEEK_THROTTLE_MS) {
            video.currentTime = time
            lastSeekTimeRef.current = now
            pendingSeekTimeRef.current = null
        } else {
            pendingSeekTimeRef.current = time
            if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current)
            seekTimeoutRef.current = setTimeout(() => {
                const latestTime = pendingSeekTimeRef.current
                if (latestTime !== null && video) {
                    video.currentTime = latestTime
                    lastSeekTimeRef.current = Date.now()
                    pendingSeekTimeRef.current = null
                }
            }, SEEK_THROTTLE_MS - (now - lastSeekTimeRef.current))
        }
    }, [checkManualSkipOverrides, formatTime])

    const handleSeekStart = useCallback(() => {
        isSeekingRef.current = true
    }, [])

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value)
        performSeek(val)
        triggerControlsVisibility()
    }, [performSeek, triggerControlsVisibility])

    const handleSeekEnd = useCallback((e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {
        const video = videoRef.current
        if (!video) return

        isSeekingRef.current = false
        setIsSeeking(false)
        if (seekTimeoutRef.current) {
            clearTimeout(seekTimeoutRef.current)
            seekTimeoutRef.current = null
        }

        const val = parseFloat(e.currentTarget.value)
        if (!Number.isFinite(val)) return
        checkManualSkipOverrides(val)
        video.currentTime = val
        lastSeekTimeRef.current = Date.now()
        pendingSeekTimeRef.current = null

        triggerControlsVisibility()
    }, [checkManualSkipOverrides, triggerControlsVisibility])

    useEffect(() => {
        return () => {
            if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current)
        }
    }, [])

    const skipTime = useCallback((amount: number) => {
        const video = videoRef.current
        if (!video) return
        const dur = Number.isFinite(video.duration) ? video.duration : Infinity
        const target = Math.max(0, Math.min(dur, video.currentTime + amount))

        performSeek(target)
        triggerControlsVisibility()
    }, [performSeek, triggerControlsVisibility])

    const toggleFullscreen = useCallback(() => {
        const container = containerRef.current
        const video = videoRef.current
        if (!container) return

        if (!document.fullscreenElement) {
            if (container.requestFullscreen) {
                container.requestFullscreen()
                    .then(() => setIsFullscreen(true))
                    .catch((err) => console.error("Error entering fullscreen:", err))
            } else if (video && (video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen) {
                try {
                    ;(video as HTMLVideoElement & { webkitEnterFullscreen: () => void }).webkitEnterFullscreen()
                    setIsFullscreen(true)
                } catch (err) {
                    console.error("webkitEnterFullscreen error:", err)
                }
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen()
                    .then(() => setIsFullscreen(false))
            }
        }
    }, [])

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

    const changePlaybackRate = useCallback((rate: number) => {
        const video = videoRef.current
        if (!video) return
        video.playbackRate = rate
        setPlaybackRatePref(rate)
    }, [setPlaybackRatePref])

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
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.error("Error exiting fullscreen on unmount:", err))
            }
        }
    }, [setGlobalFullscreen])

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

    useEffect(() => {
        const desktopApi = window.desktop
        if (!desktopApi) return

        const unsub = desktopApi.on("window:fullscreen", (...args: unknown[]) => {
            const isFs = args[0] as boolean
            setIsFullscreen(isFs)
            setGlobalFullscreen(isFs)
        })

        return () => {
            unsub?.()
        }
    }, [setGlobalFullscreen])

    // Handle Page Visibility / App Suspend (especially on Tizen Smart TVs)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                const video = videoRef.current
                if (video && !video.paused) {
                    video.pause()
                    setIsPlaying(false)
                }
            }
        }
        document.addEventListener("visibilitychange", handleVisibilityChange)
        document.addEventListener("webkitvisibilitychange", handleVisibilityChange)
        document.addEventListener("tizenvisibilitywrapper", handleVisibilityChange)
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
            document.removeEventListener("webkitvisibilitychange", handleVisibilityChange)
            document.removeEventListener("tizenvisibilitywrapper", handleVisibilityChange)
        }
    }, [setIsPlaying, videoRef])

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
        }

        if (timeTextRef.current) {
            timeTextRef.current.innerText = formatTime(curr)
        }

        if (onProgress && Math.abs(curr - lastReportedTimeRef.current) >= 10) {
            onProgress(curr)
            lastReportedTimeRef.current = curr
        }

        const now = Date.now()
        if (now - lastBackendSyncTimeRef.current >= 5000) {
            flushBackendSync(false)
        }

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
    }, [showStats, lastStatsUpdateRef, processTimeUpdates, onProgress, flushBackendSync, playableUrl, formatTime, duration])

    // Apply playback rate instantly
    useEffect(() => {
        const video = videoRef.current
        if (video && video.playbackRate !== playbackRatePref) {
            video.playbackRate = playbackRatePref
        }
    }, [playbackRatePref])

    const handleTimeUpdateRef = useRef(handleTimeUpdate)
    // eslint-disable-next-line react-hooks/refs -- intentional: update ref after definition to avoid stale closure
    handleTimeUpdateRef.current = handleTimeUpdate

    // Force skip check when preferences change (including marathon mode toggle)
    useEffect(() => {
        handleTimeUpdateRef.current()
    }, [autoSkipIntroPref, autoSkipOutroPref, autoSkipFillerPref, marathonMode])

    const handleSetHlsLevel = useCallback((levelIndex: number) => {
        const hls = hlsRef.current
        if (!hls) {
            console.warn("[player-core] handleSetHlsLevel called without active HLS instance")
            return
        }
        try {
            if (levelIndex === -1) {
                // Auto: reactivar ABR asignando currentLevel / nextLevel a -1
                hls.currentLevel = -1
                hls.nextLevel = -1
            } else {
                hls.currentLevel = levelIndex
                hls.nextLevel = levelIndex
            }
            setActiveHlsLevel(levelIndex)
        } catch (err) {
            console.warn("[player-core] handleSetHlsLevel failed:", err)
        }
    }, [])

    // Remote-control commands from the server (extensions, TV remote).
    // The hook only exists while a player is mounted, so commands never hit
    // a dead player. Broadcasts reach every tab with a player open — accepted
    // tradeoff until the payload carries a routable client/media id.
    const handleVideocoreCommand = useCallback((msg: WebSocketMessage) => {
        if (msg.type !== WSEvents.VIDEOCORE) return
        const inner = (msg.payload ?? {}) as { type?: string; payload?: unknown }
        const video = videoRef.current
        switch (inner.type) {
            case "pause": {
                if (!video || video.paused || status !== "ready") return
                video.pause()
                flushBackendSync(true)
                setIsPlaying(false)
                break
            }
            case "resume": {
                if (!video || !video.paused || status !== "ready") return
                video.play()
                    .then(() => setIsPlaying(true))
                    .catch(() => setIsPlaying(false))
                break
            }
            case "seek": {
                if (typeof inner.payload !== "number" || !Number.isFinite(inner.payload)) return
                if (!video || status !== "ready") return
                performSeek(video.currentTime + inner.payload)
                break
            }
            case "seek-to": {
                if (typeof inner.payload !== "number" || !Number.isFinite(inner.payload)) return
                if (!video || status !== "ready") return
                const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : Infinity
                performSeek(Math.max(0, Math.min(dur, inner.payload)))
                break
            }
            case "terminate": {
                if (video && !video.paused) video.pause()
                setIsPlaying(false)
                setStatus("error")
                setErrorMsg("Reproducción terminada por el servidor")
                break
            }
            default:
                break
        }
    }, [status, flushBackendSync, performSeek])
    useWebSocket(wsUrl, handleVideocoreCommand)

    const domElements = useMemo(() => ({
        videoElement: videoRef as React.RefObject<HTMLVideoElement>,
        containerElement: containerRef as React.RefObject<HTMLDivElement>,
        canvasElement: canvasRef as React.RefObject<HTMLCanvasElement>,
        progressBarElement: progressBarRef as React.RefObject<HTMLDivElement>,
        thumbElement: thumbRef as React.RefObject<HTMLDivElement>,
        progressInputElement: progressInputRef as React.RefObject<HTMLInputElement>,
        timeTextElement: timeTextRef as React.RefObject<HTMLSpanElement>,
    }), [])

    const state = useMemo(() => ({
        isPlaying, duration, volume, isMuted, isFullscreen, controlsVisible, status, isStreamSwitching, streamSwitchReason, errorMsg, isBuffering, isSeeking, flash, skipMode, skipRemainingSeconds, segmentProgress, showNextEpisode, hasNextEpisode, countdownSeconds, showCountdown, tvMode, audioTracks, activeAudioIndex, subtitleTracks, activeSubtitleIndex, isJassubLoading, isJassubActive, isPgsLoading, isPgsActive, isSettingsOpen, remainingProgress, showAutoSkipToast,
        autoSkipIntro: autoSkipIntroPref,
        autoSkipOutro: autoSkipOutroPref,
        autoSkipFiller: autoSkipFillerPref,
        skipStepSeconds: skipStepSecondsPref,
        playbackRate: playbackRatePref,
        showHeatmap: showHeatmapPref,
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
        ambientModeEnabled,
        marathonMode,
        skipTimesOp,
        skipTimesEd,
        chapters,
        activeChapter,
        absoluteLanUrl,
        serverIPs,
        serverPort,
    }), [isPlaying, duration, volume, isMuted, isFullscreen, controlsVisible, status, isStreamSwitching, streamSwitchReason, errorMsg, isBuffering, isSeeking, flash, skipMode, skipRemainingSeconds, segmentProgress, showNextEpisode, hasNextEpisode, countdownSeconds, showCountdown, tvMode, audioTracks, activeAudioIndex, subtitleTracks, activeSubtitleIndex, isJassubLoading, isJassubActive, isPgsLoading, isPgsActive, isSettingsOpen, remainingProgress, showAutoSkipToast, autoSkipIntroPref, autoSkipOutroPref, autoSkipFillerPref, skipStepSecondsPref, playbackRatePref, showHeatmapPref, aspectRatioPref, subtitleSizePref, loopEnabledPref, showStats, showShortcuts, statsData, hlsLevels, activeHlsLevel, previewManager, autoDisableSubtitlesWhenDubbed, ambientModeEnabled, marathonMode, skipTimesOp, skipTimesEd, chapters, activeChapter, absoluteLanUrl, serverIPs, serverPort])

    const actions = useMemo(() => ({
        setIsPlaying, setDuration, setIsBuffering, setIsSeeking, setControlsVisible, setIsSettingsOpen, triggerControlsVisibility, togglePlay, handleSeek, handleSeekStart, handleSeekEnd, skipTime, skipOpening, handleVolume, toggleMute, onSelectAudio, onSelectSubtitle, toggleSubtitle: handleToggleSubtitle, toggleFullscreen, handleSkipIntro, undoSkip, handleTimeUpdate,
        changePlaybackRate, setShowStats, setShowShortcuts,
        setAutoSkipIntro: handleSetAutoSkipIntro,
        setAutoSkipOutro: handleSetAutoSkipOutro,
        setAutoSkipFiller: (val: boolean) => { usePlayerStore.getState().setAutoSkipFiller(val) },
        setSkipStepSeconds: setSkipStepSecondsPref,
        setHlsLevel: handleSetHlsLevel,
        setShowHeatmap: setShowHeatmapPref,
        setAspectRatio: setAspectRatioPref,
        setSubtitleSize: setSubtitleSizePref,
        setLoopEnabled: setLoopEnabledPref,
        setTvMode: handleSetTvMode,
        setAmbientModeEnabled,
        setMarathonMode: handleSetMarathonMode,
        setAutoDisableSubtitlesWhenDubbed: (val: boolean) => { usePlayerStore.getState().setAutoDisableSubtitlesWhenDubbed(val) },
        skipToNextChapter,
        skipToPrevChapter,
        retryStream,
        switchSource,
        flushProgressSync: () => flushBackendSync(true),
    }), [switchSource, setDuration, setControlsVisible, setIsSettingsOpen, triggerControlsVisibility, togglePlay, handleSeek, handleSeekStart, handleSeekEnd, skipTime, skipOpening, handleVolume, toggleMute, onSelectAudio, onSelectSubtitle, handleToggleSubtitle, toggleFullscreen, handleSkipIntro, undoSkip, handleTimeUpdate, changePlaybackRate, handleSetAutoSkipIntro, handleSetAutoSkipOutro, handleSetHlsLevel, handleSetTvMode, handleSetMarathonMode, skipToNextChapter, skipToPrevChapter, retryStream, flushBackendSync, setSkipStepSecondsPref, setShowHeatmapPref, setAspectRatioPref, setSubtitleSizePref, setLoopEnabledPref, setAmbientModeEnabled])

    return { domElements, state, actions }
}
