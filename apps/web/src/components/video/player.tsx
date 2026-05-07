import React, { useState, useEffect, useRef, useMemo } from "react"
import Hls from "hls.js"
import { useRequestMediastreamMediaContainer } from "@/api/hooks/mediastream.hooks"
import { useUpdateContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"
import { useAniSkipTimes } from "@/api/hooks/aniskip.hooks"
import { Loader2, AlertTriangle } from "lucide-react"
import { cn } from "@/components/ui/core/styling"

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
    streamUrl: string // Path on disk (resolved via backend) or direct playable URL
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
    /** MAL ID for AniSkip integration — passed from series detail page when available */
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
    const hlsRef = useRef<Hls | null>(null)

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
    const [showNextEpisode, setShowNextEpisode] = useState(false)
    const [countdownSeconds, setCountdownSeconds] = useState(10)
    const [marathonMode] = useState(true)

    // Track state
    const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
    const [activeAudioIndex, setActiveAudioIndex] = useState(0)
    const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])
    const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number | null>(null)

    // Inactivity timeout ref
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const nextEpisodeTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Progress reporting throttle
    const lastReportedTimeRef = useRef(0)
    // 80% completion tracking — fires only once per episode
    const autoSavedAt80Ref = useRef(false)

    // ── AniSkip integration ──────────────────────────────────────────────────
    const { data: skipTimes } = useAniSkipTimes({
        malId: malId ?? null,
        episodeNumber: episodeNumber ?? null,
        episodeDuration: duration > 0 ? duration : undefined,
        enabled: !!(malId && episodeNumber),
    })

    // ── Continuity auto-save mutation ────────────────────────────────────────
    const { mutate: saveContinuity } = useUpdateContinuityWatchHistoryItem()

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
                
                // If initial progress is set, seek to it
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
            // Direct playback (e.g. mp4, webm or native Safari HLS)
            video.src = playableUrl
            video.load()

            video.addEventListener("canplay", handleCanPlay)
            video.addEventListener("error", handleNativeError)

            // Populate fallback tracks from backend metadata if available
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
        if (hlsRef.current) {
            if (track === null) {
                hlsRef.current.subtitleTrack = -1
                setActiveSubtitleIndex(null)
            } else {
                hlsRef.current.subtitleTrack = track.index
                setActiveSubtitleIndex(track.index)
            }
        } else {
            setActiveSubtitleIndex(track ? track.index : null)
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

    // Sync fullscreen state in case of Escape key exits
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement))
        }
        document.addEventListener("fullscreenchange", handleFullscreenChange)
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }, [])

    // Skip Intro execution — jumps to end of AniSkip OP interval if available, else 120s
    const handleSkipIntro = () => {
        const video = videoRef.current
        if (!video) return
        // Use precise AniSkip endTime if available, fallback to heuristic 120s
        video.currentTime = skipTimes?.op?.endTime ?? 120
        setShowSkipIntro(false)
    }

    // Global Key Bindings
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Avoid capturing key events when in a settings dropdown or text input
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
                    skipTime(-10)
                    break
                case "arrowright":
                case "l":
                    e.preventDefault()
                    skipTime(10)
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
                    // Skip intro shortcut
                    if (showSkipIntro) {
                        e.preventDefault()
                        handleSkipIntro()
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
    }, [isPlaying, isMuted, volume, isFullscreen, showSkipIntro])

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

        // 2. Throttle WATCH progress updates to server (every 10 seconds)
        if (onProgress && Math.abs(curr - lastReportedTimeRef.current) >= 10) {
            onProgress(curr)
            lastReportedTimeRef.current = curr
        }

        // 3. Auto-save to continuity at 80% completion (fires once per episode)
        if (
            !autoSavedAt80Ref.current &&
            total > 0 &&
            curr / total >= 0.8 &&
            mediaId &&
            episodeNumber
        ) {
            autoSavedAt80Ref.current = true
            saveContinuity({
                options: {
                    mediaId,
                    episodeNumber,
                    currentTime: curr,
                    duration: total,
                    kind: "mediastream",
                    filepath: playableUrl,
                },
            })
        }

        // 4. AniSkip-based intro overlay (replaces the old 30-120s heuristic)
        if (skipTimes?.op) {
            const { startTime, endTime } = skipTimes.op
            const inOpWindow = curr >= startTime && curr < endTime
            if (inOpWindow !== showSkipIntro) setShowSkipIntro(inOpWindow)
        } else {
            // Fallback: show between 30s and 120s if no AniSkip data
            const fallback = curr >= 30 && curr <= 120
            if (fallback !== showSkipIntro) setShowSkipIntro(fallback)
        }

        // 5. Dynamic next episode overlay trigger (appears when 30 seconds or less are left)
        if (total > 0 && total - curr <= 30 && hasNextEpisode) {
            if (!showNextEpisode) {
                setShowNextEpisode(true)
                setCountdownSeconds(15)
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
                className="w-full h-full object-contain bg-black z-0"
                playsInline
            />

            {/* Backdrop Shading for readability (Top & Bottom Gradual Vignette) */}
            <div
                className={cn(
                    "absolute inset-0 pointer-events-none transition-opacity duration-300 z-10",
                    controlsVisible ? "opacity-100" : "opacity-0"
                )}
            >
                {/* Top shading */}
                <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-black/80 to-transparent" />
                {/* Bottom shading */}
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
            />

            {/* Next Episode Overlay Trigger */}
            <NextEpisodeOverlay
                show={showNextEpisode}
                marathonMode={marathonMode}
                countdownSeconds={countdownSeconds}
                nextEpisodeTitle="Siguiente Episodio"
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
                    isJassubLoading={false}
                    episodeSources={episodeSources}
                    activeStreamUrl={playableUrl}
                    handleSourceSwitch={() => {}}
                    isFullscreen={isFullscreen}
                    toggleFullscreen={toggleFullscreen}
                />
            </div>
        </div>
    )
}
