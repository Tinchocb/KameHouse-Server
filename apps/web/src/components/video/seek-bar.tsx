import React from "react"
import { cn } from "@/components/ui/core/styling"
import { PlayerSeekPreview } from "./player-seek-preview"
import type { PlayerPreviewManager } from "./player-preview"
import { formatPlaybackTime } from "./format-playback-time"
import { isValidOpeningWindow, type Chapter } from "./skip-windows"

/** Teclas con las que el range nativo mueve la posición. Cualquier otra (Tab,
 * Espacio, F…) no es un seek: antes dejaba `isSeekingRef` trabado o provocaba
 * un micro-seek al soltarla. */
const SEEK_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"])

interface SeekBarProps {
    duration: number
    currentTime?: number
    progressBarRef: React.RefObject<HTMLDivElement | null>
    thumbRef: React.RefObject<HTMLDivElement | null>
    progressInputRef: React.RefObject<HTMLInputElement | null>
    handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void
    handleSeekStart?: () => void
    handleSeekEnd?: (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => void
    skipTimesOp?: { startTime: number; endTime: number; source?: string }
    skipTimesEd?: { startTime: number; endTime: number; source?: string }
    chapters?: Chapter[]
    isMovie?: boolean
    previewManager?: PlayerPreviewManager | null
    className?: string
    disabled?: boolean
}

export const SeekBar = React.memo(function SeekBar({
    duration,
    currentTime = 0,
    progressBarRef,
    thumbRef,
    progressInputRef,
    handleSeek,
    handleSeekStart,
    handleSeekEnd,
    skipTimesOp,
    skipTimesEd,
    chapters = [],
    isMovie = false,
    previewManager,
    className,
    disabled = false,
}: SeekBarProps) {
    skipTimesOp = skipTimesOp && isValidOpeningWindow(skipTimesOp, duration) ? skipTimesOp : undefined
    skipTimesEd = skipTimesEd && Number.isFinite(skipTimesEd.startTime) && Number.isFinite(skipTimesEd.endTime) &&
        skipTimesEd.startTime >= 0 && skipTimesEd.endTime > skipTimesEd.startTime && skipTimesEd.endTime <= duration ? skipTimesEd : undefined
    const [hoverInfo, setHoverInfo] = React.useState<{ time: number; percent: number } | null>(null)
    const rafIdRef = React.useRef<number | null>(null)
    const hitAreaRef = React.useRef<HTMLDivElement>(null)
    const trackRectRef = React.useRef<{ left: number; width: number } | null>(null)

    const measureTrackRect = React.useCallback(() => {
        const el = hitAreaRef.current
        if (!el) return null
        const r = el.getBoundingClientRect()
        const measured = r.width > 0 ? { left: r.left, width: r.width } : null
        trackRectRef.current = measured
        return measured
    }, [])

    React.useEffect(() => {
        const el = hitAreaRef.current
        if (!el || typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(() => {
            trackRectRef.current = null
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const rect = trackRectRef.current ?? measureTrackRect()
        if (!rect || !rect.width) return
        const clientX = e.clientX

        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current)
        }

        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null
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

            setHoverInfo((prev) =>
                prev && Math.round(prev.time) === Math.round(time) && Math.abs(prev.percent - percent) < 0.2
                    ? prev
                    : { time, percent }
            )
        })
    }, [duration, chapters, isMovie, skipTimesOp, skipTimesEd, measureTrackRect])

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

    const hoverSegmentLabel = React.useMemo(() => {
        if (!hoverInfo || hoverInfo.time === null || duration <= 0) return null
        const t = hoverInfo.time
        if (skipTimesOp && t >= skipTimesOp.startTime && t <= skipTimesOp.endTime) {
            return "Intro"
        }
        if (skipTimesEd && t >= skipTimesEd.startTime && t <= skipTimesEd.endTime) {
            return "Créditos"
        }
        if (!isMovie && Array.isArray(chapters)) {
            const ch = chapters.find(c => t >= c.startTime && t <= c.endTime)
            if (ch?.name) return ch.name
        }
        return null
    }, [hoverInfo, duration, skipTimesOp, skipTimesEd, isMovie, chapters])

    return (
        <div className={cn("player-seek-bar relative w-full group/seek", className)} data-disabled={disabled || undefined}>
            {/* Previsualización flotante aislada en este sub-árbol */}
            <PlayerSeekPreview
                previewManager={previewManager || null}
                hoverTime={hoverInfo?.time ?? null}
                hoverPosPercent={hoverInfo?.percent ?? 0}
                segmentLabel={hoverSegmentLabel}
            />

            {/* Hit-area accesible de 44px (min-target WCAG / DESIGN-GUIDE §12.5) alrededor de una línea fina de 4px */}
            {/* role=presentation: el hover solo alimenta la previsualización; la interacción
                accesible (mouse, teclado, touch) la maneja el <input type="range"> de abajo */}
            <div
                ref={hitAreaRef}
                role="presentation"
                className="player-seek-hit-area relative flex items-center h-11 cursor-pointer w-full select-none touch-pan-y"
                onMouseEnter={measureTrackRect}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                {/* Track Background */}
                <div className="player-seek-track w-full h-[4px] scale-y-50 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/seek:scale-y-100 group-focus-within/seek:scale-y-100 transition-transform duration-fast ease-smooth-out bg-white/15 rounded-full relative flex items-center overflow-hidden">
                    {/* Skip OP Marker */}
                    {duration > 0 && skipTimesOp && (
                        <div
                            data-marker="op"
                            className={cn(
                                "absolute top-0 bottom-0 pointer-events-none rounded-xs",
                                "bg-amber-400/45 border-x border-amber-300/80 shadow-[0_0_8px_hsl(var(--brand-warning)/0.4)]",
                                skipTimesOp.source === "heuristic" && "opacity-50"
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
                                "absolute top-0 bottom-0 pointer-events-none rounded-xs",
                                "bg-purple-400/45 border-x border-purple-300/80 shadow-[0_0_8px_hsl(var(--brand-accent)/0.4)]",
                                skipTimesEd.source === "heuristic" && "opacity-50"
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
                        className="player-seek-fill w-full h-full bg-brand-accent rounded-full relative"
                        style={{ transform: "scaleX(0)", transformOrigin: "left" }}
                    />

                </div>

                {/* Thumb Indicator: wrapper 100% desplazado por transform (0 layout), punto a la izquierda. */}
                <div
                    ref={thumbRef}
                    className="absolute inset-0 pointer-events-none"
                    style={{ transform: "translateX(0%)" }}
                >
                    <div className="player-seek-thumb absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-brand-accent shadow-[0_0_8px_hsl(var(--brand-accent)/0.6)] scale-50 opacity-0 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/seek:scale-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover/seek:opacity-100 group-focus-within/seek:scale-100 group-focus-within/seek:opacity-100 transition-[transform,opacity] duration-fast ease-out-strong" />
                </div>
                {/* Input hit-area para accesibilidad y navegación por teclado */}
                <input
                    ref={progressInputRef}
                    type="range"
                    disabled={disabled}
                    min={0}
                    max={duration || 0}
                    step="any"
                    aria-label="Línea de tiempo"
                    aria-valuetext={duration ? `${formatPlaybackTime(currentTime)} de ${formatPlaybackTime(duration)}` : "0:00"}
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
                    className="player-seek-input absolute inset-0 w-full h-full cursor-pointer appearance-none bg-transparent opacity-0 z-10 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-brand-accent"
                />
            </div>
        </div>
    )
})
