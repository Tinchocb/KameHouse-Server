/**
 * VideoPlayerModal
 *
 * Full-screen modal video player powered by HLS.js.
 * - Supports HLS streams (transcode / optimized) and direct MP4/MKV via native <video>
 * - Immersive premium Netflix-style UI with custom controls.
 * - JASSUB WASM renderer for complex ASS/SSA anime subtitles (no video reload on swap).
 * - Audio and subtitle track selection via PlayerSettingsMenu gear overlay.
 */

import React, { useEffect, useRef, useCallback, useState } from "react"
import Hls from "hls.js"
import { Loader2, AlertTriangle } from "lucide-react"
import { FaPlay, FaPause, FaForward, FaBackward, FaExpand, FaCompress, FaVolumeUp, FaVolumeMute } from "react-icons/fa"
import { FiX } from "react-icons/fi"
import { cn } from "@/components/ui/core/styling"
import type { Mediastream_StreamType } from "@/api/generated/types"
import { useUpdateContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"
import { useGetAddonSubtitles } from "@/api/hooks/addon-subtitles.hooks"
import { usePlaybackTelemetry } from "@/hooks/usePlaybackTelemetry"
import { useJassub } from "@/hooks/useJassub"
import { PlayerSettingsMenu } from "@/components/ui/PlayerSettingsMenu"
import type { AudioTrack, SubtitleTrack, StreamTrackInfo } from "@/components/ui/track-types"

export interface VideoPlayerModalProps {
    streamUrl: string
    streamType: Mediastream_StreamType
    title?: string
    episodeLabel?: string
    mediaId?: number
    episodeNumber?: number
    /** If true, the stream URL points to an external CDN (e.g. Debrid). Enables crossOrigin. */
    isExternalStream?: boolean
    /**
     * Track metadata for the active stream.
     *
     * Fetch this from GET /api/v1/mediastream/track-info?streamId=<id> immediately
     * after the stream starts. Pass the response here to populate the settings menu.
     *
     * For HLS streams, audio tracks are ALSO detected automatically from the HLS
     * manifest via `Hls.Events.AUDIO_TRACKS_UPDATED`, so this prop is optional
     * for audio — but it's required for subtitle tracks since those are not in
     * the HLS manifest (they come from the MKV container).
     */
    trackInfo?: StreamTrackInfo
    onClose: () => void
}

export function VideoPlayerModal({
    streamUrl,
    streamType,
    title,
    episodeLabel,
    mediaId,
    episodeNumber,
    isExternalStream = false,
    trackInfo,
    onClose,
}: VideoPlayerModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const hlsRef = useRef<Hls | null>(null)
    // Canvas layered over the <video> — JASSUB renders ASS subtitles here.
    const subtitleCanvasRef = useRef<HTMLCanvasElement>(null)

    // Status
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
    const [errorMsg, setErrorMsg] = useState<string>("")

    // Custom Controls State
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)
    const [isMuted, setIsMuted] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)

    // Visibility
    const [isControlsVisible, setIsControlsVisible] = useState(true)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Touch / double-tap skip
    const lastTapRef = useRef<{ time: number; x: number } | null>(null)
    const [tapFeedback, setTapFeedback] = useState<"left" | "right" | null>(null)
    const tapFeedbackTimerRef = useRef<NodeJS.Timeout | null>(null)

    // ── Track selection state ──────────────────────────────────────────────────
    // Audio tracks — seeded from the trackInfo prop; HLS streams also auto-detect
    // them from the manifest via AUDIO_TRACKS_UPDATED (see HLS effect below).
    const [audioTracks, setAudioTracks] = useState<AudioTrack[]>(trackInfo?.audioTracks ?? [])
    const [activeAudioIndex, setActiveAudioIndex] = useState<number>(0)

    // Subtitle tracks — always sourced from the trackInfo prop (MKV container metadata).
    const [subtitleTracks] = useState<SubtitleTrack[]>(trackInfo?.subtitleTracks ?? [])
    const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number | null>(
        // Default to the container's default-flagged track if present.
        trackInfo?.subtitleTracks.find((t) => t.default)?.index ?? null
    )

    // ── JASSUB hook ───────────────────────────────────────────────────────────
    // Initialises the WASM worker and wires it to the canvas + video elements.
    const {
        loadTrack: loadSubtitleTrack,
        clearTrack: clearSubtitleTrack,
        isLoadingSubtitle,
    } = useJassub({
        canvasRef: subtitleCanvasRef,
        videoRef,
        // Load the default subtitle track on first render if one is flagged.
        initialSubtitleUrl:
            subtitleTracks.find((t) => t.index === activeSubtitleIndex)?.url ?? null,
    })

    // Addon Subtitles
    const { data: addonSubtitles } = useGetAddonSubtitles("series", mediaId)

    // Playback Telemetry (debounced 10s + onEnded)
    const telemetry = usePlaybackTelemetry({
        mediaId,
        episodeNumber,
        totalEpisodes: 0,
    })

    // Continuity Tracking
    const { mutate: updateContinuity } = useUpdateContinuityWatchHistoryItem()

    const saveContinuity = useCallback((time: number, total: number) => {
        if (!mediaId || !episodeNumber || total === 0) return
        updateContinuity({
            options: {
                mediaId,
                episodeNumber,
                currentTime: time,
                duration: total,
                kind: "mediastream",
            }
        })
    }, [mediaId, episodeNumber, updateContinuity])

    // Close on Escape key
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (videoRef.current) {
                    saveContinuity(videoRef.current.currentTime, videoRef.current.duration)
                }
                onClose()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose, saveContinuity])

    // Prevent body scroll
    useEffect(() => {
        document.body.style.overflow = "hidden"
        return () => { document.body.style.overflow = "" }
    }, [])

    // HLS Logic
    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        setStatus("loading")
        const isHls = streamType === "transcode" || streamType === "optimized"

        if (isHls) {
            if (Hls.isSupported()) {
                const hls = new Hls({ startLevel: -1, enableWorker: true, lowLatencyMode: false })
                hlsRef.current = hls
                hls.loadSource(streamUrl)
                hls.attachMedia(video)
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    setStatus("ready")
                    video.play().catch(() => { })
                })
                hls.on(Hls.Events.ERROR, (_evt, data) => {
                    if (data.fatal) {
                        setStatus("error")
                        setErrorMsg(`Error HLS: ${data.details}`)
                        hls.destroy()
                    }
                })
                /**
                 * AUDIO_TRACKS_UPDATED fires after the manifest is parsed and
                 * whenever the available audio tracks change. We map HLS.js
                 * AudioTrack objects → our AudioTrack interface and merge them
                 * with any tracks already provided via the trackInfo prop.
                 *
                 * HLS.js AudioTrack fields:
                 *   { id, name, lang, default, ... }
                 */
                hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_evt, data) => {
                    const hlsTracks: AudioTrack[] = data.audioTracks.map((t, idx) => ({
                        index: idx,
                        language: t.lang ?? "und",
                        title: t.name ?? t.lang ?? `Track ${idx + 1}`,
                        default: t.default ?? idx === 0,
                    }))
                    // Prefer trackInfo (has codec/channels); fall back to HLS discovery.
                    if (trackInfo?.audioTracks && trackInfo.audioTracks.length > 0) return
                    setAudioTracks(hlsTracks)
                })
            } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = streamUrl
                video.addEventListener("canplay", () => setStatus("ready"), { once: true })
                video.play().catch(() => { })
            } else {
                setStatus("error")
                setErrorMsg("Navegador no soportado.")
            }
        } else {
            video.src = streamUrl
            video.addEventListener("canplay", () => setStatus("ready"), { once: true })
            video.addEventListener("error", () => {
                setStatus("error")
                setErrorMsg("Fallo al reproducir archivo directo.")
            }, { once: true })
            video.play().catch(() => { })
        }

        const updateTime = () => setCurrentTime(video.currentTime)
        const updateDuration = () => setDuration(video.duration)
        const onPlay = () => setIsPlaying(true)
        const onPause = () => {
            setIsPlaying(false)
            if (video.duration > 0) saveContinuity(video.currentTime, video.duration)
        }

        video.addEventListener('timeupdate', updateTime)
        video.addEventListener('loadedmetadata', updateDuration)
        video.addEventListener('play', onPlay)
        video.addEventListener('pause', onPause)

        return () => {
            saveContinuity(video.currentTime, video.duration)
            video.removeEventListener('timeupdate', updateTime)
            video.removeEventListener('loadedmetadata', updateDuration)
            video.removeEventListener('play', onPlay)
            video.removeEventListener('pause', onPause)
            hlsRef.current?.destroy()
            hlsRef.current = null
            video.src = ""
        }
    }, [streamUrl, streamType, saveContinuity])

    // ── Audio track selection handler ─────────────────────────────────────────
    const handleSelectAudio = useCallback((track: AudioTrack) => {
        setActiveAudioIndex(track.index)

        // ── HLS.js path ──
        // For HLS streams, tell HLS.js to switch the audio rendition.
        // HLS.js handles the segment fetching and codec switch automatically.
        if (hlsRef.current) {
            hlsRef.current.audioTrack = track.index
            return
        }

        // ── Native HTMLVideoElement AudioTrackList path ──
        // For direct MKV/MP4 streams, the browser exposes AudioTrackList on the
        // <video> element. We enable only the chosen track.
        // NOTE: Chrome/Edge support this; Firefox has partial support; Safari is full.
        const video = videoRef.current
        if (video && "audioTracks" in video) {
            const nativeTracks = (video as HTMLVideoElement & { audioTracks: AudioTrackList }).audioTracks
            for (let i = 0; i < nativeTracks.length; i++) {
                // Cast via `unknown` first to satisfy TS — the native AudioTrack spec
                // has an `enabled` property but it is not exposed in lib.dom.d.ts.
                ; ((nativeTracks[i] as unknown) as { enabled: boolean }).enabled =
                    i === track.index
            }
        }
    }, [])

    // ── Subtitle track selection handler ─────────────────────────────────────
    const handleSelectSubtitle = useCallback(
        (track: SubtitleTrack | null) => {
            if (track === null) {
                // User chose "Off" — clear the JASSUB canvas.
                setActiveSubtitleIndex(null)
                clearSubtitleTrack()
                return
            }

            setActiveSubtitleIndex(track.index)

            if (track.codec === "ass" || track.codec === "ssa") {
                // ── ASS/SSA path: use JASSUB WASM renderer ──
                // The track URL points to the backend's subtitle extraction endpoint:
                //   GET /api/v1/mediastream/subtitle?streamId=X&trackIndex=N
                // JASSUB fetches the raw .ass text and calls libass to render it.
                // The video does NOT reload — only the canvas content changes.
                if (track.url) {
                    void loadSubtitleTrack(track.url)
                }
            } else if (track.url) {
                // ── VTT/SRT path: use browser's native TextTrack ──
                // For non-ASS subtitle formats served as WebVTT, disable JASSUB
                // (it can't render those) and add a native <track> element instead.
                clearSubtitleTrack()
                const video = videoRef.current
                if (!video) return
                const existing = Array.from(video.textTracks)
                existing.forEach((t) => { t.mode = "disabled" })
                // The <track> element for external addon subtitles already exists in the JSX;
                // for MKV-native non-ASS tracks the parent can inject them dynamically.
                const nativeTrack = Array.from(video.textTracks).find(
                    (t) => t.language === track.language
                )
                if (nativeTrack) nativeTrack.mode = "showing"
            }
        },
        [loadSubtitleTrack, clearSubtitleTrack]
    )

    // Controls Logic
    const togglePlay = () => {
        if (!videoRef.current) return
        if (isPlaying) videoRef.current.pause()
        else videoRef.current.play()
    }

    const skipTime = (amount: number) => {
        if (!videoRef.current) return
        let newTime = videoRef.current.currentTime + amount
        if (newTime < 0) newTime = 0
        if (newTime > duration) newTime = duration
        videoRef.current.currentTime = newTime
        setCurrentTime(newTime)
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!videoRef.current) return
        const time = Number(e.target.value)
        videoRef.current.currentTime = time
        setCurrentTime(time)
    }

    const toggleMute = () => {
        if (!videoRef.current) return
        videoRef.current.muted = !isMuted
        setIsMuted(!isMuted)
    }

    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!videoRef.current) return
        const val = Number(e.target.value)
        videoRef.current.volume = val
        setVolume(val)
        if (val === 0) {
            setIsMuted(true)
            videoRef.current.muted = true
        } else if (isMuted) {
            setIsMuted(false)
            videoRef.current.muted = false
        }
    }

    const toggleFullscreen = () => {
        if (!containerRef.current) return
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(() => { })
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    useEffect(() => {
        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
        document.addEventListener('fullscreenchange', onFsChange)
        return () => document.removeEventListener('fullscreenchange', onFsChange)
    }, [])

    // Autohide controls logic (Throttled for Performance)
    const lastMouseMovedRef = useRef<number>(0)
    const showControlsTemporarily = useCallback(() => {
        const now = Date.now()
        // Throttle to max 1 update per 200ms to avoid DOM trashing on mouse move
        if (now - lastMouseMovedRef.current < 200) return
        lastMouseMovedRef.current = now

        setIsControlsVisible(true)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)

        timeoutRef.current = setTimeout(() => {
            if (videoRef.current && !videoRef.current.paused) {
                setIsControlsVisible(false)
            }
        }, 3000)
    }, [])

    const handleMouseLeave = () => {
        if (videoRef.current && !videoRef.current.paused) {
            setIsControlsVisible(false)
        }
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }

    useEffect(() => {
        showControlsTemporarily()
        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
    }, [isPlaying, showControlsTemporarily])

    // handleTap — called on touch/click over the video area.
    // Single tap: show/hide controls.
    // Double-tap left third: rewind 10s, right third: forward 10s.
    const handleTap = useCallback((clientX: number, containerWidth: number) => {
        const now = Date.now()
        const last = lastTapRef.current
        const DOUBLE_TAP_MS = 300

        if (last && now - last.time < DOUBLE_TAP_MS) {
            // Double tap detected
            lastTapRef.current = null
            const zone = clientX / containerWidth
            if (zone < 0.4) {
                skipTime(-10)
                setTapFeedback("left")
            } else if (zone > 0.6) {
                skipTime(10)
                setTapFeedback("right")
            } else {
                // Center double tap — toggle play
                togglePlay()
            }
            if (tapFeedbackTimerRef.current) clearTimeout(tapFeedbackTimerRef.current)
            tapFeedbackTimerRef.current = setTimeout(() => setTapFeedback(null), 600)
        } else {
            lastTapRef.current = { time: now, x: clientX }
            // Force reset lastMouseMovedRef to ensure tap always triggers visible state
            lastMouseMovedRef.current = 0 
            showControlsTemporarily()
        }
    }, [skipTime, togglePlay, showControlsTemporarily])

    const formatTime = (secs: number) => {
        if (!secs || isNaN(secs)) return "00:00"
        const m = Math.floor(secs / 60)
        const s = Math.floor(secs % 60)
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-[10000] bg-black w-screen h-screen flex items-center justify-center font-sans select-none overflow-hidden"
            onMouseMove={showControlsTemporarily}
            onMouseLeave={handleMouseLeave}
            onClick={showControlsTemporarily}
            onTouchStart={(e) => {
                // onTouchStart used for quick responsiveness; handleTap handles the logic
                const touch = e.changedTouches[0]
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                handleTap(touch.clientX - rect.left, rect.width)
            }}
        >
            {/* Loading / Error States */}
            {status === "loading" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 text-white">
                    <Loader2 className="w-14 h-14 text-orange-500 animate-spin drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]" />
                    <p className="font-bold tracking-widest uppercase text-sm opacity-80 animate-pulse">
                        {streamType === "transcode" ? "Preparando Transmisión" : "Estableciendo Conexión"}
                    </p>
                </div>
            )}

            {status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 px-6 text-center text-white bg-black/90">
                    <AlertTriangle className="w-16 h-16 text-orange-500" />
                    <h3 className="font-black text-2xl tracking-wide">Transmisión Caída</h3>
                    <p className="text-gray-400 max-w-md">{errorMsg}</p>
                    <button onClick={onClose} className="mt-4 px-8 py-3 rounded-md bg-orange-500 hover:bg-orange-600 font-bold transition-all shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                        Regresar
                    </button>
                </div>
            )}

            {/* Video Element */}
            <video
                ref={videoRef}
                onClick={togglePlay}
                className={cn(
                    "w-full h-full object-contain bg-black outline-none",
                    status !== "ready" && "opacity-0"
                )}
                // Enable CORS for external CDN streams (Debrid redirects)
                crossOrigin={isExternalStream || (addonSubtitles && addonSubtitles.length > 0) ? "anonymous" : undefined}
                // Ocultar controles nativos
                controls={false}
                // Playback telemetry
                onTimeUpdate={telemetry.handleTimeUpdate}
                onEnded={telemetry.handleEnded}
            >
                {/* Addon subtitle tracks (external WebVTT sources from addon system) */}
                {addonSubtitles?.map((sub, idx) => (
                    <track
                        key={sub.id || idx}
                        kind="subtitles"
                        src={sub.url}
                        srcLang={sub.lang}
                        label={sub.lang.toUpperCase()}
                        default={idx === 0}
                    />
                ))}
            </video>

            {/*
             * JASSUB subtitle canvas — sits directly above the <video> element.
             */}
            <canvas
                ref={subtitleCanvasRef}
                aria-hidden="true"
                className={cn(
                    "absolute inset-0 w-full h-full",
                    "pointer-events-none z-[1]",
                    // Hidden while stream is loading so we don't see a blank canvas flash
                    status !== "ready" && "opacity-0"
                )}
            />

            {/* UI Overlay — Cinematic VOD Style */}
            <div className={cn(
                "absolute inset-0 flex flex-col justify-between pointer-events-none transition-opacity duration-300 ease-out z-[10]",
                isControlsVisible || !isPlaying ? "opacity-100" : "opacity-0"
            )}>
                {/* Top Bar — Gradient Mask */}
                <div className="absolute top-0 inset-x-0 pt-6 pb-24 px-6 md:px-10 flex flex-col md:flex-row md:items-start justify-between pointer-events-auto bg-gradient-to-b from-black/70 to-transparent">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                        <button
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 text-white/70 hover:text-white transition-colors group bg-black/20 hover:bg-black/40 rounded-full backdrop-blur-md"
                        >
                            <FiX className="w-6 h-6 drop-shadow-md" />
                        </button>
                        
                        <div className="flex flex-col drop-shadow-lg max-w-lg mt-2 md:mt-0">
                            <span className="text-white font-black text-xl md:text-2xl leading-tight tracking-wide">{title || "Reproduciendo"}</span>
                            {episodeLabel && (
                                <span className="text-zinc-300 font-bold tracking-widest uppercase text-xs mt-1 md:mt-0.5">{episodeLabel}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Center click area (to pause/play on video tap) — disabled in favour of onTouchStart on container */}
                <div className="flex-1 pointer-events-auto cursor-pointer hidden md:block" onClick={(e) => { e.stopPropagation(); togglePlay(); }} />

                {/* Tap Feedback Overlay (mobile skip animation) */}
                {tapFeedback && (
                    <div className={cn(
                        "absolute inset-y-0 flex items-center justify-center pointer-events-none z-20 transition-opacity duration-300",
                        tapFeedback === "left" ? "left-0 w-1/3" : "right-0 w-1/3",
                        "bg-white/5 backdrop-blur-sm mx-4 my-24 rounded-3xl"
                    )}>
                        <div className="flex flex-col items-center gap-2 text-white/90">
                            {tapFeedback === "left" ? (
                                <>
                                    <FaBackward className="w-10 h-10 drop-shadow-xl" />
                                    <span className="text-sm font-black tracking-widest">-10s</span>
                                </>
                            ) : (
                                <>
                                    <FaForward className="w-10 h-10 drop-shadow-xl" />
                                    <span className="text-sm font-black tracking-widest">+10s</span>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Bottom Bar — Minimalist VOD layout */}
                <div className="absolute bottom-0 inset-x-0 flex flex-col pointer-events-auto bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-32 pb-6 px-6 md:px-10 select-none">
                    
                    {/* Minimalist Expanding Progress Timeline */}
                    <div className="relative w-full h-1 hover:h-2 md:h-1.5 md:hover:h-2.5 transition-all bg-white/20 group cursor-pointer flex items-center mb-6 rounded-full" onClick={(e) => { e.stopPropagation() }}>
                        <div
                            className="h-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)] transition-all ease-linear rounded-full rounded-r-none relative"
                            style={{ width: `${Math.max(0, Math.min(100, progressPercentage))}%` }}
                        >
                            {/* Hover Thumb Component */}
                            <div
                                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 md:w-4 md:h-4 bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,1)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                            />
                        </div>

                        {/* Dragging input */}
                        <input
                            type="range"
                            min={0}
                            max={duration || 100}
                            value={currentTime}
                            onChange={(e) => { e.stopPropagation(); handleSeek(e); }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-none"
                            style={{ height: "40px", top: "50%", transform: "translateY(-50%)" }}
                        />
                    </div>

                    {/* Bottom Controls Row */}
                    <div className="flex items-center justify-between w-full">

                        {/* Left Wing */}
                        <div className="flex items-center gap-4 md:gap-8">
                            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-white hover:text-orange-500 transition-colors drop-shadow-md min-w-[44px] min-h-[44px] flex items-center justify-center transform hover:scale-110">
                                {isPlaying ? <FaPause className="w-6 h-6 md:w-7 md:h-7" /> : <FaPlay className="w-6 h-6 md:w-7 md:h-7 ml-1" />}
                            </button>

                            <div className="hidden md:flex items-center gap-6">
                                <button onClick={(e) => { e.stopPropagation(); skipTime(-10); }} className="text-white/80 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                                    <FaBackward className="w-5 h-5" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); skipTime(10); }} className="text-white/80 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                                    <FaForward className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Volume Control */}
                            <div className="hidden md:flex items-center gap-3 group ml-2">
                                <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-white hover:text-zinc-300 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                                    {isMuted || volume === 0 ? <FaVolumeMute className="w-5 h-5" /> : <FaVolumeUp className="w-5 h-5" />}
                                </button>
                                <div className="w-0 group-hover:w-24 transition-all duration-300 overflow-hidden relative h-1.5 flex items-center bg-white/20 rounded-full cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                    <div className="absolute left-0 h-full bg-white rounded-full" style={{ width: `${isMuted ? 0 : volume * 100}%` }} />
                                    <input
                                        type="range"
                                        min={0} max={1} step={0.05}
                                        value={isMuted ? 0 : volume}
                                        onChange={(e) => { e.stopPropagation(); handleVolume(e); }}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-none"
                                    />
                                </div>
                            </div>

                        </div>

                        {/* Time indicator (Center on mobile, Left on Desktop) */}
                        <div className="flex-1 flex justify-center md:justify-start md:ml-6 items-center gap-1.5 text-zinc-300 text-xs md:text-sm font-bold tabular-nums tracking-widest select-none drop-shadow-md">
                            <span className="text-white">{formatTime(currentTime)}</span>
                            <span className="text-zinc-600">/</span>
                            <span className="text-zinc-400">{formatTime(duration)}</span>
                        </div>

                        {/* Right Wing: Settings, Fullscreen */}
                        <div className="flex items-center gap-2 md:gap-4">
                            <PlayerSettingsMenu
                                audioTracks={audioTracks}
                                activeAudioIndex={activeAudioIndex}
                                onSelectAudio={handleSelectAudio}
                                subtitleTracks={subtitleTracks}
                                activeSubtitleIndex={activeSubtitleIndex}
                                onSelectSubtitle={handleSelectSubtitle}
                                isLoadingSubtitle={isLoadingSubtitle}
                            />

                            <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white hover:text-zinc-300 transition-colors drop-shadow-md min-w-[44px] min-h-[44px] flex items-center justify-center ml-1 md:ml-4">
                                {isFullscreen ? <FaCompress className="w-5 h-5 md:w-6 md:h-6" /> : <FaExpand className="w-5 h-5 md:w-6 md:h-6" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
