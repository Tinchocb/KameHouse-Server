import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { ERAS, ERA_COLOR_MAP, type EraId } from "@/lib/config/eras"
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from "@/lib/hardware/performance-store"
import { MagneticIndicator, useReducedMotion } from "@/components/ui/kinetics"
import type { SwimlaneItem } from "@/components/ui/swimlane"

export interface SpotlightEraNavProps {
    activeEraId: EraId | "all"
    categorizedData: Record<EraId, { series: SwimlaneItem | null; movies: SwimlaneItem[] }>
    onSelectEra: (eraId: EraId) => void
    onHoverSound: () => void
}

export const SpotlightEraNav = React.memo(function SpotlightEraNav({
    activeEraId,
    categorizedData,
    onSelectEra,
    onHoverSound,
}: SpotlightEraNavProps) {
    const reduceMotion = useReducedMotion()
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed)

    // Aura pulsante + layoutId solo en equipos capaces
    const allowEraFx = isHeavyAllowed && !reduceMotion

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        let newIndex = index
        switch (e.key) {
            case "ArrowRight":
                e.preventDefault()
                newIndex = (index + 1) % ERAS.length
                break
            case "ArrowLeft":
                e.preventDefault()
                newIndex = (index - 1 + ERAS.length) % ERAS.length
                break
            case "Home":
                e.preventDefault()
                newIndex = 0
                break
            case "End":
                e.preventDefault()
                newIndex = ERAS.length - 1
                break
            default:
                return
        }
        const targetEra = ERAS[newIndex]
        if (targetEra) {
            const eraData = categorizedData[targetEra.id]
            const hasItems = !!eraData?.series || (eraData?.movies?.length || 0) > 0
            if (hasItems) {
                onSelectEra(targetEra.id)
                onHoverSound?.()
            }
        }
    }

    return (
        <div
            role="tablist"
            aria-label="Navegación de Eras de Dragon Ball"
            className="relative z-20 flex items-center justify-between gap-2 bg-zinc-950/65 backdrop-blur-md border border-white/20 border-t-white/40 border-b-white/10 rounded-full p-1.5 sm:p-2 shadow-[shadow:var(--glass-highlight-lg),0_8px_24px_-4px_rgba(0,0,0,0.7)] overflow-hidden transform-gpu"
        >
            <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full flex-1">
                {ERAS.map((era, index) => {
                    const isEraActive = era.id === activeEraId
                    const displayTitle = era.shortTitle

                    const eraColors = ERA_COLOR_MAP[era.id]
                    const eraData = categorizedData[era.id]
                    const hasSeries = !!eraData?.series
                    const movieCount = eraData?.movies?.length || 0
                    const hasItems = hasSeries || movieCount > 0

                    return (
                        <button
                            key={era.id}
                            role="tab"
                            aria-selected={isEraActive}
                            aria-disabled={!hasItems}
                            disabled={!hasItems}
                            tabIndex={isEraActive ? 0 : (!hasItems ? -1 : 0)}
                            onClick={() => {
                                if (!hasItems) return
                                onSelectEra(era.id)
                            }}
                            onMouseEnter={hasItems ? onHoverSound : undefined}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            title={!hasItems ? `${era.title} (No disponible)` : undefined}
                            className={cn(
                                "relative flex flex-1 items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-center shrink-0 select-none transition-[transform,background-color,color,opacity] duration-150",
                                isEraActive
                                    ? "text-white font-extrabold cursor-pointer"
                                    : hasItems
                                        ? "text-on-surface-variant hover:text-on-surface hover:bg-white/10 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                        : "text-zinc-500 opacity-40 cursor-not-allowed"
                            )}
                        >
                            {/* Pill activa: adopta el color vibrante y glow de la era con MagneticIndicator */}
                            <MagneticIndicator
                                layoutId="activeEraPill"
                                active={isEraActive}
                                disableAnimation={!allowEraFx}
                                style={{
                                    background: eraColors.accent,
                                    boxShadow: allowEraFx
                                        ? `0 2px 14px ${eraColors.glow}, inset 0 1px 1px rgba(255,255,255,0.45)`
                                        : undefined,
                                }}
                            />

                            {/* Kanji Circle */}
                            <div
                                className={cn(
                                    "relative z-10 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-2xs sm:text-xs select-none shrink-0 transition-colors duration-200 border",
                                    isEraActive
                                        ? "text-white shadow-elevation-1 bg-black/25 border-white/40"
                                        : !hasItems
                                            ? "text-zinc-500 bg-white/5 border-white/10 shadow-none grayscale"
                                            : ""
                                )}
                                style={isEraActive || !hasItems ? undefined : {
                                    borderColor: `color-mix(in srgb, ${eraColors.ambientGlow1} 55%, rgba(255,255,255,0.12))`,
                                    backgroundColor: `color-mix(in srgb, ${eraColors.ambientGlow1} 14%, transparent)`,
                                    color: eraColors.ambientGlow1,
                                    boxShadow: `0 0 8px color-mix(in srgb, ${eraColors.ambientGlow1} 18%, transparent)`,
                                }}
                            >
                                {isEraActive && allowEraFx && (
                                    <span
                                        className="absolute inset-0 rounded-full pointer-events-none animate-pulse-glow-soft transform-gpu will-change-transform"
                                        style={{
                                            boxShadow: `0 0 10px ${eraColors.glowStrong}`,
                                            backgroundColor: "rgba(255,255,255,0.18)",
                                        }}
                                    />
                                )}
                                {era.kanji}
                            </div>

                            <div className="relative z-10 flex flex-col text-center items-center justify-center min-w-0 pr-0.5">
                                <span
                                    className={cn(
                                        "font-sans font-extrabold text-2xs sm:text-xs tracking-wider uppercase leading-tight whitespace-nowrap transition-colors duration-200",
                                        isEraActive
                                            ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                                            : !hasItems
                                                ? "text-zinc-500"
                                                : ""
                                    )}
                                    style={
                                        isEraActive || !hasItems
                                            ? undefined
                                            : { color: `color-mix(in srgb, ${eraColors.ambientGlow1} 80%, #e4e4e7)` }
                                    }
                                >
                                    {displayTitle}
                                </span>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
})

