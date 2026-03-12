"use client"
import React, { useRef } from "react"

interface PlayerTouchOverlayProps {
    onSeekBackward: () => void
    onSeekForward: () => void
    onToggleUI: () => void
}

export function PlayerTouchOverlay({
    onSeekBackward,
    onSeekForward,
    onToggleUI,
}: PlayerTouchOverlayProps) {
    const lastTap = useRef<number>(0)
    const timeoutFn = useRef<NodeJS.Timeout | null>(null)

    const handlePointerDown = (action: "left" | "right" | "center") => {
        const now = Date.now()
        if (now - lastTap.current < 300) {
            // Double tap detected
            if (timeoutFn.current) clearTimeout(timeoutFn.current)
            if (action === "left") onSeekBackward()
            if (action === "right") onSeekForward()
            // Optional: Handle center double tap if needed (e.g. togglePlay)
        } else {
            // Single tap detected, queue toggleUI
            timeoutFn.current = setTimeout(() => onToggleUI(), 300)
        }
        lastTap.current = now
    }

    return (
        <div className="absolute inset-0 z-10 flex w-full h-full touch-none select-none">
            <div className="w-1/3 h-full cursor-pointer" onPointerDown={() => handlePointerDown("left")} />
            <div className="w-[34%] h-full cursor-pointer" onPointerDown={() => handlePointerDown("center")} />
            <div className="w-1/3 h-full cursor-pointer" onPointerDown={() => handlePointerDown("right")} />
        </div>
    )
}
