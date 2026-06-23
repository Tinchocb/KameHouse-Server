'use no memo'
import { useEffect, useRef } from "react"
import Hls from "hls.js"
import { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"
import { Continuity_WatchHistoryItemResponse } from "@/api/generated/types"

interface UsePlayerHlsProps {
    videoRef: React.RefObject<HTMLVideoElement | null>
    hlsRef: React.MutableRefObject<Hls | null>
    playableUrl: string
    absoluteLanUrl: string
    isCastingRef: React.RefObject<boolean>
    backendTracks: { audioTracks: AudioTrack[]; subtitleTracks: SubtitleTrack[] } | null
    initialProgressSeconds?: number
    episodeNumber?: number
    historyData: Continuity_WatchHistoryItemResponse | null | undefined
    setStatus: (status: "loading" | "ready" | "error") => void
    setIsBuffering: (buffering: boolean) => void
    setErrorMsg: (msg: string) => void
    setHlsLevels: (levels: { index: number; label: string; height: number }[]) => void
    setAudioTracks: (tracks: AudioTrack[]) => void
    setSubtitleTracks: (tracks: SubtitleTrack[]) => void
    setActiveAudioIndex: (index: number) => void
    setResumeTime: (time: number) => void
    setShowResume: (show: boolean) => void
    setIsPlaying: (playing: boolean) => void
}

function setRefValue<T>(ref: React.MutableRefObject<T>, value: T) {
    ref.current = value
}

function setVideoSrc(video: HTMLVideoElement, src: string) {
    video.src = src
}

export function usePlayerHls({
    videoRef,
    hlsRef,
    playableUrl,
    absoluteLanUrl,
    isCastingRef,
    backendTracks,
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
}: UsePlayerHlsProps) {
    const backendTracksRef = useRef(backendTracks)
    const hasPromptedResumeRef = useRef<string | null>(null)

    useEffect(() => {
        backendTracksRef.current = backendTracks
    }, [backendTracks])

    // Decoupled watch history/resume prompt logic
    useEffect(() => {
        if (!historyData?.found || !historyData?.item) return
        if (historyData.item.episodeNumber !== episodeNumber) return

        const currentKey = `${episodeNumber}-${playableUrl}`
        if (hasPromptedResumeRef.current === currentKey) return

        const time = historyData.item.currentTime
        if (time > 10) {
            hasPromptedResumeRef.current = currentKey
            setResumeTime(time)
            setShowResume(true)

            const timer = setTimeout(() => setShowResume(false), 10000)
            return () => clearTimeout(timer)
        }
    }, [historyData, episodeNumber, playableUrl, setResumeTime, setShowResume])

    // Decoupled track updates for direct streams (non-HLS)
    useEffect(() => {
        if (!backendTracks) return
        const isHlsUrl = playableUrl.includes(".m3u8")
        if (!isHlsUrl || !Hls.isSupported()) {
            setAudioTracks(backendTracks.audioTracks)
            setSubtitleTracks(backendTracks.subtitleTracks)
        }
    }, [backendTracks, playableUrl, setAudioTracks, setSubtitleTracks])

    useEffect(() => {
        if (!playableUrl) {
            Promise.resolve().then(() => {
                setStatus("loading")
                setIsBuffering(true)
            })
            return
        }

        const video = videoRef.current
        if (!video) return

        const progressSeconds = initialProgressSeconds || 0

        Promise.resolve().then(() => {
            setStatus("loading")
            setIsBuffering(true)
        })

        if (hlsRef.current) {
            hlsRef.current.destroy()
            setRefValue(hlsRef, null)
        }

        const isHlsUrl = playableUrl.includes(".m3u8")
        let hlsInstance: Hls | null = null
        // Track media error recovery attempts to implement the two-pass strategy:
        // 1st failure → recoverMediaError(), 2nd failure → swapAudioCodec() + recoverMediaError(), 3rd → fatal
        let mediaRecoveryAttempt = 0

        const handleCanPlay = () => {
            setStatus("ready")
            setIsBuffering(false)
            if (Number.isFinite(progressSeconds) && progressSeconds > 0) {
                video.currentTime = progressSeconds
            }
            video.play()
                .then(() => setIsPlaying(true))
                .catch((err) => {
                    console.log("Autoplay blocked:", err)
                    setIsPlaying(false)
                })
        }

        const handleNativeError = () => {
            if (isCastingRef.current) {
                console.log("Ignoring native video error because casting is active.")
                return
            }
            setStatus("error")
            setErrorMsg(video.error?.message || "Ocurrió un error al cargar el archivo de video.")
        }

        const resolvedUrl = (() => {
            if (!playableUrl) return ""
            if (typeof window !== "undefined") {
                if (playableUrl.startsWith("/")) {
                    return `${window.location.origin}${playableUrl}`
                }
                try {
                    const url = new URL(playableUrl)
                    if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]") {
                        url.protocol = window.location.protocol
                        url.host = window.location.host
                        return url.toString()
                    }
                } catch {}
            }
            return playableUrl
        })()

        let listenersAdded = false

        if (isHlsUrl && Hls.isSupported()) {
            // ... (keep HLS setup as is)
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                // Mantener hasta 90s de buffer ya reproducido para seeks instantáneos hacia atrás
                backBufferLength: 90,

                // Configuración de buffer optimizada para red local / alto rendimiento
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                maxBufferSize: 120_000_000, // 120MB para admitir bitrates altos (1080p/4K) sin estrangular

                // Tolerancia de desfase de audio antes de forzar resincronización.
                // Con 2: balance ideal para resincronizar rápido sin causar tirones constantes.
                maxAudioFramesDrift: 2,

                // ─── Comportamiento ante huecos en el buffer ──────────────────────────────
                // Si hay un hueco de más de 0.5s entre segmentos, hls.js salta sobre él.
                // Ajustado a 0.5s para transiciones de segmento más fluidas.
                maxBufferHole: 0.5,

                // ─── Watchdog del buffer ──────────────────────────────────────────────────
                // Sólo activa el watchdog (que puede reiniciar la reproducción) si el buffer
                // lleva 5s sin avanzar, evitando intervenciones innecesarias.
                highBufferWatchdogPeriod: 5,

                // ─── Nudge (desatasco) ────────────────────────────────────────────────────
                // nudgeOffset grande (0.3s) permite que el navegador se recupere solo
                // de pequeños atascos antes de que hls.js intervenga agresivamente.
                nudgeOffset: 0.3,
                nudgeMaxRetry: 5,

                // ─── ABR (Adaptive Bitrate) ───────────────────────────────────────────────
                // Arranca siempre en calidad máxima disponible (-1 = auto pero empieza alto)
                startLevel: -1,
                // Estima 20 Mbps como ancho de banda inicial para no bajar a 240p en el seek
                abrEwmaDefaultEstimate: 20_000_000,
                // No medir ancho de banda con el primer segmento (evita resets tras seeks)
                testBandwidth: false,
                // Esperar más antes de degradar calidad ante un retraso corto de carga
                abrBandWidthFactor: 0.90,
                abrBandWidthUpFactor: 0.70,
            })
            setRefValue(hlsRef, hls)
            hlsInstance = hls

            hls.loadSource(resolvedUrl)
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

                if (Number.isFinite(progressSeconds) && progressSeconds > 0) {
                    video.currentTime = progressSeconds
                }

                // Autoplay when HLS manifest is parsed and stream is ready
                video.play()
                    .then(() => setIsPlaying(true))
                    .catch((err) => {
                        console.log("Autoplay blocked:", err)
                        setIsPlaying(false)
                    })
            })

            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
                const mappedTracks = data.audioTracks.map((t) => ({
                    index: t.id,
                    language: t.lang || "und",
                    title: t.name || t.lang || `Audio ${t.id}`,
                }))
                setAudioTracks(mappedTracks.length > 0 ? mappedTracks : (backendTracksRef.current?.audioTracks || []))
                setActiveAudioIndex(hls.audioTrack)
            })

            hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
                const mappedSubs = data.subtitleTracks.map((t, i) => ({
                    index: i,
                    language: t.lang || "und",
                    title: t.name || t.lang || `Subtítulos ${i + 1}`,
                }))
                setSubtitleTracks(mappedSubs.length > 0 ? mappedSubs : (backendTracksRef.current?.subtitleTracks || []))
            })

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    console.error("Fatal HLS error:", data)
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        // Error de red: intentar recuperación automática
                        console.warn("HLS: Fatal network error, attempting recovery...")
                        hls.startLoad()
                    } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        mediaRecoveryAttempt++
                        if (mediaRecoveryAttempt === 1) {
                            // 1er intento: recuperación estándar del media element
                            console.warn("HLS: Fatal media error (attempt 1/2), calling recoverMediaError()...")
                            hls.recoverMediaError()
                        } else if (mediaRecoveryAttempt === 2) {
                            // 2do intento: el codec de audio puede ser incompatible, hacer swap y reintentar
                            console.warn("HLS: Fatal media error (attempt 2/2), swapping audio codec and recovering...")
                            hls.swapAudioCodec()
                            hls.recoverMediaError()
                        } else {
                            // Recuperación fallida — mostrar pantalla de error
                            console.error("HLS: Media error is unrecoverable after 2 attempts:", data.details)
                            setStatus("error")
                            setErrorMsg(video.error?.message || `Error de decodificación: ${data.details}`)
                            hls.destroy()
                        }
                    } else {
                        // Error irrecuperable
                        setStatus("error")
                        setErrorMsg(`Error fatal de reproducción HLS: ${data.details}`)
                        hls.destroy()
                    }
                } else {
                    // Errores no fatales de buffer: hls.js se recupera solo, solo logueamos
                    if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
                        data.details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE) {
                        console.warn("HLS: Non-fatal buffer stall, waiting for recovery:", data.details)
                    }
                }
            })
        } else {
            setVideoSrc(video, resolvedUrl)
            video.load()

            video.addEventListener("canplay", handleCanPlay)
            video.addEventListener("error", handleNativeError)
            listenersAdded = true

            if (backendTracksRef.current) {
                Promise.resolve().then(() => {
                    setAudioTracks(backendTracksRef.current!.audioTracks)
                    setSubtitleTracks(backendTracksRef.current!.subtitleTracks)
                })
            }
        }

        const currentHlsRef = hlsRef
        return () => {
            if (hlsInstance) {
                hlsInstance.destroy()
                if (currentHlsRef.current === hlsInstance) {
                    setRefValue(currentHlsRef, null)
                }
            }
            video.removeAttribute("src")
            try {
                video.load()
            } catch {}
            if (listenersAdded) {
                video.removeEventListener("canplay", handleCanPlay)
                video.removeEventListener("error", handleNativeError)
            }
        }
    }, [
        playableUrl,
        absoluteLanUrl,
        initialProgressSeconds,
        videoRef,
        hlsRef,
        isCastingRef,
        setStatus,
        setIsBuffering,
        setErrorMsg,
        setHlsLevels,
        setAudioTracks,
        setSubtitleTracks,
        setActiveAudioIndex,
        setIsPlaying,
    ])
}
