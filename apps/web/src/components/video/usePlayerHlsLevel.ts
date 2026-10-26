import { useState, useCallback } from "react"
import type React from "react"
import type Hls from "hls.js"

interface HlsLevelOption {
    index: number
    label: string
    height: number
}

/** Calidades HLS disponibles y selección manual (-1 = automática/ABR). */
export function usePlayerHlsLevel({ hlsRef }: { hlsRef: React.RefObject<Hls | null> }) {
    const [hlsLevels, setHlsLevels] = useState<HlsLevelOption[]>([])
    const [activeHlsLevel, setActiveHlsLevel] = useState<number>(-1)

    const setHlsLevel = useCallback((levelIndex: number) => {
        const hls = hlsRef.current
        if (!hls) {
            console.warn("[player-core] handleSetHlsLevel called without active HLS instance")
            return
        }
        try {
            // -1 reactiva el ABR.
            // eslint-disable-next-line react-compiler/react-compiler -- instancia hls.js vía ref, no estado de React
            hls.currentLevel = levelIndex
            hls.nextLevel = levelIndex
            setActiveHlsLevel(levelIndex)
        } catch (err) {
            console.warn("[player-core] handleSetHlsLevel failed:", err)
        }
    }, [hlsRef])

    return { hlsLevels, setHlsLevels, activeHlsLevel, setActiveHlsLevel, setHlsLevel }
}
