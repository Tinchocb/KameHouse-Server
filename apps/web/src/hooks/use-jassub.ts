/**
 * useJassub.ts
 *
 * React hook that manages the lifecycle of a JASSUB (jassub v2) WebAssembly
 * worker for rendering advanced `.ass` anime subtitle tracks.
 */

import { useEffect, useRef, useCallback, useState } from "react"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JASSubInstance = any

// Global cache to prevent re-fetching the 3MB+ WASM binaries across component remounts
const globalWasmCache: Record<string, string> = {}

async function getCachedWasmUrl(url: string): Promise<string> {
    if (globalWasmCache[url]) {
        return globalWasmCache[url]
    }
    const response = await fetch(url)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    globalWasmCache[url] = objectUrl
    return objectUrl
}

interface UseJassubOptions {
    canvasRef: React.RefObject<HTMLCanvasElement | null>
    videoRef: React.RefObject<HTMLVideoElement | null>
    initialSubtitleUrl?: string | null
}

interface UseJassubReturn {
    loadTrack: (url: string) => Promise<void>
    clearTrack: () => void
    isLoadingSubtitle: boolean
    subtitleError: string | null
    isReady: boolean
}

export function useJassub({
    canvasRef,
    videoRef,
    initialSubtitleUrl,
}: UseJassubOptions): UseJassubReturn {
    const jassubRef = useRef<JASSubInstance | null>(null)
    const [isReady, setIsReady] = useState(false)
    const [isLoadingSubtitle, setIsLoadingSubtitle] = useState(false)
    const [subtitleError, setSubtitleError] = useState<string | null>(null)

    // ── Initialise JASSUB worker ───────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current
        const video = videoRef.current
        if (!canvas || !video) return

        let destroyed = false

        async function initJassub() {
            try {
                // Dynamically import JASSUB
                const { default: JASSUB } = await import("jassub")
                if (destroyed) return

                // Pre-fetch WASM payloads into blobs to bypass network overhead on remounts
                const [wasmUrl, modernWasmUrl, workerUrl] = await Promise.all([
                    getCachedWasmUrl("/jassub/jassub-worker.wasm"),
                    getCachedWasmUrl("/jassub/jassub-worker-modern.wasm"),
                    getCachedWasmUrl("/jassub/jassub-worker.js")
                ])

                if (destroyed) return

                const instance: JASSubInstance = new JASSUB({
                    canvas: canvas as HTMLCanvasElement,
                    video: video as HTMLVideoElement,
                    workerUrl,
                    wasmUrl,
                    modernWasmUrl,
                    // 2. Transmute control to the worker strictly if the browser supports it
                    offscreenRender: typeof OffscreenCanvas !== 'undefined',
                    subContent: "",
                    debug: import.meta.env.DEV,
                } as any)

                jassubRef.current = instance
                setIsReady(true)
            } catch (err) {
                if (!destroyed) {
                    console.error("[useJassub] Failed to initialise jassub worker:", err)
                    setSubtitleError("No se pudo cargar el motor de subtítulos ASS.")
                }
            }
        }

        void initJassub()

        // 1. Memory Leak Prevention: Strict Cleanup
        return () => {
            destroyed = true
            if (jassubRef.current) {
                try {
                    jassubRef.current.destroy()
                } catch (e) {
                    console.error("[useJassub] Worker destruction error:", e)
                }
                jassubRef.current = null
            }
            setIsReady(false)
        }
    }, [])

    // ── Load initial track once worker is ready ────────────────────────────────
    useEffect(() => {
        if (!isReady || !initialSubtitleUrl) return
        void loadTrack(initialSubtitleUrl)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReady, initialSubtitleUrl])

    // ── loadTrack ─────────────────────────────────────────────────────────────
    const loadTrack = useCallback(async (url: string): Promise<void> => {
        if (!jassubRef.current) {
            setSubtitleError("Motor de subtítulos ASS no listo.")
            return
        }

        setIsLoadingSubtitle(true)
        setSubtitleError(null)

        try {
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
            const assText = await response.text()
            jassubRef.current.setTrack(assText)
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error("[useJassub] loadTrack failed:", msg)
            setSubtitleError(`Error al cargar subtítulos: ${msg}`)
        } finally {
            setIsLoadingSubtitle(false)
        }
    }, [])

    // ── clearTrack ────────────────────────────────────────────────────────────
    const clearTrack = useCallback(() => {
        if (!jassubRef.current) return
        jassubRef.current.freeTrack?.()
        setSubtitleError(null)
    }, [])

    return { loadTrack, clearTrack, isLoadingSubtitle, subtitleError, isReady }
}
