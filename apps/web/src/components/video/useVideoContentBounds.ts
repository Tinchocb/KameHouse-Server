import { useEffect, useRef, useState } from "react"
import {
    type AspectRatioMode,
    BlackBarConsensusTracker,
    FULL_FRAME_BOUNDS,
    type NormalizedBounds,
    boundsSignificantlyEqual,
    detectBlackBarsFromPixels,
} from "./video-aspect"

const SAMPLE_WIDTH = 192
const SAMPLE_HEIGHT = 108
const ACTIVE_POLL_INTERVAL_MS = 1500
const WARMUP_MAX_SAMPLES = 4

interface UseVideoContentBoundsOptions {
    videoRef: React.RefObject<HTMLVideoElement | null>
    playableUrl: string
    aspectRatio: AspectRatioMode
}

/**
 * Periodically inspects `<video>` frames on a tiny offscreen canvas to detect
 * baked-in pillarbox/letterbox black bars (e.g. 4:3 DBZ inside 1920x1080).
 * Falls back safely to FULL_FRAME_BOUNDS when CORS blocks pixel readback or
 * while frames are dark.
 */
export function useVideoContentBounds({
    videoRef,
    playableUrl,
    aspectRatio,
}: UseVideoContentBoundsOptions): NormalizedBounds {
    const [boundsState, setBoundsState] = useState<{ url: string; bounds: NormalizedBounds }>({
        url: playableUrl,
        bounds: FULL_FRAME_BOUNDS,
    })
    const bounds = boundsState.url === playableUrl ? boundsState.bounds : FULL_FRAME_BOUNDS

    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
    const trackerRef = useRef(new BlackBarConsensusTracker(5))
    const lastUrlRef = useRef(playableUrl)
    const corsBlockedUrlRef = useRef<string | null>(null)
    const warmupCountRef = useRef(0)

    useEffect(() => {
        if (lastUrlRef.current !== playableUrl) {
            lastUrlRef.current = playableUrl
            trackerRef.current.reset()
            warmupCountRef.current = 0
        }

        const video = videoRef.current
        if (!video) return

        const commitBounds = (next: NormalizedBounds) => {
            setBoundsState((prev) => {
                const prevForUrl = prev.url === playableUrl ? prev.bounds : FULL_FRAME_BOUNDS
                if (boundsSignificantlyEqual(prevForUrl, next)) {
                    return prev.url === playableUrl ? prev : { url: playableUrl, bounds: prevForUrl }
                }
                return { url: playableUrl, bounds: next }
            })
        }

        const sampleFrame = () => {
            if (corsBlockedUrlRef.current === playableUrl) return
            if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return

            if (!canvasRef.current) {
                const canvas = document.createElement("canvas")
                canvas.width = SAMPLE_WIDTH
                canvas.height = SAMPLE_HEIGHT
                canvasRef.current = canvas
                ctxRef.current = canvas.getContext("2d", { willReadFrequently: true })
            }
            const ctx = ctxRef.current
            if (!ctx) return

            try {
                ctx.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
                const imgData = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
                const detected = detectBlackBarsFromPixels(imgData.data, SAMPLE_WIDTH, SAMPLE_HEIGHT)
                if (!detected) return

                warmupCountRef.current += 1
                commitBounds(trackerRef.current.push(detected))
            } catch {
                // Cross-origin stream without CORS headers: disable readback for this URL.
                corsBlockedUrlRef.current = playableUrl
                commitBounds(FULL_FRAME_BOUNDS)
            }
        }

        const handleSeeked = () => {
            trackerRef.current.reset()
            sampleFrame()
        }

        const handleLoaded = () => {
            sampleFrame()
        }

        const handleTimeUpdate = () => {
            if (warmupCountRef.current === 0) {
                sampleFrame()
            }
        }

        video.addEventListener("loadeddata", handleLoaded)
        video.addEventListener("canplay", handleLoaded)
        video.addEventListener("playing", handleLoaded)
        video.addEventListener("timeupdate", handleTimeUpdate)
        video.addEventListener("seeked", handleSeeked)

        const rafId = aspectRatio !== "contain" ? requestAnimationFrame(sampleFrame) : 0

        const intervalId = window.setInterval(() => {
            if (aspectRatio === "contain" && warmupCountRef.current >= WARMUP_MAX_SAMPLES) return
            if (video.paused && aspectRatio === "contain") return
            sampleFrame()
        }, ACTIVE_POLL_INTERVAL_MS)

        return () => {
            if (rafId) cancelAnimationFrame(rafId)
            window.clearInterval(intervalId)
            video.removeEventListener("loadeddata", handleLoaded)
            video.removeEventListener("canplay", handleLoaded)
            video.removeEventListener("playing", handleLoaded)
            video.removeEventListener("timeupdate", handleTimeUpdate)
            video.removeEventListener("seeked", handleSeeked)
        }
    }, [videoRef, playableUrl, aspectRatio])

    return bounds
}
