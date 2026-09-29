import React, { useState, useEffect, useRef, useCallback } from "react"
import { formatPlaybackTime } from "./format-playback-time"

/** Intervalo mínimo entre seeks reales del <video> mientras se hace scrub. */
export const SEEK_THROTTLE_MS = 180

/**
 * Mueve la reproducción. Función de módulo a propósito: el <video> llega por un
 * ref del llamador y React Compiler no permite mutar argumentos de un hook.
 */
function setVideoTime(video: HTMLVideoElement, time: number) {
    video.currentTime = time
}

type UsePlayerSeekOptions = {
    videoRef: React.RefObject<HTMLVideoElement | null>
    /** Avisa a usePlayerSkip de un salto manual (anula auto-skips en esa zona). */
    checkManualSkipOverrides: (time: number) => void
    triggerControlsVisibility: () => void
}

/**
 * Seek del reproductor: actualiza la barra y el tiempo al instante, pero
 * limita los seeks reales del <video> (cada uno puede disparar una petición de
 * segmento) y no los hace mientras el usuario arrastra el slider.
 */
export function usePlayerSeek({
    videoRef,
    checkManualSkipOverrides,
    triggerControlsVisibility,
}: UsePlayerSeekOptions) {
    // Barra de progreso y texto de tiempo: se actualizan por DOM (sin re-render)
    // desde el seek y desde timeupdate en player-core.
    const progressBarRef = useRef<HTMLDivElement>(null)
    const timeTextRef = useRef<HTMLSpanElement>(null)
    const [isSeeking, setIsSeeking] = useState(false)
    const isSeekingRef = useRef(false)
    const lastSeekTimeRef = useRef(0)
    const pendingSeekTimeRef = useRef<number | null>(null)
    const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const performSeek = useCallback((time: number) => {
        const video = videoRef.current
        if (!video || !Number.isFinite(time)) return

        setIsSeeking(true)
        checkManualSkipOverrides(time)

        // Visual update of elements instantly
        if (progressBarRef.current) {
            const percent = video.duration > 0 ? (time / video.duration) : 0
            progressBarRef.current.style.transform = `scaleX(${percent})`
        }
        if (timeTextRef.current) {
            timeTextRef.current.innerText = formatPlaybackTime(time)
        }

        if (isSeekingRef.current) {
            // Do not perform actual video seek while dragging to avoid flooding requests
            return
        }

        const now = Date.now()

        if (now - lastSeekTimeRef.current >= SEEK_THROTTLE_MS) {
            setVideoTime(video, time)
            lastSeekTimeRef.current = now
            pendingSeekTimeRef.current = null
        } else {
            pendingSeekTimeRef.current = time
            if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current)
            seekTimeoutRef.current = setTimeout(() => {
                const latestTime = pendingSeekTimeRef.current
                if (latestTime !== null && video) {
                    setVideoTime(video, latestTime)
                    lastSeekTimeRef.current = Date.now()
                    pendingSeekTimeRef.current = null
                }
            }, SEEK_THROTTLE_MS - (now - lastSeekTimeRef.current))
        }
    }, [videoRef, checkManualSkipOverrides])

    const handleSeekStart = useCallback(() => {
        isSeekingRef.current = true
    }, [])

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value)
        performSeek(val)
        triggerControlsVisibility()
    }, [performSeek, triggerControlsVisibility])

    const handleSeekEnd = useCallback((e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {
        const video = videoRef.current
        if (!video) return

        isSeekingRef.current = false
        setIsSeeking(false)
        if (seekTimeoutRef.current) {
            clearTimeout(seekTimeoutRef.current)
            seekTimeoutRef.current = null
        }

        const val = parseFloat(e.currentTarget.value)
        if (!Number.isFinite(val)) return
        checkManualSkipOverrides(val)
        setVideoTime(video, val)
        lastSeekTimeRef.current = Date.now()
        pendingSeekTimeRef.current = null

        triggerControlsVisibility()
    }, [videoRef, checkManualSkipOverrides, triggerControlsVisibility])

    useEffect(() => {
        return () => {
            if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current)
        }
    }, [])

    const skipTime = useCallback((amount: number) => {
        const video = videoRef.current
        if (!video) return
        const dur = Number.isFinite(video.duration) ? video.duration : Infinity
        const target = Math.max(0, Math.min(dur, video.currentTime + amount))

        performSeek(target)
        triggerControlsVisibility()
    }, [videoRef, performSeek, triggerControlsVisibility])

    return { progressBarRef, timeTextRef, isSeeking, setIsSeeking, isSeekingRef, performSeek, handleSeekStart, handleSeek, handleSeekEnd, skipTime }
}
