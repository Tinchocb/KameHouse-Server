import React, { useEffect, useState } from "react"
import { m, AnimatePresence } from "framer-motion"
import { PlayerPreviewManager } from "./player-preview"
import { cn } from "@/components/ui/core/styling"
import { PLAYER_GLASS } from "./player-theme"
import { useSpringPreset, useReducedMotion } from "@/components/ui/kinetics/hooks"

interface PlayerSeekPreviewProps {
    previewManager: PlayerPreviewManager | null
    hoverTime: number | null
    hoverPosPercent: number
}

const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "00:00"
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = Math.floor(secs % 60)
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function PlayerSeekPreview({ previewManager, hoverTime, hoverPosPercent }: PlayerSeekPreviewProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [rendered, setRendered] = useState<{ segment: number; url: string } | null>(null)
    const spring = useSpringPreset("entrance")
    const prefersReducedMotion = useReducedMotion()

    // Al cambiar de episodio/manager el cleanup revoca blobs: resetear durante render
    const [prevPreviewManager, setPrevPreviewManager] = useState(previewManager)
    if (previewManager !== prevPreviewManager) {
        setPrevPreviewManager(previewManager)
        setPreviewUrl(null)
        setRendered(null)
    }

    useEffect(() => {
        if (!previewManager || hoverTime === null) return
        
        let isActive = true
        const segment = previewManager.calculateSegmentIndex(hoverTime)

        if (rendered?.segment === segment && rendered?.url) {
            return
        }

        const loadPreview = async () => {
            try {
                const url = await previewManager.retrievePreviewForSegment(segment, true)
                if (isActive && url) {
                    setRendered({ segment, url })
                    setPreviewUrl(url)
                }
            } catch {
                // Ignore errors
            }
        }

        loadPreview()

        return () => {
            isActive = false
        }
    }, [hoverTime, previewManager, rendered])

    const isVisible = hoverTime !== null
    const safeLeftPercent = Math.max(0, Math.min(100, hoverPosPercent))

    return (
        <AnimatePresence>
            {isVisible && (
                <m.div 
                    key="player-seek-preview"
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
                    transition={spring}
                    className="absolute bottom-[calc(100%+16px)] pointer-events-none z-player-ui -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `clamp(90px, ${safeLeftPercent}%, calc(100% - 90px))` }}
                >
                    <div className="relative overflow-hidden rounded-md bg-black w-[168px] aspect-video border border-white/20">
                        {previewUrl ? (
                            <img 
                                src={previewUrl} 
                                alt="Previsualización de reproducción" 
                                className="w-full h-full object-cover animate-in fade-in duration-base"
                            />
                        ) : (
                            <div className="w-full h-full bg-white/5" />
                        )}
                    </div>
                    
                    {/* Time badge */}
                    <div className={cn("mt-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold tracking-wide tabular-nums text-white", PLAYER_GLASS)}>
                        {formatTime(hoverTime)}
                    </div>
                    
                </m.div>
            )}
        </AnimatePresence>
    )
}
