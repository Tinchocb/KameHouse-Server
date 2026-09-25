import React, { useState, useCallback } from "react"
import { DeferredImage } from "@/components/shared/deferred-image"
import { WatchProgressBar } from "@/components/ui/watch-progress-bar"
import { IconMediaPlay, IconNavigationChevronDown } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import type { SeriesContinueWatchingData } from "../-hooks/use-series-data"

export interface SeriesContinueWatchingProps {
    continueWatching: SeriesContinueWatchingData
    onResume: () => void
    onGoToEpisode?: () => void
    className?: string
}

export function SeriesContinueWatching({
    continueWatching,
    onResume,
    onGoToEpisode,
    className,
}: SeriesContinueWatchingProps) {
    const [currentThumbnail, setCurrentThumbnail] = useState(continueWatching.thumbnailUrl)
    const [prevPropThumbnail, setPrevPropThumbnail] = useState(continueWatching.thumbnailUrl)

    if (continueWatching.thumbnailUrl !== prevPropThumbnail) {
        setPrevPropThumbnail(continueWatching.thumbnailUrl)
        setCurrentThumbnail(continueWatching.thumbnailUrl)
    }

    const handleThumbnailError = useCallback(() => {
        if (continueWatching.fallbackThumbnailUrl && currentThumbnail !== continueWatching.fallbackThumbnailUrl) {
            setCurrentThumbnail(continueWatching.fallbackThumbnailUrl)
        }
    }, [continueWatching.fallbackThumbnailUrl, currentThumbnail])

    const handleCardKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onResume()
        }
    }, [onResume])

    return (
        <section
            aria-label={`Continuar viendo episodio ${continueWatching.episodeNumber}: ${continueWatching.title}`}
            className={cn("w-full relative z-10", className)}
        >
            <div
                tabIndex={0}
                role="button"
                onClick={onResume}
                onKeyDown={handleCardKeyDown}
                aria-label={`Reanudar episodio ${continueWatching.episodeNumber}, ${continueWatching.title}`}
                className={cn(
                    "sectionbar sectionbar-strong rounded-2xl group/continue relative w-full flex items-center gap-3.5 sm:gap-5 p-3 sm:p-4 select-none text-left cursor-pointer",
                    "transition-all duration-base hover:border-white/25 active:scale-[0.995]",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent/70"
                )}
            >
                {/* ── 16:9 Thumbnail with Overlay ───────────────────────────── */}
                <div className="relative aspect-[16/9] w-28 min-[480px]:w-36 sm:w-44 md:w-52 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-surface-container shadow-md">
                    {currentThumbnail ? (
                        <DeferredImage
                            src={currentThumbnail}
                            alt={continueWatching.title}
                            priority={false}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full"
                            imgClassName="w-full h-full object-cover transition-transform duration-500 group-hover/continue:scale-105"
                            showSkeleton={true}
                            onError={handleThumbnailError}
                            fallback={
                                <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-surface-container">
                                    <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center mb-1 shadow-sm">
                                        <IconMediaPlay className="w-3.5 h-3.5 ml-0.5 text-on-surface-variant" />
                                    </div>
                                    <span className="text-3xs font-mono font-bold uppercase tracking-wider text-on-surface-variant">
                                        EP {continueWatching.episodeNumber}
                                    </span>
                                </div>
                            }
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-surface-container">
                            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center mb-1 shadow-sm">
                                <IconMediaPlay className="w-3.5 h-3.5 ml-0.5 text-on-surface-variant" />
                            </div>
                            <span className="text-3xs font-mono font-bold uppercase tracking-wider text-on-surface-variant">
                                EP {continueWatching.episodeNumber}
                            </span>
                        </div>
                    )}

                    {/* Scrim degradado interno */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10 pointer-events-none" />

                    {/* Play button hover indicator */}
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/70 group-hover/continue:bg-brand-accent border border-white/20 group-hover/continue:border-brand-accent flex items-center justify-center text-white group-hover/continue:text-on-primary transition-[transform,background-color,border-color,color] duration-base ease-smooth-out shadow-elevation-3 group-hover/continue:scale-110">
                            <IconMediaPlay className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5 fill-current" />
                        </div>
                    </div>

                    {/* Badge EP */}
                    <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 z-20 px-1.5 sm:px-2 py-0.5 rounded-md bg-black/85 border border-white/15 text-4xs sm:text-3xs font-mono font-bold text-white shadow-sm">
                        EP {continueWatching.episodeNumber}
                    </div>
                </div>

                {/* ── Info Column ───────────────────────────────────────────── */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 sm:gap-1.5">
                    {/* Header Row: Indicator + Tag + Saga Name + Go to Episode */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-accent shadow-[0_0_8px_hsl(var(--brand-accent))] animate-pulse shrink-0" />
                            <span className="text-3xs sm:text-2xs font-mono font-black uppercase tracking-wider text-brand-accent shrink-0">
                                Continuar viendo
                            </span>
                            {continueWatching.sagaName && (
                                <>
                                    <span className="text-on-surface-variant/40 hidden sm:inline">·</span>
                                    <span className="text-3xs sm:text-2xs font-mono font-medium uppercase tracking-wider text-on-surface-variant truncate hidden sm:inline">
                                        {continueWatching.sagaName}
                                    </span>
                                </>
                            )}
                        </div>

                        {onGoToEpisode && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onGoToEpisode()
                                }}
                                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-3xs sm:text-2xs font-mono font-medium text-on-surface-variant hover:text-on-surface bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 hover:border-white/20 transition-all cursor-pointer shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
                                title="Ver este episodio en la lista"
                            >
                                <span>Ver en lista</span>
                                <IconNavigationChevronDown className="w-3 h-3 text-on-surface-variant group-hover/continue:text-on-surface transition-transform group-hover/continue:translate-y-0.5" />
                            </button>
                        )}
                    </div>

                    {/* Title */}
                    <div>
                        <h4 className="font-display text-xs sm:text-sm md:text-base font-bold uppercase tracking-wide leading-snug text-on-surface group-hover/continue:text-brand-accent transition-colors truncate">
                            Ep {continueWatching.episodeNumber} — {continueWatching.title}
                        </h4>
                    </div>

                    {/* Progress Bar & Details */}
                    <div className="flex items-center gap-2.5 sm:gap-3 pt-0.5">
                        <div className="flex-1 min-w-[50px]">
                            <WatchProgressBar percent={continueWatching.percent} size="hero" animateOnMount />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums text-3xs sm:text-xs">
                            <span className="font-black text-on-surface">{continueWatching.percent}%</span>
                            <span className="text-on-surface-variant/40">·</span>
                            <span className="text-on-surface-variant font-medium">{continueWatching.timeLeftLabel}</span>
                        </div>
                    </div>
                </div>

                {/* ── Desktop Reanudar CTA ──────────────────────────────────── */}
                <div className="hidden lg:flex items-center shrink-0 pl-2">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onResume()
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-brand-accent text-on-primary font-display text-xs uppercase tracking-wider font-bold hover:brightness-110 active:scale-95 transition-all shadow-[var(--shadow-brand-primary)] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                        <IconMediaPlay className="w-3.5 h-3.5 fill-current" />
                        <span>Reanudar</span>
                    </button>
                </div>
            </div>
        </section>
    )
}
