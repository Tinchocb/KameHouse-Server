import { useEffect } from "react"
import JASSUB from "jassub"
import { SubtitleTrack } from "@/components/ui/track-types"

interface UsePlayerJassubProps {
    videoRef: React.RefObject<HTMLVideoElement | null>
    canvasRef: React.RefObject<HTMLCanvasElement | null>
    jassubRef: React.MutableRefObject<any>
    activeSubtitleIndex: number | null
    subtitleTracks: SubtitleTrack[]
    subtitleSizePref: number
    setIsJassubLoading: (loading: boolean) => void
    setIsJassubActive: (active: boolean) => void
}

export function usePlayerJassub({
    videoRef,
    canvasRef,
    jassubRef,
    activeSubtitleIndex,
    subtitleTracks,
    subtitleSizePref,
    setIsJassubLoading,
    setIsJassubActive,
}: UsePlayerJassubProps) {
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
                    prescaleFactor: subtitleSizePref / 100,
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
    }, [activeSubtitleIndex, subtitleTracks, subtitleSizePref, videoRef, canvasRef, jassubRef, setIsJassubLoading, setIsJassubActive])

    // Canvas size updating
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
    }, [videoRef, canvasRef, jassubRef])
}
