import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import Hls from "hls.js"
import JASSUB from "jassub"
import { useAniSkipTimes } from "@/api/hooks/aniskip.hooks"
import { useAnimeTracking } from "@/api/hooks/useAnimeTracking"
import { useWebSocket } from "@/hooks/use-websocket"
import { getApiWebSocketUrl } from "@/api/client/server-url"
import { useMediastreamShutdownTranscodeStream } from "@/api/hooks/mediastream.hooks"
import { useAppStore } from "@/lib/store"
import { usePlayerProgressSync } from "@/api/hooks/usePlayerProgressSync"
import { useGetContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"
import type { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"

export interface PlayerCoreProps {
    playableUrl: string
    backendTracks?: {
        audioTracks: AudioTrack[]
        subtitleTracks: SubtitleTrack[]
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
}

export function usePlayerCore(props: PlayerCoreProps) {
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
    } = props

    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const hlsRef = useRef<Hls | null>(null)
    const jassubRef = useRef<any>(null)

    const progressBarRef = useRef<HTMLDivElement>(null)
    const progressInputRef = useRef<HTMLInputElement>(null)
    const timeTextRef = useRef<HTMLSpanElement>(null)

    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)
    const [isMuted, setIsMuted] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [controlsVisible, setControlsVisible] = useState(true)
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
    const [errorMsg, setErrorMsg] = useState("")
    const [isBuffering, setIsBuffering] = useState(false)
    const [flash, setFlash] = useState<"play" | "pause" | null>(null)

    const [showSkipIntro, setShowSkipIntro] = useState(false)
    const [skipRemainingSeconds, setSkipRemainingSeconds] = useState(0)
    const [skipLabel, setSkipLabel] = useState("SALTAR INTRO")
    const [showNextEpisode, setShowNextEpisode] = useState(false)
    const [countdownSeconds, setCountdownSeconds] = useState(10)
    const [marathonMode] = useState(true)

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
    const playbackRatePref = useAppStore(state => state.playbackRate)
    const setPlaybackRatePref = useAppStore(state => state.setPlaybackRate)
    const preferredAudioLang = useAppStore(state => state.preferredAudioLang)
    const setPreferredAudioLang = useAppStore(state => state.setPreferredAudioLang)
    const preferredSubtitleLang = useAppStore(state => state.preferredSubtitleLang)
    const setPreferredSubtitleLang = useAppStore(state => state.setPreferredSubtitleLang)

    const [showStats, setShowStats] = useState(false)
    const [statsData, setStatsData] = useState<any>(null)

    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const nextEpisodeTimerRef = useRef<NodeJS.Timeout | null>(null)
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

    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        // Handle Resume Logic
        if (historyData?.found && historyData.item?.episodeNumber === episodeNumber) {
            const time = historyData.item.currentTime
            if (time > 10) { // Only resume if more than 10 seconds in
                setResumeTime(time)
                setShowResume(true)
                // Auto-hide resume after 10 seconds
                setTimeout(() => setShowResume(false), 10000)
            }
        }

        Promise.resolve().then(() => {
            setStatus("loading")
            setIsBuffering(true)
        })

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

            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                setStatus("ready")
                setIsBuffering(false)

                const levels = data.levels.map((level, index) => ({
                    index,
                    label: level.name || `${level.height}p`,
                    height: level.height
                }))
                setHlsLevels(levels)

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

    useEffect(() => {
        const video = videoRef.current
        if (!video || activeSubtitleIndex === null) {
            if (jassubRef.current) {
                jassubRef.current.destroy()
                jassubRef.current = null
                Promise.resolve().then(() => {
                    setIsJassubLoading(false)
                    setIsJassubActive(false)
                })
            }
            return
        }

        const track = subtitleTracks[activeSubtitleIndex]
        if (!track?.url) {
            if (jassubRef.current) {
                jassubRef.current.destroy()
                jassubRef.current = null
                Promise.resolve().then(() => {
                    setIsJassubLoading(false)
                    setIsJassubActive(false)
                })
            }
            return
        }

        const isAss = track.codec?.toLowerCase() === "ass" || track.codec?.toLowerCase() === "ssa"

        if (!isAss) {
            if (jassubRef.current) {
                jassubRef.current.destroy()
                jassubRef.current = null
                Promise.resolve().then(() => {
                    setIsJassubLoading(false)
                    setIsJassubActive(false)
                })
            }
            return
        }

        Promise.resolve().then(() => {
            setIsJassubLoading(true)
        })

        const initJassub = async () => {
            try {
                const res = await fetch(track.url!)
                const assContent = await res.text()

                if (jassubRef.current) {
                    jassubRef.current.destroy()
                    jassubRef.current = null
                    setIsJassubActive(false)
                }

                const jassub = new JASSUB({
                    video,
                    subContent: assContent,
                    workerUrl: "/jassub/jassub-worker.js",
                    wasmUrl: "/jassub/jassub-worker.wasm",
                    modernWasmUrl: "/jassub/jassub-worker-modern.wasm",
                    canvas: canvasRef.current ?? undefined,
                    useOffscreen: true,
                    prescaleFactor: 1.0,
                    width: video.videoWidth || 1920,
                    height: video.videoHeight || 1080,
                })

                jassubRef.current = jassub
                setIsJassubActive(true)
                setIsJassubLoading(false)
            } catch (err) {
                console.error("jassub: Failed to initialize:", err)
                setIsJassubLoading(false)
                setIsJassubActive(false)
            }
        }

        initJassub()

        return () => {
            if (jassubRef.current) {
                jassubRef.current.destroy()
                jassubRef.current = null
                setIsJassubLoading(false)
                setIsJassubActive(false)
            }
        }
    }, [activeSubtitleIndex, subtitleTracks])

    // Auto-select preferred tracks
    useEffect(() => {
        if (audioTracks.length > 0) {
            const preferred = audioTracks.find(t => t.language === preferredAudioLang)
            if (preferred && activeAudioIndex !== preferred.index) {
                onSelectAudio(preferred)
            }
        }
    }, [audioTracks, preferredAudioLang])

    useEffect(() => {
        if (subtitleTracks.length > 0) {
            const preferred = subtitleTracks.find(t => t.language === preferredSubtitleLang)
            if (preferred && activeSubtitleIndex !== preferred.index) {
                onSelectSubtitle(preferred)
            }
        }
    }, [subtitleTracks, preferredSubtitleLang])

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

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current
        if (!video) return
        const val = parseFloat(e.target.value)
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

    const skipTime = (amount: number) => {
        const video = videoRef.current
        if (!video) return
        video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + amount))
        triggerControlsVisibility()
    }

    const skipOpening = () => {
        const video = videoRef.current
        if (!video) return
        video.currentTime = Math.min(video.duration, video.currentTime + 85)
        triggerControlsVisibility()
    }

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


    const onSelectAudio = (track: AudioTrack) => {
        if (hlsRef.current) {
            hlsRef.current.audioTrack = track.index
            setActiveAudioIndex(track.index)
        }
        if (track.language) {
            setPreferredAudioLang(track.language)
        }
    }

    const onSelectSubtitle = (track: SubtitleTrack | null) => {
        if (track === null) {
            setActiveSubtitleIndex(null)
            if (hlsRef.current) {
                hlsRef.current.subtitleTrack = -1
            }
            // Optional: maybe don't clear preference if they just want to turn it off once
        } else {
            if (hlsRef.current) {
                hlsRef.current.subtitleTrack = track.index
            }
            setActiveSubtitleIndex(track.index)
            if (track.language) {
                setPreferredSubtitleLang(track.language)
            }
        }
    }

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
        if (video && playbackRatePref !== 1) {
            video.playbackRate = playbackRatePref
        }
    }, [status]) // Reset/Apply rate when video is ready

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

    const handleSkipIntro = () => {
        const video = videoRef.current
        if (!video) return
        video.currentTime = skipTimes?.op?.endTime ?? skipTimes?.ed?.endTime ?? 120
        setShowSkipIntro(false)
    }

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
                    if (e.shiftKey) {
                        skipTime(-10)
                    } else {
                        skipTime(-5)
                    }
                    break
                case "arrowright":
                case "l":
                    e.preventDefault()
                    if (e.shiftKey) {
                        skipOpening()
                    } else {
                        skipTime(5)
                    }
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
                        onNextEpisode?.()
                    }
                    break
                case "i":
                    e.preventDefault()
                    togglePip()
                    break
                case "g":
                    e.preventDefault()
                    takeScreenshot()
                    break
                case "v":
                    e.preventDefault()
                    setShowStats(prev => !prev)
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

    const handleTimeUpdate = () => {
        const video = videoRef.current
        if (!video) return
        
        const curr = video.currentTime
        const total = video.duration
        
        setCurrentTime(curr)
        setDuration(total)

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

        if (skipTimes?.op) {
            const { startTime, endTime } = skipTimes.op
            const inOpWindow = curr >= startTime && curr < endTime
            if (autoSkipIntroPref && inOpWindow) {
                video.currentTime = endTime
                return
            }
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
            const fallback = curr >= 30 && curr <= 120
            if (fallback !== showSkipIntro) setShowSkipIntro(fallback)
            if (fallback) {
                setSkipRemainingSeconds(Math.ceil(120 - curr))
                setSkipLabel("SALTAR INTRO")
            }
        }

        const ed = skipTimes?.ed
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
                buffer: video.buffered.length > 0 ? (video.buffered.end(video.buffered.length - 1) - curr).toFixed(2) : 0,
                resolution: `${video.videoWidth}x${video.videoHeight}`,
                playbackRate: video.playbackRate,
                volume: Math.round(video.volume * 100),
                source: playableUrl.substring(0, 50) + "...",
            })
        }
    }

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

    const remainingProgress = useMemo(() => {
        return (countdownSeconds / 15) * 100
    }, [countdownSeconds])

    const handleSetHlsLevel = useCallback((levelIndex: number) => {
        if (hlsRef.current) {
            hlsRef.current.currentLevel = levelIndex
            setActiveHlsLevel(levelIndex)
        }
    }, [])

    return {
        refs: {
            videoRef,
            containerRef,
            canvasRef,
            progressBarRef,
            progressInputRef,
            timeTextRef,
        },
        state: {
            isPlaying, duration, volume, isMuted, isFullscreen, controlsVisible, status, errorMsg, isBuffering, flash, showSkipIntro, skipRemainingSeconds, skipLabel, showNextEpisode, countdownSeconds, marathonMode, audioTracks, activeAudioIndex, subtitleTracks, activeSubtitleIndex, isJassubLoading, isJassubActive, isSettingsOpen, remainingProgress,
            autoSkipIntro: autoSkipIntroPref,
            playbackRate: playbackRatePref,
            showStats,
            statsData,
            hlsLevels,
            activeHlsLevel,
            currentTime,
            showResume,
            resumeTime,
        },
        actions: {
            setIsPlaying, setDuration, setIsBuffering, setControlsVisible, setIsSettingsOpen, triggerControlsVisibility, togglePlay, handleSeek, skipTime, skipOpening, handleVolume, toggleMute, onSelectAudio, onSelectSubtitle, toggleFullscreen, handleSkipIntro, handleTimeUpdate,
            takeScreenshot, togglePip, changePlaybackRate, setShowStats, setAutoSkipIntro,
            setHlsLevel: handleSetHlsLevel,
        }
    }
}
