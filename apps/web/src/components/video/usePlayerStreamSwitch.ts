import { useState, useEffect, useCallback } from "react"
import type React from "react"
import type { PlayerCoreProps } from "./player-core.types"

export type StreamSwitchReason = "audio" | "source" | "fallback"

/**
 * Congela el cuadro actual como póster antes de reconstruir el stream (cambio de
 * pista o de fuente): al cambiar el src el <video> se vacía y, debajo del overlay
 * semitransparente, se veía negro hasta el primer cuadro del stream nuevo.
 */
export function freezeCurrentFrame(video: HTMLVideoElement | null) {
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return
    try {
        const scale = Math.min(1, 1280 / video.videoWidth)
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        video.poster = canvas.toDataURL("image/jpeg", 0.85)
    } catch {
        // Canvas contaminado (origen cruzado sin CORS) o frame no disponible: sin póster.
    }
}

interface UsePlayerStreamSwitchProps {
    videoRef: React.RefObject<HTMLVideoElement | null>
    streamSwitchResumeRef: React.MutableRefObject<number | null>
    status: "loading" | "ready" | "error"
    mediaId: PlayerCoreProps["mediaId"]
    episodeNumber: PlayerCoreProps["episodeNumber"]
    streamType: PlayerCoreProps["streamType"]
    onRequestStreamTypeChange: PlayerCoreProps["onRequestStreamTypeChange"]
}

/**
 * Cambio de stream a mitad de reproducción (pista de audio, Direct ↔ Transcode o
 * fallback automático): retoma en el mismo punto y marca el switch para que el
 * overlay de carga sea semitransparente sobre el cuadro congelado, no negro sólido.
 */
export function usePlayerStreamSwitch({
    videoRef,
    streamSwitchResumeRef,
    status,
    mediaId,
    episodeNumber,
    streamType,
    onRequestStreamTypeChange,
}: UsePlayerStreamSwitchProps) {
    const [isStreamSwitching, setIsStreamSwitching] = useState(false)
    // Motivo del cambio de stream, para que el overlay diga lo que realmente pasa.
    const [streamSwitchReason, setStreamSwitchReason] = useState<StreamSwitchReason>("audio")

    // usePlayerHls solo marca el switch en el fallback direct→transcode.
    const setFallbackStreamSwitching = useCallback((switching: boolean) => {
        if (switching) setStreamSwitchReason("fallback")
        setIsStreamSwitching(switching)
    }, [])

    // Cambio de pista que reconstruye el stream.
    const onAudioStreamSwitch = useCallback((resumeAt: number | null) => {
        freezeCurrentFrame(videoRef.current)
        // eslint-disable-next-line react-compiler/react-compiler -- ref compartida con usePlayerHls, no estado
        streamSwitchResumeRef.current = resumeAt
        setStreamSwitchReason("audio")
        setIsStreamSwitching(true)
    }, [videoRef, streamSwitchResumeRef])

    // Cambio de fuente desde el menú (Direct Play ↔ Transcodificado): retoma en el
    // mismo punto, igual que el cambio de pista de audio.
    const switchSource = useCallback((type: string) => {
        if (type === streamType) return
        if (type !== "direct" && type !== "transcode") return
        if (!onRequestStreamTypeChange) return
        const current = videoRef.current?.currentTime ?? 0
        streamSwitchResumeRef.current = Number.isFinite(current) && current > 0 ? current : null
        freezeCurrentFrame(videoRef.current)
        setStreamSwitchReason("source")
        setIsStreamSwitching(true)
        // Elección explícita del usuario: igual que el cambio de pista de audio,
        // force permite transcodificar aunque el toggle global esté apagado.
        onRequestStreamTypeChange(type, { force: type === "transcode" })
    }, [streamType, onRequestStreamTypeChange, videoRef, streamSwitchResumeRef])

    useEffect(() => {
        const timer = setTimeout(() => {
            // Nuevo episodio: nunca es un stream-switch, el loading inicial usa fondo negro sólido.
            setIsStreamSwitching(false)
        }, 0)
        return () => clearTimeout(timer)
        // Solo al cambiar de episodio: un switch de audio/fuente también cambia la
        // URL (direct → "" → HLS) y resetear acá apagaba el overlay del switch a
        // mitad de camino, dejando la pantalla en negro sólido.
    }, [mediaId, episodeNumber])

    // Stream listo (carga inicial o tras un switch): limpiar el overlay.
    useEffect(() => {
        if (status === "ready") {
            // El póster congelado del switch ya no hace falta: hay cuadros nuevos.
            videoRef.current?.removeAttribute("poster")
            const timer = setTimeout(() => {
                setIsStreamSwitching(false)
            }, 0)
            return () => clearTimeout(timer)
        }
    }, [status, videoRef])

    return { isStreamSwitching, streamSwitchReason, setFallbackStreamSwitching, onAudioStreamSwitch, switchSource }
}
