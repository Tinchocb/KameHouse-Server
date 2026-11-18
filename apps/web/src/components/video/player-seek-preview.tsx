import { useEffect, useState } from "react"
import { m, AnimatePresence } from "framer-motion"
import type { PlayerPreviewManager, PreviewFrame } from "./player-preview"
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
    const [result, setResult] = useState<{ manager: PlayerPreviewManager; segment: number; frame: PreviewFrame | null } | null>(null)
    const spring = useSpringPreset("entrance")
    const reducedMotion = useReducedMotion()
    const segment = previewManager && hoverTime !== null ? previewManager.calculateSegmentIndex(hoverTime) : null

    useEffect(() => {
        if (!previewManager || segment === null) return
        let active = true
        // Avoid work for positions merely crossed by the pointer.
        const timer = setTimeout(() => {
            void previewManager.retrievePreviewForSegment(segment).then(
                frame => { if (active) setResult({ manager: previewManager, segment, frame }) },
                () => { if (active) setResult({ manager: previewManager, segment, frame: null }) },
            )
        }, 100)
        return () => { active = false; clearTimeout(timer) }
    }, [segment, previewManager])

    const current = result?.manager === previewManager && result?.segment === segment ? result : null
    const frame = current?.frame
    const percent = Number.isFinite(hoverPosPercent) ? Math.max(0, Math.min(100, hoverPosPercent)) : 0
    return (
        <AnimatePresence>
            {hoverTime !== null && (
                <m.div
                    key="player-seek-preview"
                    aria-hidden="true"
                    initial={{ opacity: 0, y: reducedMotion ? 0 : 4, x: "-50%" }}
                    animate={{ opacity: 1, y: 0, x: "-50%" }}
                    exit={{ opacity: 0, y: reducedMotion ? 0 : 4, x: "-50%", transition: { duration: 0.15, ease: "easeOut" } }}
                    transition={reducedMotion ? { duration: 0 } : spring}
                    className={cn("player-seek-preview absolute bottom-[calc(100%+12px)] pointer-events-none z-player-ui overflow-hidden rounded-2xl", PLAYER_GLASS)}
                    style={{ width: "min(200px, 100%)", left: `clamp(min(100px, 50%), ${percent}%, max(50%, calc(100% - 100px)))` }}
                >
                    {frame ? (
                        <div
                            role="img"
                            aria-label="Vista previa del fotograma"
                            className="w-full aspect-[200/112] bg-black"
                            style={{
                                backgroundImage: `url("${frame.url}")`,
                                backgroundSize: `${frame.columns * 100}% ${frame.rows * 100}%`,
                                backgroundPosition: `${frame.column / Math.max(1, frame.columns - 1) * 100}% ${frame.row / Math.max(1, frame.rows - 1) * 100}%`,
                            }}
                        />
                    ) : (
                        <div className="px-3 pt-2 text-xs text-label-2">
                            {current || !previewManager ? "Vista previa no disponible" : "Preparando vista previa…"}
                        </div>
                    )}
                    <div className="flex items-center gap-2 px-3 py-2 text-xs">
                        <span className="min-w-0 flex-1 truncate text-label-2">{segmentLabel || "Vista previa"}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-label-1">{formatPlaybackTime(hoverTime)}</span>
                    </div>
                </m.div>
            )}
        </AnimatePresence>
    )
}
