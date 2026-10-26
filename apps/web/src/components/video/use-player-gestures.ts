"use no memo"
import React, { useRef, useState, useEffect, useCallback } from "react"
import { isTouchLikePointer } from "./player-touch"
import { formatPlaybackTime } from "./format-playback-time"
import type { PlayerHudData } from "./player-overlays"
import type { PlayerCore } from "./player-core"

type PlayerCoreState = PlayerCore["state"]
type PlayerCoreActions = PlayerCore["actions"]

interface UsePlayerGesturesOptions {
    videoRef: React.RefObject<HTMLVideoElement | null>
    state: PlayerCoreState
    actions: PlayerCoreActions
}

interface PlayerGesturesResult {
    isHoldSpeedActive: boolean
    brightness: number
    swipeIndicator: { type: "seek" | "volume" | "brightness"; value: string } | null
    skipFlash: "left" | "right" | null
    hudData: PlayerHudData | null
    startHold: () => void
    endHold: () => void
    handleTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void
    handleTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void
    handleTouchEnd: () => void
    handleInteractionClick: (e: React.MouseEvent<HTMLDivElement>) => void
    handleDoubleClick: () => void
    handlePointerDown: (e: React.PointerEvent) => void
}

export function usePlayerGestures({
    videoRef,
    state,
    actions,
}: UsePlayerGesturesOptions): PlayerGesturesResult {
    // Gesture tracking for double tap to skip and hold for 2x speed
    const [isHoldSpeedActive, setIsHoldSpeedActive] = useState(false)
    const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isHoldingRef = useRef<boolean>(false)
    const wasHoldingRef = useRef<boolean>(false)
    const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const lastClickTimeRef = useRef<number>(0)

    const startHold = useCallback(() => {
        wasHoldingRef.current = false
        if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current)
        holdTimeoutRef.current = setTimeout(() => {
            isHoldingRef.current = true
            wasHoldingRef.current = true
            const video = videoRef.current
            if (video) {
                // eslint-disable-next-line react-compiler/react-compiler -- elemento <video> vía ref
                video.playbackRate = 2.0
            }
            setIsHoldSpeedActive(true)
        }, 500)
    }, [videoRef])

    const endHold = useCallback(() => {
        if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current)
            holdTimeoutRef.current = null
        }
        if (isHoldingRef.current) {
            isHoldingRef.current = false
            setIsHoldSpeedActive(false)
            const video = videoRef.current
            if (video) {
                video.playbackRate = state.playbackRate
            }
            // Delay resetting wasHoldingRef to absorb synthetic trailing clicks
            setTimeout(() => {
                wasHoldingRef.current = false
            }, 400)
        }
    }, [videoRef, state.playbackRate])

    // Gestures for swipe-seek, volume, and brightness
    const [brightness, setBrightness] = useState(1.0)
    const [swipeIndicator, setSwipeIndicator] = useState<{
        type: "seek" | "volume" | "brightness"
        value: string
    } | null>(null)
    const [skipFlash, setSkipFlash] = useState<"left" | "right" | null>(null)
    const skipFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // OS-Style Floating HUD (volume & playback speed)
    const [hudData, setHudData] = useState<PlayerHudData | null>(null)
    const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const showHud = useCallback((data: PlayerHudData) => {
        if (hudTimerRef.current) clearTimeout(hudTimerRef.current)
        setHudData(data)
        hudTimerRef.current = setTimeout(() => {
            setHudData(null)
        }, 1200)
    }, [])

    const isMountedRef = useRef(false)
    const prevVolRef = useRef(state.volume)
    const prevMuteRef = useRef(state.isMuted)
    useEffect(() => {
        if (!isMountedRef.current) {
            isMountedRef.current = true
            return
        }
        if (prevVolRef.current !== state.volume || prevMuteRef.current !== state.isMuted) {
            prevVolRef.current = state.volume
            prevMuteRef.current = state.isMuted
            showHud({
                type: "volume",
                value: state.volume,
                isMuted: state.isMuted,
            })
        }
    }, [state.volume, state.isMuted, showHud])

    const prevRateRef = useRef(state.playbackRate)
    useEffect(() => {
        if (prevRateRef.current !== state.playbackRate) {
            prevRateRef.current = state.playbackRate
            showHud({
                type: "speed",
                value: state.playbackRate,
            })
        }
    }, [state.playbackRate, showHud])

    useEffect(() => {
        return () => {
            if (hudTimerRef.current) clearTimeout(hudTimerRef.current)
            if (skipFlashTimerRef.current) clearTimeout(skipFlashTimerRef.current)
            if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current)
            if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current)
        }
    }, [])

    const lastPointerTypeRef = useRef<string>("mouse")
    const touchStartRef = useRef<{ x: number; y: number } | null>(null)
    const isSwipingRef = useRef<boolean>(false)
    const swipeDirectionRef = useRef<"horizontal" | "vertical" | null>(null)
    const swipeSideRef = useRef<"left" | "right" | null>(null)
    const initialVolumeRef = useRef<number>(1.0)
    const initialBrightnessRef = useRef<number>(1.0)
    const initialTimeRef = useRef<number>(0)

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        lastPointerTypeRef.current = e.pointerType || "mouse"
    }, [])

    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        const touch = e.touches[0]
        if (!touch) return

        touchStartRef.current = { x: touch.clientX, y: touch.clientY }
        isSwipingRef.current = false
        swipeDirectionRef.current = null

        const video = videoRef.current
        if (video) {
            initialTimeRef.current = video.currentTime
            initialVolumeRef.current = video.volume
        }
        initialBrightnessRef.current = brightness

        // Determine touch side (left/right)
        const rect = e.currentTarget.getBoundingClientRect()
        const relativeX = touch.clientX - rect.left
        swipeSideRef.current = relativeX < rect.width / 2 ? "left" : "right"

        // Also trigger controls visibility
        actions.triggerControlsVisibility()

        // Trigger startHold for 2x speed if hold continues
        startHold()
    }, [videoRef, brightness, actions, startHold])

    const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        if (!touchStartRef.current) return
        const touch = e.touches[0]
        if (!touch) return

        const deltaX = touch.clientX - touchStartRef.current.x
        const deltaY = touch.clientY - touchStartRef.current.y
        const absX = Math.abs(deltaX)
        const absY = Math.abs(deltaY)

        // Cancel speed hold if user moves their finger (swiping)
        if (absX > 15 || absY > 15) {
            if (holdTimeoutRef.current) {
                clearTimeout(holdTimeoutRef.current)
                holdTimeoutRef.current = null
            }
        }

        if (!isSwipingRef.current) {
            // Check if threshold is met
            if (absX > 15 || absY > 15) {
                isSwipingRef.current = true
                swipeDirectionRef.current = absX > absY ? "horizontal" : "vertical"
            }
        }

        if (isSwipingRef.current && swipeDirectionRef.current) {
            e.preventDefault()

            if (swipeDirectionRef.current === "horizontal") {
                // Seek gesture: 1px = 0.15s of video seek
                const seekMultiplier = 0.15
                const secondsDelta = deltaX * seekMultiplier
                const newTime = Math.max(0, Math.min(state.duration, initialTimeRef.current + secondsDelta))

                const timeDiff = newTime - initialTimeRef.current
                const prefix = timeDiff >= 0 ? ">>" : "<<"
                const formattedDiff = `${prefix} ${Math.abs(Math.round(timeDiff))}s`
                const formattedNewTime = formatPlaybackTime(newTime)

                setSwipeIndicator({
                    type: "seek",
                    value: `[${formattedDiff}] ${formattedNewTime}`,
                })

                const video = videoRef.current
                if (video) {
                    video.currentTime = newTime
                }
            } else {
                // Vertical swipe: volume on right side, brightness on left side
                const verticalMultiplier = -0.005
                const deltaValue = deltaY * verticalMultiplier

                if (swipeSideRef.current === "right") {
                    const newVolume = Math.max(0, Math.min(1, initialVolumeRef.current + deltaValue))
                    actions.handleVolume(newVolume)
                    setSwipeIndicator({
                        type: "volume",
                        value: `VOL: ${(newVolume * 100).toFixed(0)}%`,
                    })
                } else {
                    const newBrightness = Math.max(0.2, Math.min(1.8, initialBrightnessRef.current + deltaValue))
                    setBrightness(newBrightness)
                    setSwipeIndicator({
                        type: "brightness",
                        value: `BRIG: ${(newBrightness * 100).toFixed(0)}%`,
                    })
                }
            }
        }
    }, [state.duration, actions, videoRef])

    const handleTouchEnd = useCallback(() => {
        touchStartRef.current = null
        setSwipeIndicator(null)
        endHold()

        if (isSwipingRef.current) {
            isSwipingRef.current = false
            swipeDirectionRef.current = null
            // Swiped, do not trigger play/pause click
            wasHoldingRef.current = true
            setTimeout(() => {
                wasHoldingRef.current = false
            }, 400)
        }
    }, [endHold])

    const playSkipAnimation = useCallback((side: "left" | "right") => {
        setSkipFlash(side)
        if (skipFlashTimerRef.current) clearTimeout(skipFlashTimerRef.current)
        skipFlashTimerRef.current = setTimeout(() => {
            setSkipFlash(null)
            skipFlashTimerRef.current = null
        }, 550)
    }, [])

    const handleInteractionClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        actions.triggerControlsVisibility()
        if (wasHoldingRef.current) {
            wasHoldingRef.current = false
            return
        }

        const isTouch = isTouchLikePointer(lastPointerTypeRef.current) || isHoldingRef.current

        // On desktop mouse clicks, toggle play/pause immediately without artificial 300ms latency.
        if (!isTouch) {
            actions.togglePlay()
            return
        }

        const rect = e.currentTarget.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const isLeftSide = clickX < rect.width / 2

        const now = Date.now()
        const DOUBLE_CLICK_DELAY = 300

        if (now - lastClickTimeRef.current < DOUBLE_CLICK_DELAY) {
            if (clickTimeoutRef.current) {
                clearTimeout(clickTimeoutRef.current)
                clickTimeoutRef.current = null
            }
            if (isLeftSide) {
                actions.skipTime(-10)
                playSkipAnimation("left")
            } else {
                actions.skipTime(10)
                playSkipAnimation("right")
            }
            lastClickTimeRef.current = 0
        } else {
            lastClickTimeRef.current = now
            if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current)
            clickTimeoutRef.current = setTimeout(() => {
                if (!isHoldingRef.current) {
                    actions.togglePlay()
                }
                clickTimeoutRef.current = null
            }, DOUBLE_CLICK_DELAY)
        }
    }, [actions, playSkipAnimation])

    const handleDoubleClick = useCallback(() => {
        // Con entrada táctil el doble toque salta ±10 s; pantalla completa es solo de mouse.
        if (!isTouchLikePointer(lastPointerTypeRef.current)) {
            actions.toggleFullscreen()
        }
    }, [actions])

    return {
        isHoldSpeedActive,
        brightness,
        swipeIndicator,
        skipFlash,
        hudData,
        startHold,
        endHold,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleInteractionClick,
        handleDoubleClick,
        handlePointerDown,
    }
}
