'use no memo'
import { useEffect, useRef } from "react"
import type JASSUB from "jassub"
import { SubtitleTrack } from "@/components/ui/track-types"
import { convertToAss, scaleAssStyles } from "./subtitle-convert"

interface UsePlayerJassubProps {
    videoRef: React.RefObject<HTMLVideoElement | null>
    canvasRef: React.RefObject<HTMLCanvasElement | null>
    jassubRef: React.MutableRefObject<JASSUB | null>
    activeSubtitleIndex: number | null
    subtitleTracks: SubtitleTrack[]
    subtitleSizePref: number
    fontUrls?: string[]
    setIsJassubLoading: (loading: boolean) => void
    setIsJassubActive: (active: boolean) => void
}

function setRefValue<T>(ref: React.MutableRefObject<T>, value: T) {
    ref.current = value
}

export function usePlayerJassub({
    videoRef,
    canvasRef: _canvasRef,
    jassubRef,
    activeSubtitleIndex,
    subtitleTracks,
    subtitleSizePref,
    fontUrls,
    setIsJassubLoading,
    setIsJassubActive,
}: UsePlayerJassubProps) {
    const cachedAssContentRef = useRef<{ url: string; content: string } | null>(null)
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

        const isTv = typeof navigator !== "undefined" && (
            /SmartTV/i.test(navigator.userAgent) ||
            /Tizen/i.test(navigator.userAgent) ||
            /WebOS/i.test(navigator.userAgent) ||
            /Web0S/i.test(navigator.userAgent)
        )
        // Supported codec families:
        //   ass/ssa   → native ASS (full styling support)
        //   subrip    → SRT text (libass handles .srt content via subContent)
        //   vtt       → WebVTT text (libass handles simple VTT via subContent)
        // Image-based codecs (PGS/DVB) are excluded — they have isImageBased=true
        // and no URL, so they never reach this hook.
        const codec = trackCodec?.toLowerCase() ?? ""
        const isSupported = codec === "ass" || codec === "ssa" || codec === "subrip" || codec === "vtt"

        if (!isSupported || isTv) {
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

        const initJassub = async () => {
            try {
                let assContent = ""
                if (cachedAssContentRef.current?.url === trackUrl) {
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
                                throw new Error(`subtitle not available (HTTP ${res.status})`)
                            }
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
            } catch (err) {
                console.error("jassub: Failed to initialize:", err)
                if (!isCancelled) {
                    setIsJassubLoading(false)
                    setIsJassubActive(false)
                }
            }
        }

        initJassub()

        return () => {
            isCancelled = true
            try {
                aborter.abort()
            } catch {}
            if (currentJassubRef.current) {
                currentJassubRef.current.destroy()
                setRefValue(currentJassubRef, null)
                setIsJassubLoading(false)
                setIsJassubActive(false)
            }
        }
    }, [activeSubtitleIndex, trackUrl, trackCodec, fontUrls, videoRef, jassubRef, setIsJassubLoading, setIsJassubActive])

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
