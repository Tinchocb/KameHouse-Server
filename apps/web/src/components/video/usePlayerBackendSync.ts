import React, { useEffect, useRef, useCallback } from "react"
import { useAnimeTracking } from "@/api/hooks/useAnimeTracking"
import { usePlayerProgressSync } from "@/api/hooks/usePlayerProgressSync"
import { useGetSettings } from "@/api/hooks/settings.hooks"
import { isUsableDuration } from "./usePlayerDuration"

/** Intervalo mínimo entre envíos de progreso al servidor durante la reproducción. */
const BACKEND_SYNC_INTERVAL_MS = 5000

type UsePlayerBackendSyncOptions = {
    videoRef: React.RefObject<HTMLVideoElement | null>
    mediaId?: number
    episodeNumber?: number
    /** Ruta del archivo que se reproduce (identifica el progreso en el server). */
    filepath: string
    /** Cambia cuando hay que reiniciar el tracking (URL del stream: episodio o fuente nuevos). */
    resetKey: string
    /** Duración saneada (fallback cuando video.duration no es finita). */
    duration: number
    sendJsonMessage: (message: { type: string; payload: unknown }) => void
}

/**
 * Progreso de reproducción hacia el servidor: heartbeat por WebSocket,
 * tracking de episodios vistos y sync de continuidad. Todo sale junto, como
 * mucho cada BACKEND_SYNC_INTERVAL_MS, y forzado al pausar y al desmontar.
 */
export function usePlayerBackendSync({
    videoRef,
    mediaId,
    episodeNumber,
    filepath,
    resetKey,
    duration,
    sendJsonMessage,
}: UsePlayerBackendSyncOptions) {
    const { data: serverSettings } = useGetSettings()
    const enableWatchContinuity = serverSettings?.library?.enableWatchContinuity ?? true
    const enabled = !!(mediaId && episodeNumber && enableWatchContinuity)

    const { onProgress: onTrackingProgress, reset: resetTracking } = useAnimeTracking({
        mediaId,
        episodeNumber,
        filepath,
        enabled,
    })

    const { onProgress: onSyncProgress } = usePlayerProgressSync({
        mediaId,
        episodeNumber,
        filepath,
        enabled,
    })

    const sendHeartbeat = useCallback((curr: number, dur: number) => {
        if (!mediaId || episodeNumber == null || episodeNumber < 0) return
        const progress = dur > 0 ? curr / dur : 0
        sendJsonMessage({
            type: "native-player",
            payload: {
                eventType: "playback-heartbeat-progress",
                mediaId,
                episodeNumber,
                currentTime: curr,
                duration: dur,
                progress: Math.round(progress * 10000) / 10000,
            },
        })
    }, [mediaId, episodeNumber, sendJsonMessage])

    const lastBackendSyncTimeRef = useRef(0)

    const flushBackendSync = useCallback((force = false) => {
        const video = videoRef.current
        if (!video) return
        const curr = video.currentTime
        const total = isUsableDuration(video.duration) ? video.duration : duration
        const now = Date.now()

        if (force || now - lastBackendSyncTimeRef.current >= BACKEND_SYNC_INTERVAL_MS) {
            lastBackendSyncTimeRef.current = now
            sendHeartbeat(curr, total)
            onSyncProgress(curr, total)
            onTrackingProgress(curr, total)
        }
    }, [videoRef, duration, sendHeartbeat, onSyncProgress, onTrackingProgress])

    // Último progreso al desmontar (cerrar el reproductor, cambiar de episodio).
    useEffect(() => {
        return () => {
            flushBackendSync(true)
        }
    }, [flushBackendSync])

    useEffect(() => {
        resetTracking()
    }, [mediaId, episodeNumber, resetKey, resetTracking])

    return { flushBackendSync }
}
