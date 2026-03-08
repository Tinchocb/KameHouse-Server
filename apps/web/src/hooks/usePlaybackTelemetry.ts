import { useCallback, useRef } from "react"
import { useServerMutation } from "@/api/client/requests"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlaybackSyncPayload {
    mediaId: number
    episodeNumber: number
    progress: number       // 0.0 - 1.0
    currentTime: number    // seconds
    duration: number       // seconds
    totalEpisodes: number
    malId?: number
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Custom hook that sends debounced playback telemetry to the backend.
 *
 * - Sends progress every `intervalMs` (default 10s) via REST POST
 * - Sends a final payload on `onEnded`
 * - Uses a trailing debounce so only one request is in-flight at a time
 *
 * Usage:
 *   const telemetry = usePlaybackTelemetry({ mediaId, episodeNumber, totalEpisodes })
 *   <video onTimeUpdate={telemetry.handleTimeUpdate} onEnded={telemetry.handleEnded} />
 */
export function usePlaybackTelemetry({
    mediaId,
    episodeNumber,
    totalEpisodes = 0,
    malId,
    intervalMs = 10_000,
}: {
    mediaId: number | undefined
    episodeNumber: number | undefined
    totalEpisodes?: number
    malId?: number
    intervalMs?: number
}) {
    const { mutate: syncPlayback } = useServerMutation<boolean, PlaybackSyncPayload>({
        endpoint: "/api/v1/playback/sync",
        method: "POST",
        mutationKey: ["playback-sync"],
    })

    // Timestamp of last sent payload
    const lastSentRef = useRef(0)
    // Whether we've already sent the "ended" signal
    const endedSentRef = useRef(false)

    const sendSync = useCallback((video: HTMLVideoElement, force = false) => {
        if (!mediaId || !episodeNumber) return
        if (video.duration === 0 || isNaN(video.duration)) return

        const now = Date.now()
        if (!force && now - lastSentRef.current < intervalMs) return

        lastSentRef.current = now

        const progress = video.currentTime / video.duration

        syncPlayback({
            mediaId,
            episodeNumber,
            progress,
            currentTime: video.currentTime,
            duration: video.duration,
            totalEpisodes,
            malId,
        })
    }, [mediaId, episodeNumber, totalEpisodes, malId, intervalMs, syncPlayback])

    /** Attach to <video>.onTimeUpdate */
    const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
        sendSync(e.currentTarget)
    }, [sendSync])

    /** Attach to <video>.onEnded — forces a final sync */
    const handleEnded = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
        if (endedSentRef.current) return
        endedSentRef.current = true
        sendSync(e.currentTarget, true)
    }, [sendSync])

    /** Reset state (call if the video/episode changes) */
    const reset = useCallback(() => {
        lastSentRef.current = 0
        endedSentRef.current = false
    }, [])

    return { handleTimeUpdate, handleEnded, reset }
}
