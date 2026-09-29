import React, { useState, useEffect, useCallback } from "react"

type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void }

type UsePlayerFullscreenOptions = {
    containerRef: React.RefObject<HTMLDivElement | null>
    videoRef: React.RefObject<HTMLVideoElement | null>
    /** Refleja el estado en el store global (oculta la navbar, etc.). */
    setGlobalFullscreen: (isFs: boolean) => void
}

/**
 * Pantalla completa del reproductor. Escucha tanto la Fullscreen API del
 * navegador como el evento de ventana de Tauri (F11 / botón del sistema), y al
 * desmontar sale de pantalla completa y limpia el flag global.
 */
export function usePlayerFullscreen({ containerRef, videoRef, setGlobalFullscreen }: UsePlayerFullscreenOptions) {
    const [isFullscreen, setIsFullscreen] = useState(false)

    const toggleFullscreen = useCallback(() => {
        const container = containerRef.current
        const video = videoRef.current as WebkitVideo | null
        if (!container) return

        if (!document.fullscreenElement) {
            if (container.requestFullscreen) {
                container.requestFullscreen()
                    .then(() => setIsFullscreen(true))
                    .catch((err) => console.error("Error entering fullscreen:", err))
            } else if (video?.webkitEnterFullscreen) {
                try {
                    video.webkitEnterFullscreen()
                    setIsFullscreen(true)
                } catch (err) {
                    console.error("webkitEnterFullscreen error:", err)
                }
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen()
                    .then(() => setIsFullscreen(false))
            }
        }
    }, [containerRef, videoRef])

    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFs = Boolean(document.fullscreenElement)
            setIsFullscreen(isFs)
            setGlobalFullscreen(isFs)
        }
        document.addEventListener("fullscreenchange", handleFullscreenChange)
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange)
            setGlobalFullscreen(false)
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.error("Error exiting fullscreen on unmount:", err))
            }
        }
    }, [setGlobalFullscreen])

    useEffect(() => {
        const desktopApi = window.desktop
        if (!desktopApi) return

        const unsub = desktopApi.on("window:fullscreen", (...args: unknown[]) => {
            const isFs = args[0] as boolean
            setIsFullscreen(isFs)
            setGlobalFullscreen(isFs)
        })

        return () => {
            unsub?.()
        }
    }, [setGlobalFullscreen])

    return { isFullscreen, toggleFullscreen }
}
