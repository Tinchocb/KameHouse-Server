import { useState, useEffect, useRef, useCallback } from "react"
import type React from "react"

export const CONTROLS_HIDE_DELAY_MS = 3000

/**
 * Visibilidad de los controles con auto-ocultado mientras se reproduce, y estado
 * del panel de ajustes (que bloquea el auto-ocultado mientras está abierto).
 */
export function usePlayerControlsVisibility({ isPlaying }: { isPlaying: boolean }) {
    const [controlsVisible, setControlsVisible] = useState(true)
    const [isSettingsOpen, setIsSettingsOpenState] = useState(false)
    // Mirror ref so the auto-hide setTimeout callback always sees the current value
    // (setState closures capture the value at the time of creation).
    const isSettingsOpenRef = useRef(false)
    const setIsSettingsOpen = useCallback((action: React.SetStateAction<boolean>) => {
        setIsSettingsOpenState(prev => {
            const next = typeof action === "function" ? action(prev) : action
            isSettingsOpenRef.current = next
            return next
        })
    }, []) as React.Dispatch<React.SetStateAction<boolean>>

    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const triggerControlsVisibility = useCallback(() => {
        setControlsVisible(true)
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current)
        }
        controlsTimeoutRef.current = setTimeout(() => {
            // Do not auto-hide while the settings panel is open: the panel is a
            // child of .player-bottom-bar and GSAP's autoAlpha:0 makes it
            // non-interactive even though isSettingsOpen stays true.
            if (isPlaying && !isSettingsOpenRef.current) {
                setControlsVisible(false)
                setIsSettingsOpen(false)
            }
        }, CONTROLS_HIDE_DELAY_MS)
    }, [isPlaying, setIsSettingsOpen])

    // Rearma el temporizador al empezar/pausar la reproducción.
    useEffect(() => {
        Promise.resolve().then(() => {
            triggerControlsVisibility()
        })
        return () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
        }
    }, [triggerControlsVisibility])

    return { controlsVisible, setControlsVisible, isSettingsOpen, setIsSettingsOpen, triggerControlsVisibility }
}
