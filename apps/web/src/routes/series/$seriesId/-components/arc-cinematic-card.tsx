import * as React from "react"
import { m, type Variants } from "framer-motion"
import { IconNavigationChevronRight } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"

interface ArcCinematicCardProps {
    image?: string | null
    topLeft: string
    topRight?: string | null
    title: string
    metaLeft: string
    metaRight?: string
    isActive?: boolean
    progressPercent?: number
    missingCount?: number
    totalEpisodesCount?: number
    onClick: () => void
    onDoubleClick?: () => void
    nativeTitle?: string
    onHover?: () => void
    borderGlow?: string
    layoutId?: string
    /** Posición en la lista: escalona la entrada (tope 12 · 40ms). */
    index?: number
    children?: React.ReactNode
}

// Entrada solo por opacidad: si Framer animara transform dejaría
// `transform: none` inline al terminar y anularía el hover (-translate-y) y el
// press (active:scale) de CSS, que son los que dan la respuesta al puntero.
const arcCardEntranceVariants: Variants = {
    hidden: { opacity: 0 },
    visible: (i: number = 0) => ({
        opacity: 1,
        transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 12) * 0.04 },
    }),
}

export const ArcCinematicCard = React.memo(function ArcCinematicCard({
    topLeft,
    topRight,
    title,
    metaLeft,
    metaRight,
    isActive = false,
    progressPercent,
    missingCount = 0,
    totalEpisodesCount = 0,
    onClick,
    onDoubleClick,
    nativeTitle,
    onHover,
    borderGlow,
    layoutId,
    index = 0,
}: ArcCinematicCardProps) {
    const activeCardTransition = useSpringPreset("tabIndicator")

    return (
        <m.button
            type="button"
            variants={arcCardEntranceVariants}
            custom={index}
            initial="hidden"
            animate="visible"
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onMouseEnter={onHover}
            title={nativeTitle ?? title}
            aria-label={nativeTitle ?? title}
            aria-current={isActive ? "true" : undefined}
            className={cn(
                "group relative w-full text-left flex items-center justify-between gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 min-h-[50px] rounded-xl select-none cursor-pointer transform-gpu isolate",
                "transition-[border-color,background-color,box-shadow,transform] duration-fast ease-out-strong active:scale-95",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent/70",
                "border",
                // El aspecto activo (degradado, borde, ring y sombra) vive en el
                // indicador compartido de abajo, para que viaje entero entre tarjetas.
                isActive
                    ? "border-transparent text-on-surface"
                    : "bg-white/[0.04] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.08] border-white/[0.08] [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/20 text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface shadow-glass-highlight-sm [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5"
            )}
            style={{
                borderColor: isActive ? undefined : (borderGlow || undefined),
            }}
        >
            {/* Sin overflow-hidden en el botón: el indicador viaja visible entre
                tarjetas. -inset-px cubre el borde transparente del botón y
                borderRadius 20 (= rounded-xl) mantiene las esquinas durante el
                layout. -z-10 lo deja sobre el fondo y bajo el texto (el botón
                forma contexto de apilamiento con isolate). */}
            {isActive && (
                <m.div
                    layoutId={layoutId}
                    transition={activeCardTransition}
                    style={{ borderRadius: 20 }}
                    className="absolute -inset-px -z-10 rounded-xl border border-white/35 ring-1 ring-white/15 bg-gradient-to-r from-white/[0.16] via-white/[0.10] to-white/[0.04] shadow-[shadow:var(--elevation-3),var(--glass-highlight-lg)] pointer-events-none"
                />
            )}
            {/* Lado izquierdo: Barra de acento + Título y Metadatos */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                {/* Barra de acento */}
                <div
                    className={cn(
                        "w-1 h-7 rounded-full shrink-0 [transition:background-color_var(--duration-base)_var(--ease-smooth-out),transform_var(--duration-base)_var(--ease-smooth-out),opacity_var(--duration-base)_var(--ease-smooth-out),box-shadow_var(--duration-base)_var(--ease-smooth-out)]",
                        isActive
                            ? "bg-brand-accent shadow-[0_0_10px_hsl(var(--brand-accent)/0.6)] opacity-100 scale-100"
                            : "bg-white/20 opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 scale-75 [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-100"
                    )}
                />

                {/* Título y metadatos */}
                <div className="flex flex-col min-w-0 flex-1">
                    <span className={cn(
                        "font-display text-xs sm:text-sm font-bold uppercase tracking-wide truncate transition-colors duration-fast ease-smooth-out",
                        isActive ? "text-on-surface font-extrabold" : "text-on-surface [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-on-surface"
                    )}>
                        {title}
                    </span>
                    <div className="flex items-center gap-1.5 text-3xs sm:text-2xs font-mono text-on-surface-variant/80 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-on-surface transition-colors duration-fast ease-smooth-out truncate mt-0.5">
                        <span className="font-semibold text-on-surface-variant">{topLeft}</span>
                        {metaLeft && (
                            <>
                                <span className="opacity-40">·</span>
                                <span>{metaLeft}</span>
                            </>
                        )}
                        {metaRight && (
                            <>
                                <span className="opacity-40">·</span>
                                <span className="text-on-surface-variant">{metaRight}</span>
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
            <div className="shrink-0 flex items-center gap-1.5 text-on-surface-variant group-hover:text-on-surface [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5 transition-[transform,color] duration-fast ease-out-strong">
                {topRight && (
                    <span className={cn(
                        "text-4xs font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0",
                        isActive
                            ? "bg-white/25 text-on-surface border border-white/30 shadow-sm"
                            : "bg-white/[0.08] text-on-surface-variant border border-white/15"
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
                            "h-full transition-[width] duration-300",
                            isActive ? "bg-brand-accent shadow-[0_0_6px_hsl(var(--brand-accent)/0.8)]" : "bg-white/40"
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                    />
                </div>
            )}
        </m.button>
    )
})