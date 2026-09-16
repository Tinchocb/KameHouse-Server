'use no memo'
import { useEffect, useRef } from "react"
import Hls from "hls.js"
import { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"
import { Continuity_WatchHistoryItemResponse } from "@/api/generated/types"

/**
 * Inicia la reproducción y clasifica el fallo de la promesa de `play()`.
 *
 * Un `AbortError` NO es un bloqueo de autoplay: ocurre cuando el efecto se
 * re-ejecuta (p. ej. cambio de stream direct→hls) y el cleanup destruye el hls
 * o llama `video.load()` mientras la promesa de `play()` anterior sigue pendiente.
 * Es una carrera de teardown esperada y benigna, así que la ignoramos en silencio.
 * Solo un bloqueo real de política del navegador (`NotAllowedError`) merece un warn.
 */
function attemptAutoplay(video: HTMLVideoElement, setIsPlaying: (playing: boolean) => void): void {
    video.play()
        .then(() => setIsPlaying(true))
        .catch((err: unknown) => {
            setIsPlaying(false)
            if (err instanceof DOMException && err.name === "AbortError") {
                // Interrumpido por pause()/load() durante el teardown del efecto — benigno.
                return
            }
            console.warn("Autoplay blocked:", err)
        })
}

interface UsePlayerHlsProps {
    videoRef: React.RefObject<HTMLVideoElement | null>
    hlsRef: React.MutableRefObject<Hls | null>
    playableUrl: string
    absoluteLanUrl: string
    backendTracks: { audioTracks: AudioTrack[]; subtitleTracks: SubtitleTrack[] } | null
    initialProgressSeconds?: number
    streamSwitchResumeRef?: React.MutableRefObject<number | null>
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
    /** Llamado UNA sola vez cuando el reproductor nativo (direct play) encuentra un
     *  error irrecuperable. Retorna true si hizo fallback a transcode, false si no
     *  puede (transcode desactivado) para que el caller muestre error inmediato. */
    onDirectPlayFailed?: () => boolean | void
    setIsStreamSwitching?: (switching: boolean) => void
    retryNonce?: number
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
    absoluteLanUrl: _absoluteLanUrl,
    backendTracks,
    initialProgressSeconds,
    streamSwitchResumeRef,
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
    onDirectPlayFailed,
    setIsStreamSwitching,
    retryNonce = 0,
}: UsePlayerHlsProps) {
    const backendTracksRef = useRef(backendTracks)
    const hasPromptedResumeRef = useRef<string | null>(null)
    const initialProgressRef = useRef(initialProgressSeconds)
    // Guard: solo disparar onDirectPlayFailed una sola vez por playableUrl.
    const directPlayFailedFiredRef = useRef(false)
    const onDirectPlayFailedRef = useRef(onDirectPlayFailed)
    onDirectPlayFailedRef.current = onDirectPlayFailed

    useEffect(() => {
        backendTracksRef.current = backendTracks
    }, [backendTracks])

    useEffect(() => {
        initialProgressRef.current = initialProgressSeconds
        // Resetear el guard de fallback cuando cambia el video.
        directPlayFailedFiredRef.current = false
    }, [playableUrl, initialProgressSeconds])

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

    // Decoupled track updates.
    // - Audio: only for non-HLS streams (HLS gets tracks from AUDIO_TRACKS_UPDATED event).
    // - Subtitles: ALWAYS use backend tracks regardless of stream type.
    //   Subs are served via /api/v1/mediastream/subtitles + JASSUB, not via the HLS manifest
    //   (the master playlist intentionally emits CLOSED-CAPTIONS=NONE and no EXT-X-MEDIA:TYPE=SUBTITLES).
    //   If we waited for SUBTITLE_TRACKS_UPDATED it would never fire, leaving subtitleTracks empty.
    useEffect(() => {
        if (!backendTracks) return
        const isHlsUrl = playableUrl.includes(".m3u8")

        // [DIAGNOSTIC] Log track info
        console.info("[player diag] backendTracks updated", {
            streamType: isHlsUrl ? "hls" : "direct",
            audioTracks: backendTracks.audioTracks,
            subtitleTracks: backendTracks.subtitleTracks,
        })

        if (!isHlsUrl || !Hls.isSupported()) {
            // Direct-play: seed both audio and subtitles from backend
            setAudioTracks(backendTracks.audioTracks)
        }
        // Always seed subtitles from backend (HLS manifest never carries subtitle tracks)
        setSubtitleTracks(backendTracks.subtitleTracks)
    }, [backendTracks, playableUrl, setAudioTracks, setSubtitleTracks])

    useEffect(() => {
        if (!playableUrl) {
            Promise.resolve().then(() => {
                setStatus("loading")
                setIsBuffering(true)
            })
            const timer = setTimeout(() => {
                setStatus("error")
                setErrorMsg("No se pudo obtener el stream del servidor (timeout 30s). Verifica la conexión o reintenta.")
                setIsBuffering(false)
            }, 30000)
            return () => clearTimeout(timer)
        }

        const video = videoRef.current
        if (!video) return

        const switchResume = streamSwitchResumeRef?.current ?? null
        const progressSeconds = (switchResume != null && switchResume > 0)
            ? switchResume
            : (initialProgressRef.current || 0)
        
        if (streamSwitchResumeRef) streamSwitchResumeRef.current = null

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
        let networkRecoveryAttempt = 0
        let initialSeekDone = false
        let stalledCountRef = 0
        let stallRecoveries = 0
        let destroyed = false
        const destroyOnce = () => {
            if (destroyed) return
            destroyed = true
            try {
                hlsInstance?.destroy()
            } catch {}
            hlsInstance = null
            if (hlsRef.current) setRefValue(hlsRef, null)
        }

        const handleCanPlay = () => {
            setStatus("ready")
            setIsBuffering(false)
            if (!initialSeekDone && Number.isFinite(progressSeconds) && progressSeconds > 0) {
                video.currentTime = progressSeconds
                initialSeekDone = true
            }
            attemptAutoplay(video, setIsPlaying)
        }

        const handleNativeError = () => {
            // Preservar posición para el fallback direct→transcode: sin esto el
            // nuevo stream arranca en 0/history y se pierden minutos.
            const saveResume = () => {
                try {
                    const t = video.currentTime
                    if (Number.isFinite(t) && t > 0 && streamSwitchResumeRef) {
                        streamSwitchResumeRef.current = t
                    }
                } catch {}
            }
            // En HLS (ya en transcode) un MEDIA_ERR_DECODE no debe disparar el
            // fallback "direct→transcode": sería un no-op que retrasa la UI real.
            if (!isHlsUrl && onDirectPlayFailedRef.current && !directPlayFailedFiredRef.current) {
                directPlayFailedFiredRef.current = true
                saveResume()
                try {
                    setIsStreamSwitching?.(true)
                } catch {}
                console.warn("[player] Direct play native error — triggering onDirectPlayFailed fallback")
                const didFallback = onDirectPlayFailedRef.current()
                // Si el orchestrator hizo fallback (true/undefined legacy), mantener
                // loading y esperar el nuevo playableUrl. Si retornó false
                // (transcode desactivado), mostrar error inmediato en vez de spinner.
                if (didFallback === false) {
                    try {
                        setIsStreamSwitching?.(false)
                    } catch {}
                    setStatus("error")
                    setErrorMsg(video.error?.message || "Ocurrió un error al cargar el archivo de video.")
                }
                return
            }
            try {
                setIsStreamSwitching?.(false)
            } catch {}
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
        const isTv = typeof navigator !== "undefined" && (
            /SmartTV/i.test(navigator.userAgent) ||
            /Tizen/i.test(navigator.userAgent) ||
            /WebOS/i.test(navigator.userAgent) ||
            /Web0S/i.test(navigator.userAgent)
        )
        if (isHlsUrl && Hls.isSupported()) {
            // Capturar errores nativos del <video> también en HLS (ej. MEDIA_ERR_DECODE
            // en un fragmento que hls.js no clasifica como fatal). Sin esto la UI
            // quedaba en spinner infinito.
            video.addEventListener("error", handleNativeError)
            listenersAdded = true
            // ... (keep HLS setup as is)
            const hls = new Hls({
                enableWorker: !isTv,

                // VOD buffer strategy (Netflix/Plex style).
                // lowLatencyMode is intentionally omitted — it is designed for live
                // streams (Twitch-style LL-HLS) and causes hundreds of micro-requests
                // on VOD content, saturating the network and hurting start times on
                // heavy files (e.g. 4K MKVs).

                // Auto quality selection after bandwidth estimation.
                // startLevel: -1 lets ABR pick the optimal level once bandwidth is measured,
                // avoiding forced lowest-quality first segment on LAN where transcode is fast.
                startLevel: -1,

                // Load the very first fragment as soon as the manifest is parsed,
                // before attaching to the video element. This shaves one RTT off the
                // startup sequence.
                startFragPrefetch: true,

                // Tell hls.js to start streaming from this position instead of zero.
                // This prevents throwing away the first chunk when resuming playback
                // or switching audio tracks (which resumes from streamSwitchResumeRef).
                startPosition: Number.isFinite(progressSeconds) && progressSeconds > 0 ? progressSeconds : -1,

                // 15s initial buffer target: transcode cold-start can take 10-15s to produce
                // the first segment. hls.js fires canplay once this threshold is met.
                maxBufferLength: 15,
                // Cap at 2min for 4K HDR memory safety (was 180s / 3min).
                maxMaxBufferLength: 120,
                // 40MB hard RAM cap: safer for memory-constrained devices (was 60MB).
                maxBufferSize: 40 * 1024 * 1024,
                // Tolerate timestamp gaps up to 1.0s without stalling — common in
                // anime MKVs with variable keyframe spacing.
                maxBufferHole: 1.0,
                nudgeMaxRetry: 8,
                highBufferWatchdogPeriod: 1,
                // Don't request 4K segments when the video element is displayed
                // at a lower resolution (e.g. picture-in-picture or small window).
                capLevelToPlayerSize: true,
                // Faster ABR upscale on LAN (was ~3s default ewmaFastLive).
                abrEwmaFastLive: 1.5,
                // Faster ABR downscale reaction (was ~9s default ewmaSlowLive).
                abrEwmaSlowLive: 4.5,
                abrBandWidthFactor: 0.95,
                abrBandWidthUpFactor: 0.7,
                // Back-buffer: keep 30s behind the playhead for smooth backwards seeks without holding excessive RAM.
                backBufferLength: 30,
                // Generous manifest load timeout for large library servers on LAN.
                manifestLoadingTimeOut: 10000,
                // On-the-fly transcode has a real cold start: the first .ts of a quality
                // is only produced after ffmpeg spawns and encodes it (seconds), and a
                // hover-preload can be competing for the transcoder's governor slots. The
                // hls.js defaults (~10s) fire a fatal levelLoadTimeOut/fragLoadTimeOut
                // before that first segment lands, so we widen the level/fragment budgets.
                levelLoadingTimeOut: 30000,
                fragLoadingTimeOut: 60000,
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

                // startPosition in Hls constructor handles seeking to progressSeconds natively

                // Autoplay when HLS manifest is parsed and stream is ready
                attemptAutoplay(video, setIsPlaying)
            })

            hls.on(Hls.Events.FRAG_LOADED, () => {
                networkRecoveryAttempt = 0 // Reiniciar contador si hay conexión estable
                stalledCountRef = 0
            })

            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
                // [DIAGNOSTIC]
                console.info("[player diag] AUDIO_TRACKS_UPDATED", data.audioTracks, "backendTracks:", backendTracksRef.current?.audioTracks)

                // Enrich hls.js tracks with backend metadata (absolute index, codec, channels, default).
                // hls.js assigns sequential ids (0,1,2…) but the backend audio URI uses the
                // ABSOLUTE stream index from the container (./audio/{index}/index.m3u8).
                // Without this merge, selecting track N would request the wrong audio stream.
                const backendAudioTracks = backendTracksRef.current?.audioTracks || []
                const mappedTracks = data.audioTracks.map((t, idx) => {
                    const backend = backendAudioTracks[idx]
                    return {
                        // Preserve the backend's absolute container index.
                        // Falls back to the hls.js sequential id only when backend data is missing.
                        index: backend?.index ?? idx,
                        // hlsId is the hls.js internal sequential id used for hls.audioTrack assignment.
                        hlsId: idx,
                        language: t.lang || backend?.language || "und",
                        title: t.name || backend?.title || t.lang || `Audio ${t.id}`,
                        codec: backend?.codec,
                        channels: backend?.channels,
                        default: backend?.default ?? (t.default === true),
                    }
                })
                setAudioTracks(mappedTracks.length > 0 ? mappedTracks : backendAudioTracks)
                setActiveAudioIndex(hls.audioTrack)
            })


            // Subtitle tracks: the HLS master playlist does NOT include EXT-X-MEDIA:TYPE=SUBTITLES
            // (it emits CLOSED-CAPTIONS=NONE instead). Subtitles are served via the backend's
            // /subtitles endpoint and rendered by JASSUB. Therefore:
            // - SUBTITLE_TRACKS_UPDATED fires with an empty array → we must NOT overwrite the
            //   backend-seeded subtitleTracks. If hls.js somehow emits real subtitle entries
            //   (future-proofing), we ignore them and keep relying on the backend URL+codec data.
            hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
                console.info("[player diag] SUBTITLE_TRACKS_UPDATED", data.subtitleTracks, "(ignored — backend tracks are authoritative)")
                // Intentionally do NOT call setSubtitleTracks here.
                // Subtitles were already seeded from backendTracks in the effect above.
            })

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    console.error("Fatal HLS error:", data)
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        networkRecoveryAttempt++
                        if (networkRecoveryAttempt <= 5) {
                            console.warn(`HLS: Fatal network error (attempt ${networkRecoveryAttempt}/5), attempting recovery...`)
                            hls.startLoad()
                        } else {
                            console.error("HLS: Network error is unrecoverable after 5 attempts")
                            setStatus("error")
                            setErrorMsg("No se pudo restablecer la conexión con el flujo de video tras 5 intentos.")
                            destroyOnce()
                        }
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
                            destroyOnce()
                        }
                    } else {
                        // Error irrecuperable
                        setStatus("error")
                        setErrorMsg(`Error fatal de reproducción HLS: ${data.details}`)
                        destroyOnce()
                    }
                } else {
                    // Errores no fatales de buffer: hls.js se recupera solo, pero con transcode forzamos
                    if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
                        stalledCountRef++
                        const v = videoRef.current
                        if (v && v.buffered.length === 0) {
                            // nada bufferizado en el playhead: forzar refetch desde la posición actual
                            hls.startLoad(Math.max(0, v.currentTime - 0.1))
                        } else if (v) {
                            // hueco pequeño: nudge por encima del hole
                            v.currentTime = v.currentTime + 0.1
                        }
                        if (stalledCountRef > 12) {
                            stallRecoveries++
                            stalledCountRef = 0
                            if (stallRecoveries > 3) {
                                console.error("HLS: stalls persistentes tras 3 recoveries — mostrando error")
                                setStatus("error")
                                setErrorMsg("La reproducción se detuvo por stalls persistentes. Reintenta o cambia a Direct Play.")
                                setIsBuffering(false)
                                destroyOnce()
                            } else {
                                hls.recoverMediaError()
                            }
                        }
                    } else if (data.details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE) {
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
            if (hlsInstance && !destroyed) {
                destroyed = true
                try {
                    hlsInstance.destroy()
                } catch {}
                if (currentHlsRef.current === hlsInstance) {
                    setRefValue(currentHlsRef, null)
                }
                hlsInstance = null
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
        // absoluteLanUrl is intentionally omitted: it is derived from playableUrl + serverIPs.
        // Including it caused the entire HLS instance to be destroyed and recreated whenever
        // the server IP was detected/changed, producing a spurious "loading" state after seek
        // or episode changes.
        videoRef,
        hlsRef,
        setStatus,
        setIsBuffering,
        setErrorMsg,
        setHlsLevels,
        setAudioTracks,
        setSubtitleTracks,
        setActiveAudioIndex,
        setIsPlaying,
        streamSwitchResumeRef,
        retryNonce,
    ])
}
