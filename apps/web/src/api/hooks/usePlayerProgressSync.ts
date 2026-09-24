import { useEffect, useRef, useCallback } from "react"
import { useUpdateContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"
import { saveLocalProgress } from "@/api/hooks/continuity-local"
import { sendContinuityOnExit } from "@/api/hooks/continuity-pending"
import type { UpdateContinuityWatchHistoryItem_Variables } from "@/api/generated/endpoint.types"

interface UsePlayerProgressSyncOptions {
    mediaId?: number
    episodeNumber?: number
    filepath?: string
    intervalMs?: number
    enabled?: boolean
}

export function usePlayerProgressSync({
    mediaId,
    episodeNumber,
    filepath,
    intervalMs = 15000,
    enabled = true,
}: UsePlayerProgressSyncOptions) {
    const { mutate: saveProgress } = useUpdateContinuityWatchHistoryItem({ background: true })
    const lastSavedTimeRef = useRef(0)
    const currentTimeRef = useRef(0)
    const durationRef = useRef(0)
    // Identidad del episodio en curso, legible desde onProgress (callback estable).
    const targetRef = useRef<{ mediaId: number; episodeNumber: number; filepath?: string } | null>(null)

    const onProgress = useCallback((currentTime: number, duration: number) => {
        currentTimeRef.current = currentTime
        durationRef.current = duration
        // Espejo local: player-core ya llama esto como mucho cada 5 s.
        const target = targetRef.current
        if (target) saveLocalProgress({ ...target, currentTime, duration })
    }, [])

    useEffect(() => {
        if (!enabled || !mediaId || !episodeNumber) {
            targetRef.current = null
            return
        }
        targetRef.current = { mediaId, episodeNumber, filepath }

        // Reset refs when starting a new episode sync session so that
        // previous episode progress does not leak when unmounting the new episode.
        currentTimeRef.current = 0
        lastSavedTimeRef.current = 0
        durationRef.current = 0

        const buildVariables = (): UpdateContinuityWatchHistoryItem_Variables => ({
            options: {
                mediaId,
                episodeNumber,
                currentTime: currentTimeRef.current,
                duration: durationRef.current,
                filepath,
                kind: "mediastream",
                predictive: false,
            },
        })

        // Don't save if we haven't moved much (e.g. less than 2 seconds since last save)
        const hasUnsavedProgress = () =>
            currentTimeRef.current > 0 && Math.abs(currentTimeRef.current - lastSavedTimeRef.current) >= 2

        const sync = () => {
            if (!hasUnsavedProgress()) return
            saveProgress(buildVariables())
            lastSavedTimeRef.current = currentTimeRef.current
        }

        // Cierre de pestaña / app en segundo plano: el intervalo y el unmount
        // no llegan a ejecutarse, así que se envía con keepalive.
        const flushOnExit = () => {
            if (!hasUnsavedProgress()) return
            sendContinuityOnExit(buildVariables())
            lastSavedTimeRef.current = currentTimeRef.current
        }
        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") flushOnExit()
        }

        const interval = setInterval(sync, intervalMs)
        window.addEventListener("pagehide", flushOnExit)
        document.addEventListener("visibilitychange", onVisibilityChange)

        return () => {
            clearInterval(interval)
            window.removeEventListener("pagehide", flushOnExit)
            document.removeEventListener("visibilitychange", onVisibilityChange)
            // Final sync on unmount if we have progress
            sync()
        }
    }, [enabled, mediaId, episodeNumber, filepath, intervalMs, saveProgress])

    return { onProgress }
}
