import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import Hls from "hls.js"
import JASSUB from "jassub"
import { useRequestMediastreamMediaContainer } from "@/api/hooks/mediastream.hooks"
import { useAniSkipTimes } from "@/api/hooks/aniskip.hooks"
import { useAnimeTracking } from "@/api/hooks/useAnimeTracking"
import { Loader2, AlertTriangle } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { useWebSocket } from "@/hooks/use-websocket"
import { getApiWebSocketUrl } from "@/api/client/server-url"

// Import modular player components
import { PlayerTopBar } from "./player-topbar"
import { PlayerBottomBar } from "./player-bottombar"
import {
    LoadingErrorOverlay,
    CenterPlayFlash,
    SkipIntroOverlay,
    NextEpisodeOverlay,
} from "./player-overlays"

import type { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"
import type { EpisodeSource } from "@/api/types/unified.types"

export type VideoPlayerProps = {
    streamUrl: string
    streamType?: "local" | "online" | "direct" | "transcode" | "optimized"
    isExternalStream?: boolean
    title?: string
    episodeLabel?: string
    initialProgressSeconds?: number
    onClose: () => void
    onProgress?: (seconds: number) => void
    onNextEpisode?: () => void
    hasNextEpisode?: boolean
    mediaId?: number
    episodeNumber?: number
    malId?: number | null
    marathonMode?: boolean
}

function PlayerLoadingScreen() {
    return (
        <div className="fixed inset-0 z-[10000] bg-black w-screen h-screen flex flex-col items-center justify-center gap-4 text-white">
            <Loader2 className="w-14 h-14 text-white animate-spin" />
            <p className="font-bold tracking-widest uppercase text-[10px] opacity-80 animate-pulse">
                Cargando Reproductor
            </p>
        </div>
    )
}

export function VideoPlayer(props: VideoPlayerProps) {
    const isLocal = !props.isExternalStream && Boolean(props.streamUrl) && props.streamType !== "online"

    const { data, isLoading, error } = useRequestMediastreamMediaContainer({
        path: props.streamUrl,
        streamType: props.streamType as any,
    }, isLocal)

    if (isLocal) {
        if (isLoading) {
            return <PlayerLoadingScreen />
        }

        if (error || !data || !data.streamUrl) {
            return (
                <div className="fixed inset-0 z-[10000] bg-black w-screen h-screen flex flex-col items-center justify-center gap-6 px-6 text-center text-white">
                    <AlertTriangle className="w-16 h-16 text-white" />
                    <h3 className="font-black text-2xl tracking-[0.2em] uppercase">Error de Streaming</h3>
                    <p className="text-zinc-500 max-w-md text-sm font-bold uppercase tracking-wider leading-relaxed">
                        {error instanceof Error ? error.message : "El servidor no devolvió una URL de reproducción válida."}
                    </p>
                    <button
                        onClick={props.onClose}
                        className="mt-6 px-10 py-4 bg-white text-black font-black text-[11px] uppercase tracking-[0.3em] transition-all hover:bg-zinc-200"
                    >
                        REGRESAR
                    </button>
                </div>
            )
        }

        return (
            <VideoPlayerOrchestrator
                {...props}
                playableUrl={data.streamUrl}
                backendTracks={{
                    audioTracks: data.mediaInfo?.audios?.map((a: any, i: number) => ({
                        index: a.index ?? i,
                        language: a.language ?? "und",
                        title: a.title || a.language || `Audio ${i + 1}`,
                        codec: a.codec,
                        channels: a.channels,
                        default: a.default
                    })) || [],
                    subtitleTracks: data.mediaInfo?.subtitles?.map((s: any, i: number) => ({
                        index: s.index ?? i,
                        language: s.language ?? "und",
                        title: s.title || s.language || `Subtitle ${i + 1}`,
                        codec: s.codec,
                        default: s.default,
                        forced: s.forced,
                        url: `/api/v1/mediastream/subtitles?path=${encodeURIComponent(props.streamUrl)}&trackIndex=${s.index ?? i}`
                    })) || []
                }}
            />
        )
    }

    return (
        <VideoPlayerOrchestrator
            {...props}
            playableUrl={props.streamUrl}
        />
    )
}

interface OrchestratorProps extends VideoPlayerProps {
    playableUrl: string
    backendTracks?: {
        audioTracks: AudioTrack[]
        subtitleTracks: SubtitleTrack[]
    }
}

function VideoPlayerOrchestrator(props: OrchestratorProps) {
    const {
        playableUrl,
        backendTracks,
        title,
        episodeLabel,
        initialProgressSeconds = 0,
        onClose,
        onProgress,
        onNextEpisode,
        hasNextEpisode = false,
        mediaId,
        episodeNumber,
        malId,
    } = props
    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const hlsRef = useRef<Hls | null>(null)
    const jassubRef = useRef<any>(null)

    // UI refs for high performance bypass of React renders during playback ticking
    const progressBarRef = useRef<HTMLDivElement>(null)
    const progressInputRef = useRef<HTMLInputElement>(null)
    const timeTextRef = useRef<HTMLSpanElement>(null)

    // Player State
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

    // Dynamic Overlays State
    const [showSkipIntro, setShowSkipIntro] = useState(false)
    const [skipRemainingSeconds, setSkipRemainingSeconds] = useState(0)
    const [skipLabel, setSkipLabel] = useState("SALTAR INTRO")
    const [showNextEpisode, setShowNextEpisode] = useState(false)
    const [countdownSeconds, setCountdownSeconds] = useState(10)
    const [marathonMode] = useState(true)

    // Track state
    const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
    const [activeAudioIndex, setActiveAudioIndex] = useState(0)
    const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])
    const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number | null>(null)
    const [isJassubLoading, setIsJassubLoading] = useState(false)

    // Settings panel visibility
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    // Inactivity timeout ref
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const nextEpisodeTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Progress reporting throttle
    const lastReportedTimeRef = useRef(0)

    // ── WebSocket heartbeat ──────────────────────────────────────────────────
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

    // ── AniSkip integration ──────────────────────────────────────────────────
    const { data: skipTimes } = useAniSkipTimes({
        malId: malId ?? null,
        episodeNumber: episodeNumber ?? null,
        episodeDuration: duration > 0 ? duration : undefined,
        enabled: !!(malId && episodeNumber),
    })

    // ── Anime tracking hook (85% completion sync) ────────────────────────────
    const { onProgress: onTrackingProgress, reset: resetTracking } = useAnimeTracking({
        mediaId,
        episodeNumber,
        filepath: playableUrl,
        enabled: !!(mediaId && episodeNumber),
    })

    // Reset tracking when episode changes
    useEffect(() => {
        resetTracking()
    }, [mediaId, episodeNumber, playableUrl])

    // Single source wrapper to match subcomponent signature
    const episodeSources = useMemo<EpisodeSource[]>(() => [
        {
            title: "Original",
            quality: "1085p",
            url: playableUrl,
            type: "local",
            path: playableUrl,
            priority: 1,
        }
    ], [playableUrl])

    // Format time helper
    const formatTime = (secs: number) => {
        if (!secs || isNaN(secs)) return "00:00"
        const m = Math.floor(secs / 60)
        const s = Math.floor(secs % 60)
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    // Initialize Hls.js or direct playback
    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        Promise.resolve().then(() => {
            setStatus("loading")
            setIsBuffering(true)
        })

        // Cleanup previous instance
        if (hlsRef.current) {
            hlsRef.current.destroy()
            hlsRef.current = null
        }

        const isHlsUrl = playableUrl.includes(".m3u8")
        let hlsInstance: Hls | null = null

        const handleCanPlay = () => {
            setStatus("ready")
            setIsBuffering(false)
            if (initialProgressSeconds > 0) {
                video.currentTime = initialProgressSeconds
            }
        }

        const handleNativeError = () => {
            setStatus("error")
            setErrorMsg(video.error?.message || "Ocurrió un error al cargar el archivo de video.")
        }

        if (isHlsUrl && Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90,
            })
            hlsRef.current = hls
            hlsInstance = hls

            hls.loadSource(playableUrl)
            hls.attachMedia(video)

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setStatus("ready")
                setIsBuffering(false)

                if (initialProgressSeconds > 0) {
                    video.currentTime = initialProgressSeconds
                }
            })

            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
                const mappedTracks = data.audioTracks.map((t) => ({
                    index: t.id,
                    language: t.lang || "und",
                    title: t.name || t.lang || `Audio ${t.id}`,
                }))
                setAudioTracks(mappedTracks.length > 0 ? mappedTracks : (backendTracks?.audioTracks || []))
                setActiveAudioIndex(hls.audioTrack)
            })

            hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
                const mappedSubs = data.subtitleTracks.map((t, i) => ({
                    index: i,
                    language: t.lang || "und",
                    title: t.name || t.lang || `Subtítulos ${i + 1}`,
                }))
                setSubtitleTracks(mappedSubs.length > 0 ? mappedSubs : (backendTracks?.subtitleTracks || []))
            })

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    console.error("Fatal HLS error:", data)
                    setStatus("error")
                    setErrorMsg(`Error fatal de reproducción HLS: ${data.details}`)
                    hls.destroy()
                }
            })
        } else {
            video.src = playableUrl
            video.load()

            video.addEventListener("canplay", handleCanPlay)
            video.addEventListener("error", handleNativeError)

            if (backendTracks) {
                Promise.resolve().then(() => {
                    setAudioTracks(backendTracks.audioTracks)
                    setSubtitleTracks(backendTracks.subtitleTracks)
                })
            }
        }

        return () => {
            if (hlsInstance) {
                hlsInstance.destroy()
                if (hlsRef.current === hlsInstance) {
                    hlsRef.current = null
                }
            }
            video.removeEventListener("canplay", handleCanPlay)
            video.removeEventListener("error", handleNativeError)
        }
    }, [playableUrl, backendTracks, initialProgressSeconds])

    // ── Jassub lifecycle ─────────────────────────────────────────────────────
    useEffect(() => {
        const video = videoRef.current
        if (!video || activeSubtitleIndex === null) {
            if (jassubRef.current) {
                jassubRef.current.destroy()
                jassubRef.current = null
                setIsJassubLoading(false)
            }
            return
        }

        const track = subtitleTracks[activeSubtitleIndex]
        if (!track?.url) {
            if (jassubRef.current) {
                jassubRef.current.destroy()
                jassubRef.current = null
                setIsJassubLoading(false)
            }
            return
        }

        const isAss = track.codec?.toLowerCase() === "ass" || track.codec?.toLowerCase() === "ssa"

        if (!isAss) {
            // Non-ASS subtitles — use native track, destroy jassub if active
            if (jassubRef.current) {
                jassubRef.current.destroy()
                jassubRef.current = null
                setIsJassubLoading(false)
            }
            return
        }

        // ASS subtitle: initialize jassub
        setIsJassubLoading(true)

        const initJassub = async () => {
            try {
                const res = await fetch(track.url!)
                const assContent = await res.text()

                if (jassubRef.current) {
                    jassubRef.current.destroy()
                    jassubRef.current = null
                }

                const jassub = new JASSUB({
                    video,
                    subContent: assContent,
                    workerUrl: "/jassub/jassub-worker.js",
                    wasmUrl: "/jassub/jassub-worker.wasm",
                    modernWasmUrl: "/jassub/jassub-worker-modern.wasm",
                    // Render directly onto the canvas overlay
                    canvas: canvasRef.current ?? undefined,
                    // Use lossy render for performance (looks fine at 60fps)
                    useOffscreen: true,
                    // Preserve aspect ratio
                    prescaleFactor: 1.0,
                    // Render at video resolution
                    width: video.videoWidth || 1920,
                    height: video.videoHeight || 1080,
                })

                jassubRef.current = jassub
                setIsJassubLoading(false)
            } catch (err) {
                console.error("jassub: Failed to initialize:", err)
                setIsJassubLoading(false)
            }
        }

        initJassub()

        return () => {
            if (jassubRef.current) {
                jassubRef.current.destroy()
                jassubRef.current = null
                setIsJassubLoading(false)
            }
        }
    }, [activeSubtitleIndex, subtitleTracks])

    // Update jassub canvas size when video dimensions change
    useEffect(() => {
        const video = videoRef.current
        if (!video || !jassubRef.current) return

        const updateCanvasSize = () => {
            if (canvasRef.current && video.videoWidth > 0) {
                canvasRef.current.width = video.videoWidth
                canvasRef.current.height = video.videoHeight
                canvasRef.current.style.width = "100%"
                canvasRef.current.style.height = "100%"
            }
        }

        video.addEventListener("resize", updateCanvasSize)
        updateCanvasSize()

        return () => video.removeEventListener("resize", updateCanvasSize)
    }, [])

    // Controls visibility timer trigger
    const triggerControlsVisibility = () => {
        setControlsVisible(true)
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current)
        }
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) {
                setControlsVisible(false)
            }
        }, 3000)
    }

    useEffect(() => {
        Promise.resolve().then(() => {
            triggerControlsVisibility()
        })
        return () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
        }
    }, [isPlaying])

    // Play / Pause core toggle
    const togglePlay = () => {
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
    }

    // Seek core handling
    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current
        if (!video) return
        const val = parseFloat(e.target.value)
        video.currentTime = val
        triggerControlsVisibility()
    }

    // Forward / Backward skip
    const skipTime = (amount: number) => {
        const video = videoRef.current
        if (!video) return
        video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + amount))
        triggerControlsVisibility()
    }

    // 85-second skip for anime openings
    const skipOpening = () => {
        const video = videoRef.current
        if (!video) return
        video.currentTime = Math.min(video.duration, video.currentTime + 85)
        triggerControlsVisibility()
    }

    // Volume Handling
    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current
        if (!video) return
        const val = parseFloat(e.target.value)
        video.volume = val
        setVolume(val)
        setIsMuted(val === 0)
        video.muted = val === 0
    }

    const toggleMute = () => {
        const video = videoRef.current
        if (!video) return
        const nextMute = !isMuted
        video.muted = nextMute
        setIsMuted(nextMute)
    }

    // Track selectors
    const onSelectAudio = (track: AudioTrack) => {
        if (hlsRef.current) {
            hlsRef.current.audioTrack = track.index
            setActiveAudioIndex(track.index)
        }
    }

    const onSelectSubtitle = (track: SubtitleTrack | null) => {
        if (track === null) {
            // Destroy jassub if active, handled by the jassub lifecycle effect
            setActiveSubtitleIndex(null)
            if (hlsRef.current) {
                hlsRef.current.subtitleTrack = -1
            }
        } else {
            if (hlsRef.current) {
                hlsRef.current.subtitleTrack = track.index
            }
            setActiveSubtitleIndex(track.index)
        }
    }

    // Fullscreen toggler
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

    // Sync fullscreen state
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement))
        }
        document.addEventListener("fullscreenchange", handleFullscreenChange)
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }, [])

    // Skip Intro execution
    const handleSkipIntro = () => {
        const video = videoRef.current
        if (!video) return
        video.currentTime = skipTimes?.op?.endTime ?? skipTimes?.ed?.endTime ?? 120
        setShowSkipIntro(false)
    }

    // Global Key Bindings
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT" || document.activeElement?.tagName === "TEXTAREA") {
                return
            }

            switch (e.key.toLowerCase()) {
                case " ":
                case "k":
                    e.preventDefault()
                    togglePlay()
                    break
                case "arrowleft":
                case "j":
                    e.preventDefault()
                    e.shiftKey ? skipTime(-10) : skipTime(-5)
                    break
                case "arrowright":
                case "l":
                    e.preventDefault()
                    e.shiftKey ? skipOpening() : skipTime(5)
                    break
                case "arrowup":
                    e.preventDefault()
                    const videoUp = videoRef.current
                    if (videoUp) {
                        const newVol = Math.min(videoUp.volume + 0.1, 1)
                        videoUp.volume = newVol
                        setVolume(newVol)
                        setIsMuted(false)
                        videoUp.muted = false
                    }
                    break
                case "arrowdown":
                    e.preventDefault()
                    const videoDown = videoRef.current
                    if (videoDown) {
                        const newVol = Math.max(videoDown.volume - 0.1, 0)
                        videoDown.volume = newVol
                        setVolume(newVol)
                        setIsMuted(newVol === 0)
                        videoDown.muted = newVol === 0
                    }
                    break
                case "m":
                    e.preventDefault()
                    toggleMute()
                    break
                case "f":
                    e.preventDefault()
                    toggleFullscreen()
                    break
                case "s":
                    if (showSkipIntro) {
                        e.preventDefault()
                        handleSkipIntro()
                    }
                    break
                case "n":
                    if (showNextEpisode && onNextEpisode) {
                        e.preventDefault()
                        onNextEpisode()
                    }
                    break
                case "escape":
                    if (isFullscreen) {
                        toggleFullscreen()
                    } else {
                        onClose()
                    }
                    break
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [isPlaying, isMuted, volume, isFullscreen, showSkipIntro, showNextEpisode, onNextEpisode])

    // Video Event Handlers
    const handleTimeUpdate = () => {
        const video = videoRef.current
        if (!video) return

        const curr = video.currentTime
        const total = video.duration

        // 1. Direct Style Injection for high-perf bypass of React state re-renders
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

        // 2. Throttle WATCH progress updates to server (every 10 seconds via HTTP)
        if (onProgress && Math.abs(curr - lastReportedTimeRef.current) >= 10) {
            onProgress(curr)
            lastReportedTimeRef.current = curr
        }

        // 3. Auto-save to continuity via tracking hook (>=85% completion, fires once)
        onTrackingProgress(curr, total)

        // 4. WebSocket heartbeat every 5 seconds
        const now = Date.now()
        if (now - lastSentHeartbeatRef.current >= 5000) {
            sendHeartbeat(curr, total)
            lastSentHeartbeatRef.current = now
        }

        // 5. AniSkip-based intro overlay
        if (skipTimes?.op) {
            const { startTime, endTime } = skipTimes.op
            const inOpWindow = curr >= startTime && curr < endTime
            if (inOpWindow !== showSkipIntro) setShowSkipIntro(inOpWindow)
            if (inOpWindow) {
                setSkipRemainingSeconds(Math.ceil(endTime - curr))
                setSkipLabel("SALTAR INTRO")
            }
        } else if (skipTimes?.ed) {
            const { startTime, endTime } = skipTimes.ed
            const inEdWindow = curr >= startTime && curr < endTime
            if (inEdWindow !== showSkipIntro) setShowSkipIntro(inEdWindow)
            if (inEdWindow) {
                setSkipRemainingSeconds(Math.ceil(endTime - curr))
                setSkipLabel("SALTAR CRÉDITOS")
            }
        } else {
            // Fallback: show between 30s and 120s if no AniSkip data
            const fallback = curr >= 30 && curr <= 120
            if (fallback !== showSkipIntro) setShowSkipIntro(fallback)
            if (fallback) {
                setSkipRemainingSeconds(Math.ceil(120 - curr))
                setSkipLabel("SALTAR INTRO")
            }
        }

        // 6. AniSkip ED detection for early next-episode overlay trigger
        const ed = skipTimes?.ed
        const edTriggered = ed ? curr >= ed.startTime : false

        // 7. Dynamic next episode overlay trigger
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
    }

    // Marathon countdown timer effect
    useEffect(() => {
        if (showNextEpisode && countdownSeconds > 0 && isPlaying) {
            nextEpisodeTimerRef.current = setTimeout(() => {
                setCountdownSeconds((c) => c - 1)
            }, 1000)
        } else if (showNextEpisode && countdownSeconds === 0 && marathonMode && onNextEpisode) {
            onNextEpisode()
        }

        return () => {
            if (nextEpisodeTimerRef.current) clearTimeout(nextEpisodeTimerRef.current)
        }
    }, [showNextEpisode, countdownSeconds, isPlaying, marathonMode, onNextEpisode])

    // Calculate percentage remaining for auto-marathon progress bar
    const remainingProgress = useMemo(() => {
        return (countdownSeconds / 15) * 100
    }, [countdownSeconds])

    return (
        <div
            ref={containerRef}
            onMouseMove={triggerControlsVisibility}
            onMouseLeave={() => setControlsVisible(false)}
            className={cn(
                "fixed inset-0 z-[10000] w-screen h-screen bg-black flex flex-col items-center justify-center overflow-hidden font-sans",
                !controlsVisible && isPlaying ? "cursor-none" : "cursor-default"
            )}
        >
            {/* HTML5 Native Video Tag */}
            <video
                ref={videoRef}
                onClick={togglePlay}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
                onTimeUpdate={handleTimeUpdate}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => setIsBuffering(false)}
                className={cn(
                    "w-full h-full object-contain bg-black z-0",
                    jassubRef.current ? "opacity-100" : ""
                )}
                playsInline
            />

            {/* Jassub Canvas Overlay for ASS Subtitle Rendering */}
            <canvas
                ref={canvasRef}
                className={cn(
                    "absolute inset-0 w-full h-full pointer-events-none z-[1]",
                    jassubRef.current ? "block" : "hidden"
                )}
            />

            {/* Backdrop Shading for readability (Top & Bottom Gradual Vignette) */}
            <div
                className={cn(
                    "absolute inset-0 pointer-events-none transition-opacity duration-300 z-10",
                    controlsVisible ? "opacity-100" : "opacity-0"
                )}
            >
                <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-black/80 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            </div>

            {/* Status & Buffering Overlays */}
            <LoadingErrorOverlay
                status={status}
                errorMsg={errorMsg}
                streamType={props.streamType || "local"}
                isBuffering={isBuffering}
                onClose={onClose}
            />

            {/* Play/Pause Central Flash Animation */}
            <CenterPlayFlash flash={flash} />

            {/* Skip Intro Overlay Trigger */}
            <SkipIntroOverlay
                show={showSkipIntro}
                onSkip={handleSkipIntro}
                skipLabel={skipLabel}
                remainingSeconds={skipRemainingSeconds}
                shortcutKey="S"
            />

            {/* Next Episode Overlay Trigger */}
            <NextEpisodeOverlay
                show={showNextEpisode}
                marathonMode={marathonMode}
                countdownSeconds={countdownSeconds}
                nextEpisodeTitle="Siguiente Episodio"
                nextEpisodeNumber={episodeNumber ? episodeNumber + 1 : undefined}
                onNext={onNextEpisode || (() => {})}
                duration={duration}
                remainingProgress={remainingProgress}
            />

            {/* Modular Topbar */}
            <div
                className={cn(
                    "absolute top-0 inset-x-0 z-20 pointer-events-none transition-all duration-300",
                    controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
                )}
            >
                <PlayerTopBar
                    title={title}
                    episodeLabel={episodeLabel}
                    onClose={onClose}
                />
            </div>

            {/* Modular Bottombar & Settings */}
            <div
                className={cn(
                    "absolute bottom-0 inset-x-0 z-20 pointer-events-none transition-all duration-300",
                    controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}
            >
                <PlayerBottomBar
                    duration={duration}
                    insights={[]}
                    progressBarRef={progressBarRef}
                    progressInputRef={progressInputRef}
                    handleSeek={handleSeek}
                    isPlaying={isPlaying}
                    togglePlay={togglePlay}
                    skipTime={skipTime}
                    isMuted={isMuted}
                    toggleMute={toggleMute}
                    volume={volume}
                    handleVolume={handleVolume}
                    timeTextRef={timeTextRef}
                    audioTracks={audioTracks}
                    activeAudioIndex={activeAudioIndex}
                    onSelectAudio={onSelectAudio}
                    subtitleTracks={subtitleTracks}
                    activeSubtitleIndex={activeSubtitleIndex}
                    onSelectSubtitle={onSelectSubtitle}
                    isJassubLoading={isJassubLoading}
                    episodeSources={episodeSources}
                    activeStreamUrl={playableUrl}
                    handleSourceSwitch={() => {}}
                    isFullscreen={isFullscreen}
                    toggleFullscreen={toggleFullscreen}
                    settingsOpen={isSettingsOpen}
                    onToggleSettings={() => setIsSettingsOpen(v => !v)}
                />
            </div>
        </div>
    )
}
