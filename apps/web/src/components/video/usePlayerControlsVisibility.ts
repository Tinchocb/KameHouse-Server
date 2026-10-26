import { useState, useEffect, useRef, useCallback } from "react"
import type React from "react"

export const CONTROLS_HIDE_DELAY_MS = 3000

export function hasFocusedPlayerControls() {
    return document.activeElement?.closest(
        ".player-top-bar, .player-bottom-bar, .player-center-controls"
    ) != null
}

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
            // No retirar controles mientras se usan con teclado o hay un menú abierto.
            if (isPlaying && !isSettingsOpenRef.current && !hasFocusedPlayerControls()) {
                setControlsVisible(false)
                setIsSettingsOpen(false)
            }
        }, CONTROLS_HIDE_DELAY_MS)
    }, [isPlaying, setIsSettingsOpen])

    // Rearma el temporizador al empezar/pausar la reproducción.
    useEffect(() => {
        let cancelled = false
        void Promise.resolve().then(() => {
            if (!cancelled) triggerControlsVisibility()
        })
        return () => {
            cancelled = true
            if (controlsTimeoutRef.current !== null) {
                clearTimeout(controlsTimeoutRef.current)
                controlsTimeoutRef.current = null
            }
        }
    }, [triggerControlsVisibility])

    return { controlsVisible, setControlsVisible, isSettingsOpen, setIsSettingsOpen, triggerControlsVisibility }
}
