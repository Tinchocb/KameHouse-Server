import { useEffect } from "react"
import type React from "react"

/** Pausa al ocultarse la página o suspenderse la app. */
export function usePlayerVisibilityPause({ videoRef, setIsPlaying }: {
    videoRef: React.RefObject<HTMLVideoElement | null>
    setIsPlaying: (playing: boolean) => void
}) {
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                const video = videoRef.current
                if (video && !video.paused) {
                    video.pause()
                    setIsPlaying(false)
                }
            }
        }
        document.addEventListener("visibilitychange", handleVisibilityChange)
        document.addEventListener("webkitvisibilitychange", handleVisibilityChange)
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
            document.removeEventListener("webkitvisibilitychange", handleVisibilityChange)
        }
    }, [setIsPlaying, videoRef])
}
