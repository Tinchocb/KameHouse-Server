/**
 * useJassub.ts
 *
 * React hook that manages the lifecycle of a JASSUB (jassub v2) WebAssembly
 * worker for rendering advanced `.ass` anime subtitle tracks.
 *
 * ─── What jassub does ────────────────────────────────────────────────────────
 * JASSUB renders ASS/SSA subtitles via libass compiled to WASM. It renders each
 * subtitle frame off-screen in a worker thread, then composites the result onto
 * a canvas that is layered over the <video> element. Swapping the subtitle track
 * is done by calling `instance.setTrack("<ass-file-content-string>")` —
 * NO video reload is needed.
 *
 * ─── Worker files (already in place) ─────────────────────────────────────────
 * public/jassub/jassub-worker.js          — JS glue code
 * public/jassub/jassub-worker.wasm        — libass WASM binary (legacy)
 * public/jassub/jassub-worker-modern.wasm — libass WASM binary (modern)
 *
 * ─── Subtitle URL contract ───────────────────────────────────────────────────
 * `loadTrack(url)` fetches the raw `.ass` text from the backend.
 * Backend endpoint:
 *   GET /api/v1/mediastream/subtitle?streamId=<id>&trackIndex=<n>
 * The backend should respond with `Content-Type: text/plain` and the raw .ass
 * file contents (extracted via `ffmpeg -i <file> -map 0:s:<n> <out.ass>`).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useCallback, useState } from "react"
// JASSUB has no bundled types — import the constructor shape we need.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JASSubInstance = any

interface UseJassubOptions {
    /** The <canvas> element that JASSUB will composite subtitles onto. */
    canvasRef: React.RefObject<HTMLCanvasElement | null>
    /** The <video> element JASSUB syncs with for timing. */
    videoRef: React.RefObject<HTMLVideoElement | null>
    /**
     * Optional initial subtitle `.ass` URL to load on mount.
     * Pass `null` / `undefined` to start with no subtitles visible.
     */
    initialSubtitleUrl?: string | null
}

interface UseJassubReturn {
    /**
     * Fetch a `.ass` subtitle file from `url` and hand it to the JASSUB worker.
     * The video keeps playing — only the subtitle canvas content changes.
     *
     * @param url - URL of the `.ass` file served by the backend.
     */
    loadTrack: (url: string) => Promise<void>
    /**
     * Hide all subtitles without destroying the worker. Call `loadTrack` again
     * to re-enable.
     */
    clearTrack: () => void
    /** True while a subtitle fetch is in-flight. */
    isLoadingSubtitle: boolean
    /** Non-null if the last `loadTrack` call failed. */
    subtitleError: string | null
    /** True once the JASSUB worker has initialised and is ready. */
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

        // Dynamic import keeps jassub out of the initial JS bundle.
        // The npm package re-exports its default as the constructor.
        import("jassub").then(({ default: JASSUB }) => {
            if (destroyed) return

            /**
             * JASSUB constructor options — see jassub docs for the full API.
             * https://github.com/ThaUnknown/jassub
             */
            const instance: JASSubInstance = new JASSUB({
                // The <canvas> that will be placed on top of the video.
                canvas,
                // The <video> element — JASSUB reads its `currentTime` for sync.
                video,
                // Worker script — served from public/ so it loads at any path.
                workerUrl: "/jassub/jassub-worker.js",
                // WebAssembly binaries — the worker picks the right one at runtime.
                wasmUrl: "/jassub/jassub-worker.wasm",
                modernWasmUrl: "/jassub/jassub-worker-modern.wasm",
                /**
                 * JASSUBOptions is a discriminated union that requires either
                 * `subUrl` or `subContent`. We start with an empty string so the
                 * worker initialises cleanly. The actual .ass content is pushed
                 * later via `instance.setTrack(assText)` when the user selects a
                 * subtitle track.
                 */
                subContent: "",
                // Logging suppressed in production.
                debug: import.meta.env.DEV,
            })

            jassubRef.current = instance
            setIsReady(true)
        }).catch((err) => {
            if (!destroyed) {
                console.error("[useJassub] Failed to initialise jassub worker:", err)
                setSubtitleError("No se pudo cargar el motor de subtítulos ASS.")
            }
        })

        return () => {
            destroyed = true
            // JASSUB exposes `destroy()` to clean up the worker thread + canvas.
            jassubRef.current?.destroy()
            jassubRef.current = null
            setIsReady(false)
        }
        // We intentionally only run this once per mount — canvasRef & videoRef are stable refs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            /**
             * Fetch the raw `.ass` text from the backend.
             *
             * The backend endpoint should respond with the raw ASS file content:
             *   GET /api/v1/mediastream/subtitle?streamId=X&trackIndex=N
             *
             * Make sure the backend sets:
             *   Content-Type: text/plain; charset=utf-8
             *   Access-Control-Allow-Origin: *  (if the player is cross-origin)
             */
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
            const assText = await response.text()

            /**
             * `setTrack(content: string)` — the key JASSUB API for dynamic track swapping.
             *
             * Internals: this call serialises `assText` into the worker via postMessage,
             * the worker re-parses libass state in the WASM heap, and from the next
             * animation frame the new subtitles are drawn onto the canvas.
             * NO video reload, NO stream restart — frame-accurate instant swap.
             */
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
        /**
         * `freeTrack()` — tells JASSUB to stop rendering and clear the canvas.
         * The worker stays alive; calling `setTrack()` again re-enables subs.
         */
        jassubRef.current.freeTrack?.()
        setSubtitleError(null)
    }, [])

    return { loadTrack, clearTrack, isLoadingSubtitle, subtitleError, isReady }
}
