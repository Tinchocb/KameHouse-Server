'use no memo'
import { useEffect, useState } from "react"

/**
 * Indica si el <video> terminó. Vuelve a false al reproducir o al saltar hacia
 * atrás. El setter se expone porque el reinicio por cambio de episodio también
 * lo limpia.
 */
export function usePlayerVideoEnded(videoRef: React.RefObject<HTMLVideoElement | null>) {
    const [videoEnded, setVideoEnded] = useState(false)

    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const handleEnded = () => setVideoEnded(true)
        const handlePlay = () => setVideoEnded(false)
        const handleSeeked = () => setVideoEnded(video.ended)

        video.addEventListener("ended", handleEnded)
        video.addEventListener("play", handlePlay)
        video.addEventListener("seeked", handleSeeked)
        setVideoEnded(video.ended)

        return () => {
            video.removeEventListener("ended", handleEnded)
            video.removeEventListener("play", handlePlay)
            video.removeEventListener("seeked", handleSeeked)
        }
    }, [videoRef])

    return [videoEnded, setVideoEnded] as const
}
