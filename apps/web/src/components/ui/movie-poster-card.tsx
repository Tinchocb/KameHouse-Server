import * as React from "react"
import { m, type Variants } from "framer-motion"
import { IconMediaPlay } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import { Button } from "@/components/ui/button"
import { gridItemVariants, useMotionTier, cardMotionProps } from "@/components/ui/kinetics"
import { useMediaQuery } from "@/hooks/use-media-query"
import { usePosterPalette } from "@/hooks/use-image-palette"
import { ERA_COLOR_MAP } from "@/lib/config/eras"
import { useIsClassicMode, useIsMinimalistMode } from "@/lib/theme/use-classic-mode"

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
    /** Contenido apilado arriba-izquierda (score, #01, canon...). */
    topLeft?: React.ReactNode
    /** Contenido apilado arriba-derecha (año, visto, menú...). Los elementos interactivos deben llevar `pointer-events-auto`. */
    topRight?: React.ReactNode
    /** Overlay central en hover (play, añadir a cola...). El contenedor es pointer-events-none. */
    centerOverlay?: React.ReactNode
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
    /** Atajo de teclado documentado para el botón principal de la tarjeta (ej. "q"). */
    ariaKeyShortcuts?: string
    className?: string
    // Nuevas propiedades Fusión A + B (Full-Bleed 2:3 + Drawer técnico)
    year?: string | number
    runtime?: string | number
    typeLabel?: string
    score?: string | number
    synopsis?: string
    eraColor?: string
    isNew?: boolean
    isSpecial?: boolean
    indexLabel?: string
    actions?: React.ReactNode
    isWideDrawer?: boolean
    /** Prioriza descarga y decodificación cuando la tarjeta es visible al entrar. */
    priority?: boolean
    fetchPriority?: "high" | "low" | "auto"
    sizes?: string
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
    topLeft,
    topRight,
    centerOverlay,
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
    ariaKeyShortcuts,
    className,
    year,
    runtime,
    typeLabel,
    score,
    synopsis,
    eraColor,
    isNew,
    isSpecial,
    indexLabel,
    actions,
    isWideDrawer = false,
    priority = false,
    fetchPriority,
    sizes = "160px",
}: MoviePosterCardProps) {
    const hasProgress = progressPercent != null && progressPercent > 0 && progressPercent < 100
    const activeTier = useMotionTier()
    const canHover = useMediaQuery("(hover: hover) and (pointer: fine)")
    const isMinimalist = useIsMinimalistMode()
    const motionProps = cardMotionProps(activeTier, canHover, { isMinimalist })

    const isFullTier = activeTier === "full"
    const isSubtleTier = activeTier === "subtle"
    const isClassic = useIsClassicMode()

    // Paleta cromática extraída de la portada real (con fallback a la era)
    const fallbackColors = React.useMemo(() => {
        if (isClassic) {
            return {
                glowStrong: "transparent",
                glowMedium: "transparent",
                accent: "var(--label-1)",
                border: "var(--neutral-separator)",
                borderSubtle: "var(--neutral-separator)",
                text: "#ffffff",
                badgeBorder: "var(--neutral-separator)",
                badgeBg: "var(--neutral-elev-2)",
                badgeText: "var(--label-1)",
                titleGlow: "transparent",
            }
        }
        if (eraColor) {
            return {
                glowStrong: eraColor,
                glowMedium: eraColor,
                accent: eraColor,
                border: eraColor,
                borderSubtle: eraColor,
                text: "#ffffff",
                badgeBorder: eraColor,
                badgeBg: "rgba(0,0,0,0.5)",
                badgeText: eraColor,
                titleGlow: eraColor,
            }
        }
        return ERA_COLOR_MAP.dbz
    }, [isClassic, eraColor])
    // En Classic/Minimalist el CSS del tema sobreescribe los colores del drawer.
    const palette = usePosterPalette((isWideDrawer && !isClassic) ? image : null, fallbackColors)

    // Subtítulo limpio: elimina apariciones redundantes de "MOVIE" o "Película"
    const cleanPillText = React.useMemo(() => {
        const raw = year ? `${year}${runtime ? ` · ${runtime}` : ""}` : (runtime ? `${runtime}` : "")
        return raw
            .replace(/\b(movie|película|pelicula)\b/gi, "")
            .replace(/^·\s*|\s*·$/g, "")
            .replace(/\s*·\s*·\s*/g, " · ")
            .trim()
    }, [year, runtime])

    return (
        <m.div
            variants={moviePosterCardItemVariants}
            custom={index ?? 0}
            initial={initial}
            animate={activeTier === "off"
                ? { opacity: 1, y: 0, scale: 1, transition: { duration: 0 } }
                : initial !== undefined ? "visible" : undefined}
            whileHover={motionProps.whileHover}
            whileTap={motionProps.whileTap}
            transition={motionProps.transition}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            className={cn(
                "movie-poster-card group relative w-full h-full flex flex-col cursor-pointer select-none shrink-0 outline-none",
                className,
            )}
            style={{
                "--poster-title-hover": titleHoverColor ?? (isClassic ? "var(--label-1)" : (eraColor || "var(--brand-accent)")),
                "--poster-era-accent": eraColor ?? (isClassic ? "var(--label-2)" : "var(--brand-accent)"),
                "--poster-border-rest": borderColor ?? (isClassic ? "var(--neutral-separator)" : "var(--glass-border-side)"),
                "--poster-border-hover": isClassic ? "var(--neutral-separator)" : (eraColor || "rgba(255, 255, 255, 0.4)"),
                "--poster-shadow-hover": isClassic ? "var(--double-bezel-shadow)" : "var(--shadow-poster-hover)",
            } as React.CSSProperties}
        >
            {/* Destino de teclado y lectores de pantalla */}
            {onClick && (
                <button
                    type="button"
                    aria-label={title}
                    aria-keyshortcuts={ariaKeyShortcuts}
                    className="absolute inset-0 rounded-2xl outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-accent"
                />
            )}

            {isWideDrawer ? (
                /* Ficha Lateral Amplia: póster 2:3 a la izquierda + drawer permanente a la derecha */
                <div
                    data-shared-poster={sharedKey}
                    data-liquid-surface="content"
                    className={cn(
                        "movie-box relative w-full h-[225px] sm:h-[240px] rounded-2xl overflow-hidden border bg-surface-container-lowest flex transition-[transform,border-color,box-shadow] duration-300",
                        "[@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--movie-hover-border,transparent)] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[shadow:var(--movie-hover-shadow,none)] group-has-[:focus-visible]:border-[var(--movie-hover-border,transparent)] group-has-[:focus-visible]:shadow-[shadow:var(--movie-hover-shadow,none)]"
                    )}
                    style={{
                        borderColor: palette.hoverBorder ? `color-mix(in srgb, ${palette.accent} 28%, rgba(255,255,255,0.12))` : (borderColor ?? "var(--glass-border-side)"),
                        ["--movie-hover-border" as string]: palette.hoverBorder,
                        ["--movie-hover-shadow" as string]: palette.hoverShadow,
                    }}
                >
                    {/* Póster a la izquierda */}
                    <div className="relative w-[145px] sm:w-[160px] h-full shrink-0 overflow-hidden bg-zinc-950">
                        <DeferredImage
                            src={image}
                            alt={title}
                            priority={priority}
                            fetchPriority={fetchPriority}
                            sizes={sizes}
                            className={cn(
                                "w-full h-full object-cover [filter:saturate(1.1)_contrast(1.04)] transition-transform duration-500 motion-safe:group-hover:scale-105",
                                dimmed && "opacity-50"
                            )}
                            showSkeleton={showSkeleton}
                            fallback={imageFallback}
                        />
                        {/* Shimmer sweep en hover */}
                        <div
                            aria-hidden
                            className="shimmer-sweep absolute inset-0 -translate-x-full motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-full transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover:transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/10 to-transparent z-10 pointer-events-none"
                        />
                        {hasProgress && (
                            <div className="absolute bottom-0 inset-x-0 h-[3px] bg-black/55 z-20 pointer-events-none overflow-hidden">
                                <div
                                    className="card-progress-fill h-full w-full origin-left transition-transform duration-base ease-smooth-out"
                                    style={{
                                        transform: `scaleX(${progressPercent / 100})`,
                                        backgroundColor: progressColor ?? (isClassic ? "var(--selected-bg)" : eraColor),
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Side Drawer a la derecha */}
                    <div
                        className="drawer-panel flex-1 flex flex-col justify-between p-3.5 sm:p-4 min-w-0 border-l"
                        style={{
                            ["--drawer-bg" as string]: palette.drawerBackground,
                            background: palette.drawerBackground,
                            borderLeftColor: palette.drawerBorder,
                        }}
                    >
                        <div className="space-y-2">
                            {/* Fila superior: metadata pill a la izquierda, badges/opciones a la derecha */}
                            <div className="flex items-center justify-between gap-1.5 pointer-events-auto">
                                {cleanPillText ? (
                                    <span
                                        className="movie-drawer-pill px-2 py-0.5 rounded text-xs font-mono font-bold border transition-colors tracking-wide"
                                        style={{
                                            backgroundColor: palette.pillBackground,
                                            color: palette.pillText,
                                            borderColor: palette.pillBorder,
                                            borderWidth: "1px",
                                            borderStyle: "solid",
                                        }}
                                    >
                                        {cleanPillText}
                                    </span>
                                ) : <div />}
                                <div className="flex items-center gap-1.5">
                                    {isSpecial && (
                                        <span className="text-xs font-mono font-bold tracking-wide uppercase text-amber-300">
                                            {typeLabel ?? "Especial"}
                                        </span>
                                    )}
                                    {topRight}
                                </div>
                            </div>

                            {/* Título */}
                            <h4 className="text-sm font-extrabold text-on-surface [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-[var(--poster-title-hover)] transition-colors leading-snug line-clamp-2 text-balance">
                                {title}
                            </h4>

                            {/* Sinopsis */}
                            {synopsis && (
                                <p className="movie-drawer-synopsis text-xs text-on-surface-variant line-clamp-3 leading-relaxed">
                                    {synopsis}
                                </p>
                            )}
                        </div>

                        {/* Fila inferior: acciones a la izquierda, index/score a la derecha */}
                        <div
                            className="movie-drawer-footer pt-2 border-t flex items-center justify-between pointer-events-auto"
                            style={{
                                borderColor: `color-mix(in srgb, ${palette.accent} 22%, rgba(255,255,255,0.08))`,
                            }}
                        >
                            <div className="flex items-center gap-2">
                                {actions ?? (
                                    centerOverlay ? centerOverlay : (
                                        <span
                                            aria-hidden="true"
                                            className="movie-card-cta relative h-8 px-3.5 rounded-full bg-white text-black font-extrabold text-xs tracking-tight shadow-[shadow:var(--shadow-play-cta)] motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 transition-[transform,background-color] duration-quick ease-out-strong inline-flex flex-row flex-nowrap items-center justify-center gap-1.5 ring-1 ring-white/70 select-none whitespace-nowrap shrink-0"
                                        >
                                            <IconMediaPlay size={13} fill="currentColor" className="ml-0.5 text-black shrink-0" />
                                            <span className="font-bold text-xs tracking-tight text-black leading-none select-none">Reproducir</span>
                                        </span>
                                    )
                                )}
                            </div>
                            {indexLabel && (
                                <span className="text-xs font-mono text-zinc-400 font-bold">
                                    {indexLabel}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* Contenedor del póster: aspect-[2/3] o flexible en acordeón */
                <div
                    data-shared-poster={sharedKey}
                    data-liquid-surface="content"
                    className={cn(
                    "relative w-full aspect-[2/3] rounded-2xl overflow-hidden border bg-[var(--md-sys-color-surface-container)] transform-gpu",
                    "border-[var(--poster-border-rest)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-[var(--poster-border-hover)] group-has-[:focus-visible]:border-[var(--poster-border-hover)]",
                    isFullTier
                        ? "transition-[border-color,box-shadow] duration-base ease-smooth-out"
                        : isSubtleTier
                        ? "transition-[transform,border-color] duration-base ease-smooth-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-y-1 motion-safe:active:scale-[0.97]"
                        : "transition-[border-color,box-shadow] duration-base ease-smooth-out",
                    "[@media(hover:hover)_and_(pointer:fine)]:group-hover:shadow-[shadow:var(--poster-shadow-hover)] group-has-[:focus-visible]:ring-2 group-has-[:focus-visible]:ring-brand-accent",
                )}
            >
                <DeferredImage
                    src={image}
                    alt={title}
                    priority={priority}
                    fetchPriority={fetchPriority}
                    sizes={sizes}
                    className={cn(
                        "absolute inset-0 h-full w-full object-cover [filter:saturate(1.14)_contrast(1.05)] transition-[transform,opacity] duration-slow ease-smooth-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.04]",
                        dimmed && "opacity-50",
                    )}
                    showSkeleton={showSkeleton}
                    fallback={imageFallback}
                />

                {/* Brillo sutil en hover (shine sweep) */}
                <div
                    aria-hidden
                    className="shimmer-sweep absolute inset-0 -translate-x-full motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-full transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover:transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/10 to-transparent z-10 pointer-events-none"
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
                            <span
                                className="rounded-md bg-black/80 border border-white/20 px-2 py-0.5 text-xs font-mono font-bold shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)] transition-colors"
                                style={{
                                    color: "color-mix(in srgb, var(--poster-era-accent) 85%, white)",
                                    borderColor: "color-mix(in srgb, var(--poster-era-accent) 45%, rgba(255,255,255,0.2))",
                                }}
                            >
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
                <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none h-[52%] bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
                <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/[0.82] to-black/20 opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 transition-opacity duration-base ease-smooth-out z-10 pointer-events-none"
                />

                {/* Aura ambiental de la saga/era en hover al fondo del póster */}
                <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-3/5 opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 transition-opacity duration-base ease-smooth-out pointer-events-none z-10"
                    style={{
                        background: "radial-gradient(ellipse at bottom, color-mix(in srgb, var(--poster-era-accent) 35%, transparent) 0%, transparent 75%)",
                    }}
                />

                {/* Barra de progreso inferior */}
                {hasProgress && (
                    <div className="absolute bottom-0 inset-x-0 h-[3px] bg-black/55 z-20 pointer-events-none overflow-hidden">
                        <div
                            className="card-progress-fill h-full w-full origin-left transition-transform duration-base ease-smooth-out"
                            style={{
                                transform: `scaleX(${progressPercent / 100})`,
                                backgroundColor: progressColor ?? (isClassic ? "var(--selected-bg)" : eraColor),
                            }}
                        />
                    </div>
                )}

                {/* FUSIÓN A + B: Contenido integrado Full-Bleed + Drawer técnico en hover */}
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-3.5 z-20 flex flex-col justify-end pointer-events-none">
                        {/* Meta fila: punto de era, año, tipo y duración en verde */}
                        <div className="card-metadata flex items-center gap-1.5 text-xs font-mono text-white/80 tabular-nums">
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
                                    {(year || typeLabel) && <span className="card-runtime hidden [@media(hover:hover)_and_(pointer:fine)]:group-hover:inline text-white/40">·</span>}
                                    <span className="card-runtime hidden [@media(hover:hover)_and_(pointer:fine)]:group-hover:inline text-emerald-400 font-bold tabular-nums">
                                        {runtime}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Título en la base del póster */}
                        <p className="card-title text-on-surface font-black text-xs sm:text-sm uppercase tracking-wide leading-snug line-clamp-2 text-edge-glow mt-0.5 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-[var(--poster-title-hover)] transition-colors font-display text-balance">
                            {title}
                        </p>

                        {/* Drawer técnico desplegable en hover (Sinopsis + Acciones) */}
                        {(synopsis || actions || centerOverlay) && (
                            <div className="card-detail-drawer grid grid-rows-[0fr] [@media(hover:hover)_and_(pointer:fine)]:group-hover:grid-rows-[1fr] group-has-[:focus-visible]:grid-rows-[1fr] opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 transition-[grid-template-rows,opacity] duration-base ease-smooth-out">
                                <div className="overflow-hidden">
                                    <div className="mt-2 pt-1.5 border-t border-white/15 space-y-2 pb-1 pointer-events-auto">
                                        {synopsis && (
                                            <p className="card-hover-synopsis text-xs text-white/85 leading-snug line-clamp-2">
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
            </div>
            )}
        </m.div>
    )
})
