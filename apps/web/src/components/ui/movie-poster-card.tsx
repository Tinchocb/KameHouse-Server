import * as React from "react"
import { m, type Variants } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"

// Stagger de entrada compartido (antes en spotlight-movie-card): cada tarjeta
// recibe su índice vía custom para un cascade fluido sin overhead de JS.
export const moviePosterCardItemVariants: Variants = {
    hidden: { opacity: 0, y: 14, filter: "blur(8px)" },
    visible: (i: number = 0) => ({
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: {
            type: "spring",
            stiffness: 280,
            damping: 28,
            delay: i * 0.045,
        },
    }),
    exit: {
        opacity: 0,
        y: -6,
        filter: "blur(4px)",
        transition: { duration: 0.15, ease: "easeIn" },
    },
}

export interface MoviePosterCardProps {
    image: string
    title: string
    /** Índice para el stagger de entrada (custom de la variante). */
    index?: number
    /** Contenido apilado arriba-izquierda (score, #01, canon...). */
    topLeft?: React.ReactNode
    /** Contenido apilado arriba-derecha (año, visto, menú...). Los elementos interactivos deben llevar `pointer-events-auto`. */
    topRight?: React.ReactNode
    /** Overlay central en hover (play, añadir a cola...). El contenedor es pointer-events-none. */
    centerOverlay?: React.ReactNode
    /** Meta pequeña bajo el título (año • runtime). */
    bottomMeta?: React.ReactNode
    /** 0-100 para la barra de progreso inferior. */
    progressPercent?: number
    progressColor?: string
    /** Color del borde; por defecto glass. Home pasa el glow de la era. */
    borderColor?: string
    /** Color del título en hover; por defecto hereda. */
    titleHoverColor?: string
    /** Atenúa el póster (ej. sin archivos locales). */
    dimmed?: boolean
    showSkeleton?: boolean
    imageFallback?: React.ReactNode
    onClick?: () => void
    onMouseEnter?: () => void
    onMouseLeave?: () => void
    onFocus?: () => void
    className?: string
}

/**
 * MoviePosterCard — tarjeta de película canónica compartida por Home y Películas.
 * Póster `aspect-[2/3] rounded-2xl` limpio con título y meta debajo: mismo
 * tamaño en ambas páginas. Las diferencias de contexto (score, visto, progreso, menú
 * móvil, acciones) entran por slots sin alterar la caja.
 */
export const MoviePosterCard = React.memo(function MoviePosterCard({
    image,
    title,
    index,
    topLeft,
    topRight,
    centerOverlay,
    bottomMeta,
    progressPercent,
    progressColor,
    borderColor,
    titleHoverColor,
    dimmed,
    showSkeleton,
    imageFallback,
    onClick,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    className,
}: MoviePosterCardProps) {
    const hasProgress = progressPercent != null && progressPercent > 0 && progressPercent < 100

    return (
        <m.div
            variants={moviePosterCardItemVariants}
            custom={index ?? 0}
            onClick={onClick}
            // Activable con teclado (Tab + Enter/Espacio): antes solo con mouse, y el
            // onFocus que reciben algunas vistas nunca se disparaba.
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            aria-label={onClick ? title : undefined}
            onKeyDown={onClick ? (e) => {
                if (e.target !== e.currentTarget) return
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onClick()
                }
            } : undefined}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onFocus={onFocus}
            className={cn(
                "group relative w-full flex flex-col gap-2.5 cursor-pointer select-none shrink-0 outline-none",
                dimmed && "opacity-60",
                className,
            )}
            style={titleHoverColor ? { "--poster-title-hover": titleHoverColor } as React.CSSProperties : undefined}
        >
            {/* Póster limpio: el arte oficial ya trae su logo, así que no lleva
                título ni degradé encima (antes quedaban dos títulos pisados). */}
            <div
                className={cn(
                    "relative w-full aspect-[2/3] rounded-2xl overflow-hidden border border-[var(--glass-border-side)] bg-[var(--md-sys-color-surface-container)] transform-gpu",
                    "transition-[transform,border-color,box-shadow] duration-base ease-smooth-out group-hover:-translate-y-1 group-hover:scale-[1.015] group-active:scale-95",
                    "group-hover:shadow-[0_15px_35px_rgba(0,0,0,0.9)] group-focus-visible:ring-2 group-focus-visible:ring-brand-accent",
                )}
                style={borderColor ? { borderColor } : undefined}
            >
                <DeferredImage
                    src={image}
                    alt={title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    showSkeleton={showSkeleton}
                    fallback={imageFallback}
                />
                <div aria-hidden className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/10 to-transparent z-10 pointer-events-none" />

                {/* Velo solo en hover: da contraste a las acciones sin apagar el póster en reposo */}
                {centerOverlay && (
                    <div aria-hidden className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none" />
                )}

                {/* Top Badges (cada badge ya trae su fondo, no hace falta scrim) */}
                {(topLeft || topRight) && (
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-1 z-20 pointer-events-none">
                        <div className="flex flex-col items-start gap-1">
                            {topLeft}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            {topRight}
                        </div>
                    </div>
                )}

                {/* Center Overlay on Hover — siempre visible en táctil */}
                {centerOverlay && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity duration-200 z-20 pointer-events-none">
                        {centerOverlay}
                    </div>
                )}

                {/* Progress bar at bottom of poster */}
                {hasProgress && (
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-black/50 z-20 pointer-events-none">
                        <div
                            className="h-full transition-all duration-300"
                            style={{ width: `${progressPercent}%`, backgroundColor: progressColor }}
                        />
                    </div>
                )}
            </div>

            {/* Título y meta debajo del póster */}
            <div className="flex flex-col gap-0.5 px-0.5 pointer-events-none">
                <p className="text-white font-black text-sm sm:text-[15px] uppercase tracking-wide leading-snug line-clamp-2 group-hover:text-[var(--poster-title-hover)] transition-colors font-display">
                    {title}
                </p>
                {bottomMeta && (
                    <div className="text-on-surface-variant text-2xs sm:text-xs font-mono font-semibold">
                        {bottomMeta}
                    </div>
                )}
            </div>
        </m.div>
    )
})
