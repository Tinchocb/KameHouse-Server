import * as React from "react"
import { m } from "framer-motion"
import { IconNavigationChevronRight } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"

interface ArcCinematicCardProps {
    topLeft: string
    topRight?: string | null
    title: string
    metaLeft: string
    isActive?: boolean
    progressPercent?: number
    onClick: () => void
    onDoubleClick?: () => void
    nativeTitle?: string
    onHover?: () => void
    layoutId?: string
}

// La entrada la coordina el panel de sagas: no se vuelve a fundir cada fila.
export const ArcCinematicCard = React.memo(function ArcCinematicCard({
    topLeft,
    topRight,
    title,
    metaLeft,
    isActive = false,
    progressPercent,
    onClick,
    onDoubleClick,
    nativeTitle,
    onHover,
    layoutId,
}: ArcCinematicCardProps) {
    const activeCardTransition = useSpringPreset("tabIndicator")

    return (
        <m.button
            type="button"
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onMouseEnter={onHover}
            title={nativeTitle ?? title}
            aria-label={nativeTitle ?? title}
            aria-current={isActive ? "true" : undefined}
            data-active={isActive ? "true" : "false"}
            className={cn(
                "arc-cinematic-card group relative w-full text-left flex items-center justify-between gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 min-h-[50px] rounded-lg select-none cursor-pointer transform-gpu isolate",
                "transition-[border-color,background-color,box-shadow,transform] duration-fast ease-out-strong motion-safe:active:scale-[0.97]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent/70",
                "border",
                // El aspecto activo (degradado, borde y elevación) vive en el
                // indicador compartido de abajo, para que viaje entero entre tarjetas.
                isActive
                    ? "border-transparent text-on-surface"
                    : "bg-white/[0.04] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.08] border-white/[0.08] [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/20 text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface shadow-glass-highlight-sm"
            )}
        >
            {/* Sin overflow-hidden en el botón: el indicador viaja visible entre
                tarjetas. -inset-px cubre el borde transparente del botón y
                borderRadius 16 (= rounded-lg) mantiene las esquinas durante el
                layout. -z-10 lo deja sobre el fondo y bajo el texto (el botón
                forma contexto de apilamiento con isolate). */}
            {isActive && (
                <m.div
                    layoutId={layoutId}
                    transition={activeCardTransition}
                    style={{ borderRadius: 16 }}
                    className="arc-card-active-indicator absolute -inset-px -z-10 rounded-lg border border-white/20 border-t-white/30 bg-gradient-to-b from-white/[0.10] to-white/[0.04] shadow-[shadow:var(--elevation-3),var(--glass-highlight-lg),var(--double-bezel-ring)] pointer-events-none"
                />
            )}
            {/* Lado izquierdo: Barra de acento + Título y Metadatos */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                {/* Barra de acento */}
                <div
                    className={cn(
                        "arc-card-accent-bar w-1 h-7 rounded-full shrink-0 [transition:background-color_var(--duration-base)_var(--ease-smooth-out),transform_var(--duration-base)_var(--ease-smooth-out),opacity_var(--duration-base)_var(--ease-smooth-out),box-shadow_var(--duration-base)_var(--ease-smooth-out)]",
                        isActive
                            ? "bg-brand-accent shadow-[0_0_8px_hsl(var(--brand-accent)/0.45)] opacity-100 scale-100"
                            : "bg-white/20 opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 scale-75 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-100"
                    )}
                />

                {/* Título y metadatos */}
                <div className="flex flex-col min-w-0 flex-1">
                    <span className={cn(
                        "font-display text-xs sm:text-sm font-bold uppercase tracking-wide truncate transition-colors duration-fast ease-smooth-out",
                        isActive ? "text-on-surface" : "text-on-surface/85 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-on-surface"
                    )}>
                        {title}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-on-surface-variant/80 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-on-surface transition-colors duration-fast ease-smooth-out truncate mt-0.5">
                        <span className="font-semibold text-on-surface-variant">{topLeft}</span>
                        {metaLeft && (
                            <>
                                <span className="opacity-40">·</span>
                                <span>{metaLeft}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Lado derecho: Badge opcional + Chevron */}
            <div className="shrink-0 flex items-center gap-1.5 text-on-surface-variant group-hover:text-on-surface motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5 transition-[transform,color] duration-fast ease-out-strong">
                {topRight && (
                    <span className={cn(
                        "arc-card-badge text-xs font-mono font-bold tabular-nums px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0",
                        isActive
                            ? "bg-white/[0.12] text-on-surface border border-white/20 border-t-white/30 shadow-[shadow:var(--double-bezel-ring),var(--glass-highlight-sm)]"
                            : "bg-white/[0.05] text-on-surface-variant border border-white/[0.10]"
                    )}>
                        {topRight}
                    </span>
                )}
                <IconNavigationChevronRight className="w-4 h-4" />
            </div>

            {/* Barra de progreso de la saga si existe */}
            {progressPercent != null && progressPercent > 0 && (
                <div className="absolute bottom-0 inset-x-4 h-0.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className={cn(
                            "arc-card-progress-fill h-full transition-[width] duration-300",
                            isActive ? "bg-brand-accent shadow-[0_0_6px_hsl(var(--brand-accent)/0.8)]" : "bg-white/40"
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                    />
                </div>
            )}
        </m.button>
    )
})
