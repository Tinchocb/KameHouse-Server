'use no memo'
import { useEffect, useRef } from "react"
import type JASSUB from "jassub"
import { SubtitleTrack } from "@/components/ui/track-types"
import type { AspectRatioMode } from "./video-aspect"
import { convertToAss, scaleAssStyles } from "./subtitle-convert"
import { useSubtitleLoadStore } from "./subtitle-load-store"
import { SubtitleFetchError, describeSubtitleError } from "./subtitle-messages"

interface UsePlayerJassubProps {
    videoRef: React.RefObject<HTMLVideoElement | null>
    jassubRef: React.MutableRefObject<JASSUB | null>
    activeSubtitleIndex: number | null
    subtitleTracks: SubtitleTrack[]
    subtitleSizePref: number
    aspectRatio?: AspectRatioMode
    fontUrls?: string[]
    /**
     * Sube cuando el servidor tiene subtítulos nuevos de una pista progresiva (Drive por
     * franjas): se vuelve a pedir y se reemplaza en el renderer sin recrearlo.
     */
    refreshKey?: number
    setIsJassubLoading: (loading: boolean) => void
}

async function resizeJassubForAspect(
    jassub: JASSUB,
    video: HTMLVideoElement | null,
    aspectRatio: AspectRatioMode,
) {
    if (aspectRatio === "contain") {
        await jassub.resize(true)
        return
    }
    const stage = video?.parentElement
    const width = stage?.clientWidth || video?.clientWidth || 0
    const height = stage?.clientHeight || video?.clientHeight || 0
    if (width > 0 && height > 0) {
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
        await jassub.resize(true, Math.round(width * dpr), Math.round(height * dpr))
    } else {
        await jassub.resize(true)
    }
}

function setRefValue<T>(ref: React.MutableRefObject<T>, value: T) {
    ref.current = value
}

export function usePlayerJassub({
    videoRef,
    jassubRef,
    activeSubtitleIndex,
    subtitleTracks,
    subtitleSizePref,
    aspectRatio = "contain",
    fontUrls,
    refreshKey = 0,
    setIsJassubLoading,
}: UsePlayerJassubProps) {
    const cachedAssContentRef = useRef<{ url: string; content: string } | null>(null)
    // Última clave de recarga pedida y la que ya recoge la pista cargada: si el servidor
    // avisa de subtítulos nuevos mientras JASSUB todavía se está creando, la recarga no se
    // pierde (antes se descartaba y la pista quedaba con el recorte del primer pedido).
    const latestRefreshKeyRef = useRef(refreshKey)
    const appliedRefreshKeyRef = useRef(refreshKey)
    const refreshProgressiveRef = useRef<(() => void) | null>(null)
    useEffect(() => {
        latestRefreshKeyRef.current = refreshKey
    }, [refreshKey])
    // El tamaño se lee por ref al crear la instancia: cambiarlo no debe recrear
    // JASSUB (refetch + parpadeo), lo aplica en caliente el efecto de más abajo.
    // (Se sincroniza en un efecto declarado antes que el de init, así ya está al día.)
    const subtitleSizeRef = useRef(subtitleSizePref)
    useEffect(() => {
        setRefValue(subtitleSizeRef, subtitleSizePref)
    }, [subtitleSizePref])
    const fontUrlsKey = fontUrls?.join("|") ?? ""
    const fontUrlsRef = useRef(fontUrls)
    useEffect(() => {
        setRefValue(fontUrlsRef, fontUrls)
    }, [fontUrlsKey, fontUrls])
    const aspectRatioRef = useRef<AspectRatioMode>(aspectRatio)
    useEffect(() => {
        setRefValue(aspectRatioRef, aspectRatio)
    }, [aspectRatio])
    const activeTrack = activeSubtitleIndex !== null && subtitleTracks 
        ? subtitleTracks.find(t => t.index === activeSubtitleIndex) ?? null 
        : null
    const trackUrl = activeTrack?.url
    const trackCodec = activeTrack?.codec
    const trackProgressive = !!activeTrack?.progressive

    useEffect(() => {
        const video = videoRef.current
        const currentJassubRef = jassubRef
        if (!video || activeSubtitleIndex === null || !trackUrl) {
            if (currentJassubRef.current) {
                currentJassubRef.current.destroy()
                setRefValue(currentJassubRef, null)
                Promise.resolve().then(() => {
                    setIsJassubLoading(false)
                })
            }
            return
        }

        // Supported codec families:
        //   ass/ssa   → native ASS (full styling support)
        //   subrip    → SRT text (libass handles .srt content via subContent)
        //   vtt       → WebVTT text (libass handles simple VTT via subContent)
        // Image-based codecs (PGS/DVB) are excluded — they have isImageBased=true
        // and no URL, so they never reach this hook.
        const codec = trackCodec?.toLowerCase() ?? ""
        const isSupported = codec === "ass" || codec === "ssa" || codec === "subrip" || codec === "vtt"

        if (!isSupported) {
            if (currentJassubRef.current) {
                currentJassubRef.current.destroy()
                setRefValue(currentJassubRef, null)
                Promise.resolve().then(() => {
                    setIsJassubLoading(false)
                })
            }
            return
        }

        Promise.resolve().then(() => {
            setIsJassubLoading(true)
        })

        let isCancelled = false
        const aborter = new AbortController()
        const trackIndexForUi = activeSubtitleIndex
        // Estado visible en el panel: cargando / extrayendo / error (nunca silencio).
        const reportLoad = (phase: "idle" | "loading" | "extracting" | "error", message?: string) => {
            if (!isCancelled) useSubtitleLoadStore.getState().setTrackLoad(phase, trackIndexForUi, message ?? null)
        }
        // Una pista progresiva crece mientras se reproduce: no se reutiliza la copia vieja.
        const useCached = !trackProgressive && cachedAssContentRef.current?.url === trackUrl
        reportLoad(useCached ? "idle" : "loading")
        appliedRefreshKeyRef.current = latestRefreshKeyRef.current

        const initJassub = async () => {
            try {
                let assContent = ""
                if (useCached && cachedAssContentRef.current) {
                    assContent = cachedAssContentRef.current.content
                } else {
                    const fetchSubtitle = async (): Promise<string> => {
                        for (let i = 0; i < 20; i++) {
                            if (isCancelled || aborter.signal.aborted) throw new Error("cancelled")
                            const res = await fetch(trackUrl, { signal: aborter.signal })
                            if (res.ok) {
                                const text = await res.text()
                                if (text.length > 2000000) throw new Error("subtitle file too large")
                                if (!text.trim()) throw new Error("subtitle file empty")
                                return text
                            }
                            // 4xx definitivos (404 incluido): reintentar no sirve
                            if (res.status === 429) {
                                await new Promise((r) => setTimeout(r, 2000))
                                continue
                            }
                            if (res.status >= 400 && res.status < 500) {
                                throw new SubtitleFetchError(`subtitle not available (HTTP ${res.status})`, res.status)
                            }
                            // 503: el servidor todavía extrae las pistas del archivo.
                            if (res.status === 503) reportLoad("extracting")
                            await new Promise((r, rej) => {
                                const t = setTimeout(r, Math.min(2000 * (i + 1), 6000))
                                aborter.signal.addEventListener("abort", () => {
                                    clearTimeout(t)
                                    rej(new Error("cancelled"))
                                }, { once: true })
                            })
                        }
                        throw new Error("subtitle never became available")
                    }
                    const rawContent = await fetchSubtitle()
                    // libass only parses ASS/SSA; convert SubRip/WebVTT to ASS so it renders.
                    assContent = convertToAss(rawContent, trackCodec)
                    if (!isCancelled) {
                        cachedAssContentRef.current = { url: trackUrl, content: assContent }
                    }
                }

                if (isCancelled) return

                if (currentJassubRef.current) {
                    currentJassubRef.current.destroy()
                    setRefValue(currentJassubRef, null)
                }

                // Let JASSUB create and manage its OWN canvas (inserted after the video
                // and torn down on destroy). We must NOT hand it our persistent <canvas>:
                // JASSUB calls transferControlToOffscreen() on it, which can only ever run
                // once per element — reusing the same node on the next track/size change
                // throws "Cannot transfer control from a canvas for more than one time"
                // and cascades into worker "reading 'apply' of undefined" errors.
                // defaultFont already falls back to the bundled "liberation sans".
                const jassub = new (await import("jassub")).default({
                    video,
                    subContent: scaleAssStyles(assContent, subtitleSizeRef.current / 100),
                    workerUrl: "/jassub/jassub-worker.js",
                    wasmUrl: "/jassub/jassub-worker.wasm",
                    modernWasmUrl: "/jassub/jassub-worker-modern.wasm",
                    fonts: fontUrlsRef.current ?? [],
                })

                if (isCancelled) {
                    jassub.destroy()
                    return
                }

                setRefValue(currentJassubRef, jassub)
                setIsJassubLoading(false)
                reportLoad("idle")
                await jassub.ready
                if (isCancelled || currentJassubRef.current !== jassub) return
                if (aspectRatioRef.current !== "contain") {
                    await resizeJassubForAspect(jassub, video, aspectRatioRef.current)
                }
                if (trackProgressive && latestRefreshKeyRef.current !== appliedRefreshKeyRef.current) {
                    refreshProgressiveRef.current?.()
                }
            } catch (err) {
                console.error("jassub: Failed to initialize:", err)
                if (!isCancelled) {
                    setIsJassubLoading(false)
                    reportLoad("error", describeSubtitleError(err))
                }
            }
        }

        initJassub()

        return () => {
            isCancelled = true
            try {
                aborter.abort()
            } catch {}
            useSubtitleLoadStore.getState().setTrackLoad("idle", null)
            if (currentJassubRef.current) {
                currentJassubRef.current.destroy()
                setRefValue(currentJassubRef, null)
                setIsJassubLoading(false)
            }
        }
    }, [activeSubtitleIndex, trackUrl, trackCodec, trackProgressive, fontUrlsKey, videoRef, jassubRef, setIsJassubLoading])

    // Subtítulos nuevos de una pista progresiva: se pide de nuevo y se reemplaza la pista
    // del renderer (sin recrearlo: no hay parpadeo ni se pierde el tamaño).
    useEffect(() => {
        if (!trackUrl || !trackProgressive) {
            refreshProgressiveRef.current = null
            return
        }
        let ctrl: AbortController | null = null
        const run = () => {
            const jassub = jassubRef.current
            if (!jassub) return // todavía se está creando: al terminar recoge la clave pendiente
            appliedRefreshKeyRef.current = latestRefreshKeyRef.current
            ctrl?.abort()
            const c = new AbortController()
            ctrl = c
            void (async () => {
                try {
                    const res = await fetch(trackUrl, { signal: c.signal, cache: "no-store" })
                    if (!res.ok) {
                        // Falla pasajera: se deja pendiente para el próximo aviso del servidor.
                        appliedRefreshKeyRef.current = latestRefreshKeyRef.current - 1
                        return
                    }
                    const text = await res.text()
                    if (!text.trim() || text.length > 2000000) return
                    const ass = convertToAss(text, trackCodec)
                    cachedAssContentRef.current = { url: trackUrl, content: ass }
                    await jassub.ready
                    if (c.signal.aborted || jassubRef.current !== jassub) return
                    await jassub.renderer.setTrack(scaleAssStyles(ass, subtitleSizeRef.current / 100))
                    await resizeJassubForAspect(jassub, videoRef.current, aspectRatioRef.current)
                } catch (err) {
                    if (!c.signal.aborted) console.warn("jassub: no se pudo actualizar la pista progresiva:", err)
                }
            })()
        }
        refreshProgressiveRef.current = run
        return () => {
            ctrl?.abort()
            refreshProgressiveRef.current = null
        }
    }, [trackUrl, trackCodec, trackProgressive, jassubRef, videoRef])

    useEffect(() => {
        if (appliedRefreshKeyRef.current === refreshKey) return
        refreshProgressiveRef.current?.()
    }, [refreshKey])

    // Tamaño de subtítulos en caliente: coalesce con 80ms para no re-escalar ni repintar el worker
    // en cada paso intermedio mientras el usuario arrastra el deslizador.
    useEffect(() => {
        const jassub = jassubRef.current
        const cached = cachedAssContentRef.current
        if (!jassub || !cached) return
        let cancelled = false
        const timer = window.setTimeout(() => {
            if (cancelled || jassubRef.current !== jassub) return
            const content = scaleAssStyles(cached.content, subtitleSizePref / 100)
            jassub.ready
                .then(async () => {
                    if (cancelled || jassubRef.current !== jassub) return
                    await jassub.renderer.setTrack(content)
                    await resizeJassubForAspect(jassub, videoRef.current, aspectRatioRef.current)
                })
                .catch((err: unknown) => console.warn("jassub: no se pudo aplicar el tamaño de subtítulos:", err))
        }, 80)
        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [subtitleSizePref, videoRef, jassubRef])

    // Sincronizar la resolución del lienzo JASSUB con el cuadro visible del stage al cambiar
    // la relación de aspecto o redimensionar el reproductor (sin dejar subtítulos recortados).
    useEffect(() => {
        const video = videoRef.current
        if (!video) return
        let cancelled = false
        let rafId = 0
        let timerId = 0

        const sync = () => {
            const jassub = jassubRef.current
            if (!jassub || cancelled) return
            void jassub.ready
                .then(async () => {
                    if (cancelled || jassubRef.current !== jassub) return
                    await resizeJassubForAspect(jassub, video, aspectRatioRef.current)
                })
                .catch(() => {})
        }

        const scheduleSync = () => {
            if (rafId) cancelAnimationFrame(rafId)
            if (timerId) window.clearTimeout(timerId)
            rafId = requestAnimationFrame(() => {
                rafId = 0
                // Ejecutar después del ResizeObserver interno de JASSUB para no ser pisado.
                timerId = window.setTimeout(sync, 24)
            })
        }

        scheduleSync()

        const stage = video.parentElement
        if (typeof ResizeObserver === "undefined") {
            return () => {
                cancelled = true
                if (rafId) cancelAnimationFrame(rafId)
                if (timerId) window.clearTimeout(timerId)
            }
        }

        const observer = new ResizeObserver(() => {
            if (aspectRatioRef.current !== "contain") {
                scheduleSync()
            }
        })
        if (stage) observer.observe(stage)
        observer.observe(video)

        return () => {
            cancelled = true
            observer.disconnect()
            if (rafId) cancelAnimationFrame(rafId)
            if (timerId) window.clearTimeout(timerId)
        }
    }, [aspectRatio, activeSubtitleIndex, trackUrl, videoRef, jassubRef])
}
