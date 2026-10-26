'use no memo'
import { useEffect, useRef } from "react"
import type JASSUB from "jassub"
import { SubtitleTrack } from "@/components/ui/track-types"
import { convertToAss, scaleAssStyles } from "./subtitle-convert"
import { __isTV__ } from "@/types/constants"
import { useSubtitleLoadStore } from "./subtitle-load-store"
import { SubtitleFetchError, describeSubtitleError } from "./subtitle-messages"

interface UsePlayerJassubProps {
    videoRef: React.RefObject<HTMLVideoElement | null>
    jassubRef: React.MutableRefObject<JASSUB | null>
    activeSubtitleIndex: number | null
    subtitleTracks: SubtitleTrack[]
    subtitleSizePref: number
    fontUrls?: string[]
    /**
     * Sube cuando el servidor tiene subtítulos nuevos de una pista progresiva (Drive por
     * franjas): se vuelve a pedir y se reemplaza en el renderer sin recrearlo.
     */
    refreshKey?: number
    setIsJassubLoading: (loading: boolean) => void
    setIsJassubActive: (active: boolean) => void
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
    fontUrls,
    refreshKey = 0,
    setIsJassubLoading,
    setIsJassubActive,
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
                    setIsJassubActive(false)
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

        if (!isSupported || __isTV__) {
            if (currentJassubRef.current) {
                currentJassubRef.current.destroy()
                setRefValue(currentJassubRef, null)
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
                    setIsJassubActive(false)
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
                    fonts: fontUrls ?? [],
                })

                if (isCancelled) {
                    jassub.destroy()
                    return
                }

                setRefValue(currentJassubRef, jassub)
                setIsJassubActive(true)
                setIsJassubLoading(false)
                reportLoad("idle")
                if (trackProgressive && latestRefreshKeyRef.current !== appliedRefreshKeyRef.current) {
                    refreshProgressiveRef.current?.()
                }
            } catch (err) {
                console.error("jassub: Failed to initialize:", err)
                if (!isCancelled) {
                    setIsJassubLoading(false)
                    setIsJassubActive(false)
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
                setIsJassubActive(false)
            }
        }
    }, [activeSubtitleIndex, trackUrl, trackCodec, trackProgressive, fontUrls, videoRef, jassubRef, setIsJassubLoading, setIsJassubActive])

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
                    await jassub.resize(true)
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
    }, [trackUrl, trackCodec, trackProgressive, jassubRef])

    useEffect(() => {
        if (appliedRefreshKeyRef.current === refreshKey) return
        refreshProgressiveRef.current?.()
    }, [refreshKey])

    // Tamaño de subtítulos en caliente: reescala los estilos del documento ASS y
    // reemplaza la pista en el renderer existente (resize(true) fuerza el repintado
    // aunque el video esté en pausa).
    // Solo depende del tamaño: una instancia nueva ya nace con el tamaño vigente.
    useEffect(() => {
        const jassub = jassubRef.current
        const cached = cachedAssContentRef.current
        if (!jassub || !cached) return
        const content = scaleAssStyles(cached.content, subtitleSizePref / 100)
        jassub.ready
            .then(async () => {
                if (jassubRef.current !== jassub) return
                await jassub.renderer.setTrack(content)
                await jassub.resize(true)
            })
            .catch((err: unknown) => console.warn("jassub: no se pudo aplicar el tamaño de subtítulos:", err))
    }, [subtitleSizePref, jassubRef])
    // Note: JASSUB owns canvas sizing via its internal ResizeObserver. Because the
    // canvas control is transferred to the offscreen worker (useOffscreen + app-supplied
    // canvas), writing canvas.width/height on the main thread throws InvalidStateError
    // and fights the library — so we deliberately do not resize the canvas manually here.
}
