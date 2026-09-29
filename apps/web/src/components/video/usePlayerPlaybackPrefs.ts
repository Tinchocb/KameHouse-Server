import { useEffect, useCallback } from "react"
import type React from "react"

interface UsePlayerPlaybackPrefsProps {
    videoRef: React.RefObject<HTMLVideoElement | null>
    status: "loading" | "ready" | "error"
    playbackRate: number
    setPlaybackRate: (rate: number) => void
    loopEnabled: boolean
}

/** Aplica velocidad y loop preferidos al <video>, también tras cada carga de stream. */
export function usePlayerPlaybackPrefs({ videoRef, status, playbackRate, setPlaybackRate, loopEnabled }: UsePlayerPlaybackPrefsProps) {
    const changePlaybackRate = useCallback((rate: number) => {
        // La preferencia se guarda siempre (antes se perdía si aún no había <video>);
        // defaultPlaybackRate hace que sobreviva al load() de un cambio de fuente.
        setPlaybackRate(rate)
        const video = videoRef.current
        if (!video) return
        video.defaultPlaybackRate = rate
        video.playbackRate = rate
    }, [setPlaybackRate, videoRef])

    useEffect(() => {
        const video = videoRef.current
        // eslint-disable-next-line react-compiler/react-compiler -- elemento <video> vía ref, no estado de React
        if (video) video.loop = loopEnabled
    }, [loopEnabled, status, videoRef])

    // status en deps: un stream nuevo arranca a 1x hasta que se vuelve a aplicar.
    useEffect(() => {
        const video = videoRef.current
        if (!video) return
        video.defaultPlaybackRate = playbackRate
        if (video.playbackRate !== playbackRate) video.playbackRate = playbackRate
    }, [status, playbackRate, videoRef])

    return { changePlaybackRate }
}
