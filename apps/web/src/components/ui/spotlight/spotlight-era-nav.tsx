import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { ERAS, ERA_COLOR_MAP, type EraId } from "@/lib/config/eras"
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from "@/lib/hardware/performance-store"
import { MagneticIndicator, useReducedMotion } from "@/components/ui/kinetics"
import type { SwimlaneItem } from "@/components/ui/swimlane"

export interface SpotlightEraNavProps {
    activeEraId: EraId | "all"
    categorizedData: Record<EraId, { series: SwimlaneItem | null; movies: SwimlaneItem[] }>
    onSelectEra: (eraId: EraId | "all") => void
    onHoverSound?: () => void
    showAllOption?: boolean
}

const ALL_OPTION_COLORS = {
    accent: "rgba(255, 255, 255, 0.95)",
    glow: "rgba(255, 255, 255, 0.35)",
    glowStrong: "rgba(255, 255, 255, 0.6)",
    ambientGlow1: "#ffffff",
    ambientGlow2: "#e4e4e7",
}

interface NavItemConfig {
    id: EraId | "all"
    title: string
    shortTitle: string
    kanji: string
    colors: typeof ALL_OPTION_COLORS
    hasItems: boolean
}

export const SpotlightEraNav = React.memo(function SpotlightEraNav({
    activeEraId,
    categorizedData,
    onSelectEra,
    onHoverSound,
    showAllOption = false,
}: SpotlightEraNavProps) {
    const reduceMotion = useReducedMotion()
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed)

    // Aura pulsante + layoutId solo en equipos capaces
    const allowEraFx = isHeavyAllowed && !reduceMotion

    const items: NavItemConfig[] = React.useMemo(() => {
        const list: NavItemConfig[] = []
        if (showAllOption) {
            const hasAnyItems = ERAS.some((era) => {
                const eraData = categorizedData[era.id]
                return !!eraData?.series || (eraData?.movies?.length || 0) > 0
            })
            list.push({
                id: "all",
                title: "Todas las Eras",
                shortTitle: "Todas",
                kanji: "全",
                colors: ALL_OPTION_COLORS,
                hasItems: hasAnyItems,
            })
        }

        for (const era of ERAS) {
            const eraData = categorizedData[era.id]
            const hasSeries = !!eraData?.series
            const movieCount = eraData?.movies?.length || 0
            const hasItems = hasSeries || movieCount > 0

            list.push({
                id: era.id,
                title: era.title,
                shortTitle: era.shortTitle,
                kanji: era.kanji,
                colors: ERA_COLOR_MAP[era.id],
                hasItems,
            })
        }
        return list
    }, [showAllOption, categorizedData])

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        let newIndex = index
        const total = items.length
        switch (e.key) {
            case "ArrowRight":
                e.preventDefault()
                newIndex = (index + 1) % total
                break
            case "ArrowLeft":
                e.preventDefault()
                newIndex = (index - 1 + total) % total
                break
            case "Home":
                e.preventDefault()
                newIndex = 0
                break
            case "End":
                e.preventDefault()
                newIndex = total - 1
                break
            default:
                return
        }
        const target = items[newIndex]
        if (target && target.hasItems) {
            onSelectEra(target.id)
            onHoverSound?.()
        }
    }

    return (
        <div
            role="tablist"
            aria-label="Navegación de Eras de Dragon Ball"
            className="glass-frosted-pill relative z-20 flex items-center justify-between gap-2 w-full p-1.5 sm:p-2 overflow-hidden"
        >
            <div className="relative z-10 flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full flex-1 [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)] sm:[mask-image:none]">
                {items.map((item, index) => {
                    const isEraActive = item.id === activeEraId
                    const isAll = item.id === "all"
                    const displayTitle = item.shortTitle
                    const eraColors = item.colors
                    const hasItems = item.hasItems

                    return (
                        <button
                            key={item.id}
                            role="tab"
                            aria-selected={isEraActive}
                            aria-disabled={!hasItems}
                            disabled={!hasItems}
                            tabIndex={isEraActive ? 0 : (!hasItems ? -1 : 0)}
                            onClick={() => {
                                if (!hasItems) return
                                onSelectEra(item.id)
                            }}
                            onMouseEnter={hasItems ? onHoverSound : undefined}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            title={!hasItems ? `${item.title} (No disponible)` : undefined}
                            className={cn(
                                "group relative flex flex-[1_0_auto] items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 min-h-[44px] rounded-full text-center select-none transition-[transform,background-color,color,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent",
                                isEraActive
                                    ? isAll
                                        ? "text-zinc-950 font-black cursor-pointer"
                                        : "text-white font-extrabold cursor-pointer"
                                    : hasItems
                                        ? "text-on-surface-variant hover:text-white hover:bg-white/[0.08] cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                        : "text-zinc-500 opacity-40 cursor-not-allowed"
                            )}
                        >
                            {/* Pill activa: adopta el color vibrante y glow de la era con MagneticIndicator */}
                            <MagneticIndicator
                                layoutId="activeEraPill"
                                active={isEraActive}
                                disableAnimation={!allowEraFx}
                                className={cn(
                                    "border-t",
                                    isAll ? "border-t-white" : "border-t-white/50"
                                )}
                                style={{
                                    background: eraColors.accent,
                                    boxShadow: allowEraFx
                                        ? isAll
                                            ? "0 2px 14px rgba(255,255,255,0.4), inset 0 1px 1px rgba(255,255,255,0.9)"
                                            : `0 2px 14px ${eraColors.glow}, inset 0 1px 1px rgba(255,255,255,0.45)`
                                        : undefined,
                                }}
                            />

                            {/* Kanji Circle */}
                            <div
                                className={cn(
                                    "relative z-10 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-2xs sm:text-xs select-none shrink-0 transition-colors duration-200 border",
                                    isEraActive
                                        ? isAll
                                            ? "text-zinc-950 font-black shadow-elevation-1 bg-black/10 border-black/20"
                                            : "text-white shadow-elevation-1 bg-black/25 border-white/40"
                                        : !hasItems
                                            ? "text-zinc-500 bg-white/5 border-white/10 shadow-none grayscale"
                                            : "text-white/80 group-hover:text-white"
                                )}
                                style={isEraActive || !hasItems ? undefined : {
                                    borderColor: `color-mix(in srgb, ${eraColors.ambientGlow1} 35%, rgba(255,255,255,0.12))`,
                                    backgroundColor: `color-mix(in srgb, ${eraColors.ambientGlow1} 10%, transparent)`,
                                    color: `color-mix(in srgb, ${eraColors.ambientGlow1} 90%, #ffffff)`,
                                    boxShadow: `0 0 6px color-mix(in srgb, ${eraColors.ambientGlow1} 12%, transparent)`,
                                }}
                            >
                                {isEraActive && allowEraFx && !isAll && (
                                    <span
                                        className="absolute inset-0 rounded-full pointer-events-none animate-pulse-glow-soft transform-gpu will-change-transform"
                                        style={{
                                            boxShadow: `0 0 10px ${eraColors.glowStrong}`,
                                            backgroundColor: "rgba(255,255,255,0.18)",
                                        }}
                                    />
                                )}
                                {item.kanji}
                            </div>

                            <div className="relative z-10 flex flex-col text-center items-center justify-center min-w-0 pr-0.5">
                                <span
                                    className={cn(
                                        "font-sans font-extrabold text-2xs sm:text-xs tracking-wider uppercase leading-tight whitespace-nowrap transition-colors duration-200",
                                        isEraActive
                                            ? isAll
                                                ? "text-zinc-950 font-black"
                                                : "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                                            : !hasItems
                                                ? "text-zinc-500"
                                                : "text-on-surface-variant group-hover:text-white"
                                    )}
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
