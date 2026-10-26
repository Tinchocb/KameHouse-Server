import * as React from "react"
import { m, type Variants } from "framer-motion"
import { IconMediaPlay } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import { Button } from "@/components/ui/button"
import { gridItemVariants, useMotionTier, cardMotionProps, type MotionTier } from "@/components/ui/kinetics"

// Stagger de entrada canónico compartido sin blur por ítem y con delay acotado (tope 12)
export const moviePosterCardItemVariants: Variants = gridItemVariants

interface MoviePosterCardProps {
    image: string
    title: string
    /** Índice para el stagger de entrada (custom de la variante). */
    index?: number
    /**
     * Entrada autónoma: "hidden" anima la cascada, false monta ya visible
     * (filas virtualizadas). Sin definir, hereda las variantes del grid padre.
     */
    initial?: boolean | "hidden"
    /** Tier de movimiento explícito; si no se provee se obtiene de useMotionTier(). */
    motionTier?: MotionTier
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
    /** Clave de elemento compartido (`movies:<id>`): al abrir la ficha, la portada vuela a la de la ficha. */
    sharedKey?: string
    onClick?: () => void
    onMouseEnter?: () => void
    onMouseLeave?: () => void
    onFocus?: () => void
    /** Teclas sobre la tarjeta (burbujean desde su botón principal): atajos de acciones secundarias. */
    onKeyDown?: React.KeyboardEventHandler<HTMLElement>
    className?: string
    // Nuevas propiedades Fusión A + B (Full-Bleed 2:3 + Drawer técnico)
    year?: string | number
    runtime?: string | number
    typeLabel?: string
    score?: string | number
    synopsis?: string
    eraColor?: string
    eraLabel?: string
    isNew?: boolean
    isSpecial?: boolean
    indexLabel?: string
    actions?: React.ReactNode
    isFullBleed?: boolean
}

/**
 * MoviePosterCard — tarjeta de película canónica compartida por Home y Películas.
 * Formato Fusión A + B (Full-Bleed 2:3 con Drawer técnico de sinopsis y acciones en hover).
 */
export const MoviePosterCard = React.memo(function MoviePosterCard({
    image,
    title,
    index,
    initial,
    motionTier: explicitTier,
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
    sharedKey,
    onClick,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onKeyDown,
    className,
    year,
    runtime,
    typeLabel,
    score,
    synopsis,
    eraColor,
    eraLabel: _eraLabel,
    isNew,
    isSpecial,
    indexLabel,
    actions,
    isFullBleed = true,
}: MoviePosterCardProps) {
    const hasProgress = progressPercent != null && progressPercent > 0 && progressPercent < 100
    const detectedTier = useMotionTier()
    const activeTier = explicitTier ?? detectedTier
    const motionProps = cardMotionProps(activeTier)

    const isFullTier = activeTier === "full"
    const isSubtleTier = activeTier === "subtle"

    return (
        <m.div
            variants={moviePosterCardItemVariants}
            custom={index ?? 0}
            initial={initial}
            animate={initial !== undefined ? "visible" : undefined}
            whileHover={motionProps.whileHover}
            transition={motionProps.transition}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            className={cn(
                "group relative w-full h-full flex flex-col cursor-pointer select-none shrink-0 outline-none",
                className,
            )}
            style={{
                "--poster-title-hover": titleHoverColor ?? (eraColor || "var(--brand-accent)"),
                "--poster-era-accent": eraColor || "var(--brand-accent)",
            } as React.CSSProperties}
        >
            {/* Destino de teclado y lectores de pantalla */}
            {onClick && (
                <button
                    type="button"
                    aria-label={title}
                    className="absolute inset-0 rounded-2xl outline-none cursor-pointer"
                />
            )}

            {/* Contenedor del póster: aspect-[2/3] o flexible en acordeón */}
            <div
                data-shared-poster={sharedKey}
                className={cn(
                    "relative w-full aspect-[2/3] rounded-2xl overflow-hidden border border-[var(--glass-border-side)] bg-[var(--md-sys-color-surface-container)] transform-gpu",
                    isFullTier
                        ? "transition-[transform,border-color,box-shadow] duration-base ease-smooth-out group-active:scale-95"
                        : isSubtleTier
                        ? "transition-[transform,border-color] duration-base ease-smooth-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-y-1 [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.015] group-active:scale-95"
                        : "transition-[border-color,box-shadow] duration-base ease-smooth-out",
                    "[@media(hover:hover)_and_(pointer:fine)]:group-hover:shadow-[shadow:var(--shadow-poster-hover)] group-has-[:focus-visible]:ring-2 group-has-[:focus-visible]:ring-brand-accent",
                )}
                style={borderColor ? { borderColor } : undefined}
            >
                <DeferredImage
                    src={image}
                    alt={title}
                    className={cn(
                        "absolute inset-0 h-full w-full object-cover [filter:saturate(1.14)_contrast(1.05)] transition-[transform,opacity] duration-slow ease-smooth-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.04]",
                        dimmed && "opacity-50",
                    )}
                    showSkeleton={showSkeleton}
                    fallback={imageFallback}
                />

                {/* Brillo sutil en hover (shine sweep) */}
                <div
                    aria-hidden
                    className="absolute inset-0 -translate-x-full [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-full transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover:transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/10 to-transparent z-10 pointer-events-none"
                />

                {/* Top Badges separados (Score / # a la izquierda, Nuevo / Especial a la derecha) */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-1 z-20 pointer-events-none">
                    <div className="flex items-center gap-1">
                        {score != null ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/75 px-2 py-0.5 text-xs font-mono font-bold text-white shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                                <span className="text-amber-400">★</span>
                                <span className="tabular-nums">{score}</span>
                            </span>
                        ) : indexLabel ? (
                            <span className="rounded-md bg-black/75 border border-white/20 px-2 py-0.5 text-xs font-mono font-bold text-orange-400 shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                                {indexLabel}
                            </span>
                        ) : topLeft}
                    </div>

                    <div className="flex items-center gap-1">
                        {isNew ? (
                            <span className="rounded-full border border-orange-400/40 bg-black/75 px-2 py-0.5 text-xs font-bold text-orange-200 shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                                Nuevo
                            </span>
                        ) : isSpecial ? (
                            <span className="rounded-full border border-amber-400/35 bg-black/75 px-2 py-0.5 text-xs font-mono font-semibold text-amber-300 shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                                {typeLabel ?? "Especial"}
                            </span>
                        ) : topRight}
                    </div>
                </div>

                {/* Scrims: superior ligero + inferior en reposo + oscurecido en hover por opacity */}
                <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/45 to-transparent z-10 pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-black/95 via-black/60 to-transparent z-10 pointer-events-none" />
                <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/[0.82] to-black/20 opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 transition-opacity duration-base ease-smooth-out z-10 pointer-events-none"
                />

                {/* Center overlay tradicional si no es full-bleed */}
                {!isFullBleed && centerOverlay && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 max-sm:opacity-100 transition-opacity duration-fast ease-smooth-out z-20 pointer-events-none">
                        {centerOverlay}
                    </div>
                )}

                {/* Barra de progreso inferior */}
                {hasProgress && (
                    <div className="absolute bottom-0 inset-x-0 h-[3px] bg-black/55 z-20 pointer-events-none overflow-hidden">
                        <div
                            className="h-full w-full origin-left transition-transform duration-base ease-smooth-out"
                            style={{
                                transform: `scaleX(${progressPercent / 100})`,
                                backgroundColor: progressColor ?? eraColor,
                            }}
                        />
                    </div>
                )}

                {/* FUSIÓN A + B: Contenido integrado Full-Bleed + Drawer técnico en hover */}
                {isFullBleed && (
                    <div className="absolute inset-x-0 bottom-0 p-3 sm:p-3.5 z-20 flex flex-col justify-end pointer-events-none">
                        {/* Meta fila: punto de era, año, tipo y duración en verde */}
                        <div className="flex items-center gap-1.5 text-xs font-mono text-white/80 tabular-nums">
                            {eraColor && (
                                <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0 shadow-sm"
                                    style={{ backgroundColor: eraColor, boxShadow: `0 0 6px ${eraColor}` }}
                                />
                            )}
                            {year && <span>{year}</span>}
                            {year && typeLabel && <span className="text-white/40">·</span>}
                            {typeLabel && (
                                <span className={cn(isSpecial ? "text-amber-300 font-semibold" : "text-orange-300/90 font-semibold")}>
                                    {typeLabel}
                                </span>
                            )}
                            {runtime && (
                                <>
                                    <span className="hidden [@media(hover:hover)_and_(pointer:fine)]:group-hover:inline text-white/40">·</span>
                                    <span className="hidden [@media(hover:hover)_and_(pointer:fine)]:group-hover:inline text-emerald-400 font-bold tabular-nums">
                                        {runtime}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Título en la base del póster */}
                        <p className="text-on-surface font-black text-xs sm:text-sm uppercase tracking-wide leading-snug line-clamp-2 text-edge-glow mt-0.5 group-hover:text-[var(--poster-title-hover)] transition-colors font-display text-balance">
                            {title}
                        </p>

                        {/* Drawer técnico desplegable en hover (Sinopsis + Acciones) */}
                        {(synopsis || actions || centerOverlay) && (
                            <div className="grid grid-rows-[0fr] [@media(hover:hover)_and_(pointer:fine)]:group-hover:grid-rows-[1fr] group-has-[:focus-visible]:grid-rows-[1fr] opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 transition-[grid-template-rows,opacity] duration-base ease-smooth-out">
                                <div className="overflow-hidden">
                                    <div className="mt-2 pt-1.5 border-t border-white/15 space-y-2 pointer-events-auto">
                                        {synopsis && (
                                            <p className="text-xs text-white/85 leading-snug line-clamp-2">
                                                {synopsis}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-2 pt-0.5">
                                            {actions ?? (
                                                centerOverlay ? centerOverlay : (
                                                    <Button
                                                        type="button"
                                                        intent="primary"
                                                        size="xs"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            onClick?.()
                                                        }}
                                                        className="flex-1 gap-1.5 shadow-[shadow:var(--shadow-play-cta)]"
                                                    >
                                                        <IconMediaPlay size={14} fill="currentColor" />
                                                        <span>Ver</span>
                                                    </Button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Texto exterior solo para modo clásico (legacy) si isFullBleed es false */}
            {!isFullBleed && (
                <div className="flex flex-col gap-0.5 px-0.5 pointer-events-none">
                    <p className="text-on-surface font-black text-sm sm:text-[15px] uppercase tracking-wide leading-snug line-clamp-2 group-hover:text-[var(--poster-title-hover)] transition-colors font-display">
                        {title}
                    </p>
                    {bottomMeta && (
                        <div className="text-label-2 text-2xs sm:text-xs font-medium tabular-nums">
                            {bottomMeta}
                        </div>
                    )}
                </div>
            )}
        </m.div>
    )
})
