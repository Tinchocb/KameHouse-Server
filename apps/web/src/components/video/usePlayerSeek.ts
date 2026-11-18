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

function setElementThumbPercent(el: HTMLElement, percent: number) {
    el.style.transform = `translateX(${percent}%)`
}

function setInputValue(input: HTMLInputElement, value: string, ariaValueText: string) {
    input.value = value
    input.setAttribute("aria-valuetext", ariaValueText)
}

type UsePlayerSeekOptions = {
    videoRef: React.RefObject<HTMLVideoElement | null>
    thumbRef?: React.RefObject<HTMLDivElement | null>
    progressInputRef?: React.RefObject<HTMLInputElement | null>
    duration?: number
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
    thumbRef,
    progressInputRef,
    duration,
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

        const rawDur = video.duration
        const total = Number.isFinite(rawDur) && rawDur > 0 ? rawDur : (duration && Number.isFinite(duration) && duration > 0 ? duration : 0)
        const percent = total > 0 ? Math.max(0, Math.min(1, time / total)) : 0

        // Visual update of elements instantly
        if (progressBarRef.current) {
            progressBarRef.current.style.transform = `scaleX(${percent})`
        }
        if (thumbRef?.current) {
            setElementThumbPercent(thumbRef.current, percent * 100)
        }
        if (progressInputRef?.current) {
            setInputValue(progressInputRef.current, String(time), `${formatPlaybackTime(time)} de ${formatPlaybackTime(total)}`)
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
    }, [videoRef, thumbRef, progressInputRef, duration, checkManualSkipOverrides])

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

        const rawDur = video.duration
        const total = Number.isFinite(rawDur) && rawDur > 0 ? rawDur : (duration && Number.isFinite(duration) && duration > 0 ? duration : 0)
        const percent = total > 0 ? Math.max(0, Math.min(1, val / total)) : 0

        if (progressBarRef.current) {
            progressBarRef.current.style.transform = `scaleX(${percent})`
        }
        if (thumbRef?.current) {
            setElementThumbPercent(thumbRef.current, percent * 100)
        }
        if (progressInputRef?.current) {
            setInputValue(progressInputRef.current, String(val), `${formatPlaybackTime(val)} de ${formatPlaybackTime(total)}`)
        }
        if (timeTextRef.current) {
            timeTextRef.current.innerText = formatPlaybackTime(val)
        }

        triggerControlsVisibility()
    }, [videoRef, thumbRef, progressInputRef, duration, checkManualSkipOverrides, triggerControlsVisibility])

    useEffect(() => {
        return () => {
            if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current)
        }
    }, [])

    const skipTime = useCallback((amount: number) => {
        const video = videoRef.current
        if (!video) return
        const rawDur = video.duration
        const dur = Number.isFinite(rawDur) && rawDur > 0 ? rawDur : (duration && Number.isFinite(duration) && duration > 0 ? duration : Infinity)
        const target = Math.max(0, Math.min(dur, video.currentTime + amount))

        performSeek(target)
        triggerControlsVisibility()
    }, [videoRef, duration, performSeek, triggerControlsVisibility])

    return { progressBarRef, timeTextRef, isSeeking, setIsSeeking, isSeekingRef, handleSeekStart, handleSeek, handleSeekEnd, skipTime }
}
