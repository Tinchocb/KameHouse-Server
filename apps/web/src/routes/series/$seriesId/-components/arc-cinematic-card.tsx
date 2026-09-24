import * as React from "react"
import { m } from "framer-motion"
import { IconNavigationChevronRight } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"

export interface ArcCinematicCardProps {
    image?: string | null
    topLeft: string
    topRight?: string | null
    title: string
    metaLeft: string
    metaRight?: string
    isActive?: boolean
    progressPercent?: number
    isFiller?: boolean
    missingCount?: number
    totalEpisodesCount?: number
    onClick: () => void
    onDoubleClick?: () => void
    nativeTitle?: string
    onHover?: () => void
    borderGlow?: string
    layoutId?: string
    children?: React.ReactNode
}

export const ArcCinematicCard = React.memo(function ArcCinematicCard({
    topLeft,
    topRight,
    title,
    metaLeft,
    metaRight,
    isActive = false,
    progressPercent,
    isFiller = false,
    missingCount = 0,
    totalEpisodesCount = 0,
    onClick,
    onDoubleClick,
    nativeTitle,
    onHover,
    borderGlow,
    layoutId,
}: ArcCinematicCardProps) {
    const activeCardTransition = useSpringPreset("tabIndicator")

    return (
        <m.button
            type="button"
            variants={{ hidden: { opacity: 0, scale: 0.98 }, visible: { opacity: 1, scale: 1 } }}
            initial="hidden"
            animate="visible"
            transition={activeCardTransition}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onMouseEnter={onHover}
            title={nativeTitle ?? title}
            aria-label={nativeTitle ?? title}
            aria-current={isActive ? "true" : undefined}
            className={cn(
                "group relative w-full text-left flex items-center justify-between gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 min-h-[50px] rounded-xl select-none cursor-pointer transform-gpu overflow-hidden",
                "transition-[border-color,background-color,box-shadow,transform] duration-200 active:scale-[0.98]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent/70",
                "border",
                isActive
                    ? "bg-gradient-to-r from-white/[0.16] via-white/[0.10] to-white/[0.04] border-white/35 text-white shadow-[shadow:0_6px_24px_rgba(0,0,0,0.6),var(--glass-highlight-lg)] ring-1 ring-white/15"
                    : "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] hover:border-white/20 text-zinc-300 hover:text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:-translate-y-0.5"
            )}
            style={{
                borderColor: isActive ? undefined : (borderGlow || undefined),
            }}
        >
            {isActive && layoutId && (
                <m.div
                    layoutId={layoutId}
                    transition={activeCardTransition}
                    className="absolute inset-0 rounded-xl bg-white/[0.06] border border-white/30 pointer-events-none -z-0"
                />
            )}
            {/* Lado izquierdo: Barra de acento + Título y Metadatos */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                {/* Barra de acento */}
                <div
                    className={cn(
                        "w-1 h-7 rounded-full shrink-0 [transition:background-color_var(--duration-fast)_var(--ease-smooth-out),transform_var(--duration-fast)_var(--ease-smooth-out),opacity_var(--duration-fast)_var(--ease-smooth-out),box-shadow_var(--duration-fast)_var(--ease-smooth-out)]",
                        isActive
                            ? "bg-brand-accent shadow-[0_0_10px_hsl(var(--brand-accent)/0.6)] opacity-100 scale-100"
                            : "bg-white/20 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
                    )}
                />

                {/* Título y metadatos */}
                <div className="flex flex-col min-w-0 flex-1">
                    <span className={cn(
                        "font-display text-xs sm:text-sm font-bold uppercase tracking-wide truncate transition-colors",
                        isActive ? "text-white font-extrabold" : "text-zinc-200 group-hover:text-white"
                    )}>
                        {title}
                    </span>
                    <div className="flex items-center gap-1.5 text-3xs sm:text-2xs font-mono text-zinc-400 group-hover:text-zinc-300 truncate mt-0.5">
                        <span className="font-semibold text-zinc-300">{topLeft}</span>
                        {metaLeft && (
                            <>
                                <span className="opacity-40">·</span>
                                <span>{metaLeft}</span>
                            </>
                        )}
                        {metaRight && (
                            <>
                                <span className="opacity-40">·</span>
                                <span className="text-zinc-400">{metaRight}</span>
                            </>
                        )}
                        {isFiller && (
                            <>
                                <span className="opacity-40">·</span>
                                <span className="text-amber-400 font-semibold px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">Relleno</span>
                            </>
                        )}
                        {missingCount > 0 && totalEpisodesCount > 0 && (
                            <>
                                <span className="opacity-40">·</span>
                                <span className="text-amber-400 font-semibold">Faltan {missingCount}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Lado derecho: Badge opcional + Chevron */}
            <div className="shrink-0 flex items-center gap-1.5 text-zinc-400 group-hover:text-white group-hover:translate-x-0.5 transition-all">
                {topRight && (
                    <span className={cn(
                        "text-4xs font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0",
                        isActive
                            ? "bg-white/25 text-white border border-white/30 shadow-sm"
                            : "bg-white/[0.08] text-zinc-300 border border-white/15"
                    )}>
                        {topRight}
                    </span>
                )}
                <IconNavigationChevronRight className="w-4 h-4" />
            </div>

            {/* Barra de progreso de la saga si existe */}
            {progressPercent != null && progressPercent > 0 && (
                <div className="absolute bottom-0 inset-x-3 h-0.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className={cn(
                            "h-full transition-all duration-300",
                            isActive ? "bg-brand-accent shadow-[0_0_6px_hsl(var(--brand-accent)/0.8)]" : "bg-white/40"
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                    />
                </div>
            )}
        </m.button>
    )
})