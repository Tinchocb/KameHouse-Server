import { useEffect, useState } from "react"
import { m, AnimatePresence } from "framer-motion"
import { PlayerPreviewManager } from "./player-preview"
import { cn } from "@/components/ui/core/styling"
import { PLAYER_GLASS } from "./player-theme"
import { useSpringPreset, useReducedMotion } from "@/components/ui/kinetics/hooks"
import { formatPlaybackTime } from "./format-playback-time"

interface PlayerSeekPreviewProps {
    previewManager: PlayerPreviewManager | null
    hoverTime: number | null
    hoverPosPercent: number
    segmentLabel?: string | null
}

export function PlayerSeekPreview({ previewManager, hoverTime, hoverPosPercent, segmentLabel }: PlayerSeekPreviewProps) {
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

    // Solo se muestra la miniatura del segmento bajo el cursor: mientras llega la
    // nueva, la anterior es de otro momento del episodio.
    const hoverSegment = previewManager && hoverTime !== null ? previewManager.calculateSegmentIndex(hoverTime) : null
    const isVisible = hoverTime !== null
    const safeLeftPercent = Math.max(0, Math.min(100, hoverPosPercent))

    return (
        <AnimatePresence>
            {isVisible && (
                <m.div 
                    key="player-seek-preview"
                    initial={prefersReducedMotion ? { opacity: 0, x: "-50%" } : { opacity: 0, y: 8, scale: 0.96, x: "-50%" }}
                    animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                    exit={prefersReducedMotion ? { opacity: 0, x: "-50%" } : { opacity: 0, y: 8, scale: 0.96, x: "-50%" }}
                    // El centrado va en `x` de Framer: con la clase -translate-x-1/2 (Tailwind 3)
                    // el transform inline de la animación la pisaba y la miniatura quedaba corrida.
                    transition={spring}
                    className="absolute bottom-[calc(100%+16px)] pointer-events-none z-player-ui flex flex-col items-center"
                    style={{ left: `clamp(90px, ${safeLeftPercent}%, calc(100% - 90px))` }}
                >
                    <div className="relative overflow-hidden rounded-md bg-black w-[168px] aspect-video border border-white/20">
                        {previewUrl && rendered?.segment === hoverSegment ? (
                            <img 
                                src={previewUrl} 
                                alt="Vista previa del fotograma" 
                                className="w-full h-full object-cover animate-in fade-in duration-base"
                            />
                        ) : (
                            <div className="w-full h-full bg-[var(--neutral-elev-2)]" />
                        )}
                    </div>
                    
                    {/* Time badge */}
                    <div className={cn("mt-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold tracking-wide tabular-nums text-white inline-flex items-center gap-1.5", PLAYER_GLASS)}>
                        {segmentLabel && (
                            <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent-readable border border-brand-accent/30">
                                {segmentLabel}
                            </span>
                        )}
                        <span>{formatPlaybackTime(hoverTime ?? 0)}</span>
                    </div>
                    
                </m.div>
            )}
        </AnimatePresence>
    )
}
