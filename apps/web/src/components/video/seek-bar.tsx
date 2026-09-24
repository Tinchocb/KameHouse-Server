import React from "react"
import { cn } from "@/components/ui/core/styling"
import { TimelineHeatmap, type InsightNode } from "@/components/ui/timeline-heatmap"
import { PlayerSeekPreview } from "./player-seek-preview"
import type { PlayerPreviewManager } from "./player-preview"
import type { Chapter } from "./player-bottombar"

/** Teclas con las que el range nativo mueve la posición. Cualquier otra (Tab,
 * Espacio, F…) no es un seek: antes dejaba `isSeekingRef` trabado o provocaba
 * un micro-seek al soltarla. */
const SEEK_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"])

const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "00:00"
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = Math.floor(secs % 60)
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export interface SeekBarProps {
    duration: number
    progressBarRef: React.RefObject<HTMLDivElement | null>
    thumbRef: React.RefObject<HTMLDivElement | null>
    progressInputRef: React.RefObject<HTMLInputElement | null>
    handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void
    handleSeekStart?: () => void
    handleSeekEnd?: (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => void
    showHeatmap?: boolean
    insights?: InsightNode[]
    skipTimesOp?: { startTime: number; endTime: number; source?: string }
    skipTimesEd?: { startTime: number; endTime: number; source?: string }
    chapters?: Chapter[]
    isMovie?: boolean
    previewManager?: PlayerPreviewManager | null
    className?: string
}

export const SeekBar = React.memo(function SeekBar({
    duration,
    progressBarRef,
    thumbRef,
    progressInputRef,
    handleSeek,
    handleSeekStart,
    handleSeekEnd,
    showHeatmap,
    insights = [],
    skipTimesOp,
    skipTimesEd,
    chapters = [],
    isMovie = false,
    previewManager,
    className,
}: SeekBarProps) {
    const [hoverInfo, setHoverInfo] = React.useState<{ time: number; percent: number } | null>(null)
    const rafIdRef = React.useRef<number | null>(null)

    const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        if (!rect.width) return
        const clientX = e.clientX

        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current)
        }

        rafIdRef.current = requestAnimationFrame(() => {
            const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
            let percent = (x / rect.width) * 100
            let time = (percent / 100) * duration

            // Snap magnético canónico (±2 segundos)
            if (duration > 0) {
                const SNAP_THRESHOLD = 2
                let closestSnap: number | null = null
                let minDiff = Infinity

                if (!isMovie && Array.isArray(chapters)) {
                    for (const ch of chapters) {
                        if (typeof ch.startTime === "number" && ch.startTime > 0 && ch.startTime < duration) {
                            const diff = Math.abs(time - ch.startTime)
                            if (diff <= SNAP_THRESHOLD && diff < minDiff) {
                                minDiff = diff
                                closestSnap = ch.startTime
                            }
                        }
                    }
                }

                if (skipTimesOp && skipTimesOp.startTime > 0) {
                    const diffStart = Math.abs(time - skipTimesOp.startTime)
                    if (diffStart <= SNAP_THRESHOLD && diffStart < minDiff) {
                        minDiff = diffStart
                        closestSnap = skipTimesOp.startTime
                    }
                    const diffEnd = Math.abs(time - skipTimesOp.endTime)
                    if (diffEnd <= SNAP_THRESHOLD && diffEnd < minDiff) {
                        minDiff = diffEnd
                        closestSnap = skipTimesOp.endTime
                    }
                }

                if (skipTimesEd && skipTimesEd.startTime > 0) {
                    const diffStart = Math.abs(time - skipTimesEd.startTime)
                    if (diffStart <= SNAP_THRESHOLD && diffStart < minDiff) {
                        minDiff = diffStart
                        closestSnap = skipTimesEd.startTime
                    }
                }

                if (closestSnap !== null) {
                    time = closestSnap
                    percent = (closestSnap / duration) * 100
                }
            }

            setHoverInfo({ time, percent })
        })
    }, [duration, chapters, isMovie, skipTimesOp, skipTimesEd])

    const handleMouseLeave = React.useCallback(() => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current)
        }
        setHoverInfo(null)
    }, [])

    React.useEffect(() => {
        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
        }
    }, [])

    return (
        <div className={cn("relative w-full group/seek", className)}>
            {/* Previsualización flotante aislada en este sub-árbol */}
            <PlayerSeekPreview
                previewManager={previewManager || null}
                hoverTime={hoverInfo?.time ?? null}
                hoverPosPercent={hoverInfo?.percent ?? 0}
            />

            {/* Hit-area de 20px alrededor de una línea fina: fácil de agarrar, liviana a la vista */}
            {/* role=presentation: el hover solo alimenta la previsualización; la interacción
                accesible (mouse, teclado, touch) la maneja el <input type="range"> de abajo */}
            <div
                role="presentation"
                className="relative flex items-center h-5 cursor-pointer w-full select-none touch-pan-y"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                {/* Timeline Heatmap */}
                {showHeatmap && (
                    <TimelineHeatmap
                        duration={duration}
                        insights={insights}
                        className="absolute bottom-1/2 inset-x-0 w-full h-3 opacity-0 group-hover/seek:opacity-20 pointer-events-none transition-opacity duration-base"
                    />
                )}

                {/* Track Background */}
                <div className="w-full h-[3px] group-hover/seek:h-[5px] transition-[height] duration-fast bg-white/25 rounded-full relative flex items-center overflow-visible">
                    {/* Skip OP Marker */}
                    {duration > 0 && skipTimesOp && (
                        <div
                            data-marker="op"
                            className={cn(
                                "absolute top-0 bottom-0 bg-white/25 pointer-events-none",
                                skipTimesOp.source === "heuristic" && "opacity-40"
                            )}
                            style={{
                                left: `${(skipTimesOp.startTime / duration) * 100}%`,
                                width: `${((skipTimesOp.endTime - skipTimesOp.startTime) / duration) * 100}%`,
                            }}
                        />
                    )}

                    {/* Skip ED Marker */}
                    {duration > 0 && skipTimesEd && (
                        <div
                            data-marker="ed"
                            className={cn(
                                "absolute top-0 bottom-0 bg-white/25 pointer-events-none",
                                skipTimesEd.source === "heuristic" && "opacity-40"
                            )}
                            style={{
                                left: `${(skipTimesEd.startTime / duration) * 100}%`,
                                width: `${((skipTimesEd.endTime - skipTimesEd.startTime) / duration) * 100}%`,
                            }}
                        />
                    )}

                    {/* Chapter Ticks */}
                    {duration > 0 && !isMovie && Array.isArray(chapters) && chapters.map((chapter) => {
                        if (typeof chapter.startTime !== "number" || chapter.startTime <= 0 || chapter.startTime >= duration) return null
                        return (
                            <div
                                key={chapter.startTime}
                                data-marker="chapter"
                                className="absolute top-0 bottom-0 w-[2px] -ml-px bg-black/70 pointer-events-none z-20"
                                style={{
                                    left: `${(chapter.startTime / duration) * 100}%`,
                                }}
                            />
                        )
                    })}

                    {/* Active Playback Bar */}
                    <div
                        ref={progressBarRef}
                        className="w-full h-full bg-brand-accent rounded-full relative"
                        style={{ transform: "scaleX(0)", transformOrigin: "left" }}
                    />

                    {/* Thumb Indicator */}
                    <div
                        ref={thumbRef}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-brand-accent pointer-events-none scale-0 group-hover/seek:scale-100 transition-transform duration-fast"
                        style={{ left: "0%" }}
                    />
                </div>

                {/* Input hit-area para accesibilidad y navegación por teclado */}
                <input
                    ref={progressInputRef}
                    type="range"
                    min={0}
                    max={duration || 0}
                    step="any"
                    aria-label="Línea de tiempo"
                    aria-valuetext={duration ? `Posición actual de ${formatTime(duration)}` : "0:00"}
                    onChange={handleSeek}
                    onMouseDown={handleSeekStart}
                    onTouchStart={handleSeekStart}
                    onKeyDown={(e) => { if (SEEK_KEYS.has(e.key)) handleSeekStart?.() }}
                    onMouseUp={(e) => {
                        handleSeekEnd?.(e)
                        // Soltar el foco tras usar el mouse: con el foco en el input
                        // los atajos del reproductor (Espacio, F, M…) no respondían.
                        e.currentTarget.blur()
                    }}
                    onTouchEnd={(e) => {
                        handleSeekEnd?.(e)
                        e.currentTarget.blur()
                    }}
                    onKeyUp={(e) => { if (SEEK_KEYS.has(e.key)) handleSeekEnd?.(e) }}
                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-10 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-brand-accent"
                />
            </div>
        </div>
    )
})
