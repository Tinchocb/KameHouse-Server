import * as React from "react"
import { m } from "framer-motion"
import { IconMediaPlay } from "@/components/ui/icons"
import { getMediumResImage, localImage } from "@/lib/helpers/images"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import type { ERA_COLOR_MAP, EraId } from "@/lib/config/eras"
import { moviePosterCardItemVariants } from "@/components/ui/movie-poster-card"
import { DeferredImage } from "@/components/shared/deferred-image"
import { cn } from "@/components/ui/core/styling"
import { usePosterPalette } from "@/hooks/use-image-palette"
import { useIsClassicMode } from "@/lib/theme/use-classic-mode"

// Re-export para compatibilidad de variantes de stagger
export const spotlightCardItemVariants = moviePosterCardItemVariants

interface SpotlightMovieCardProps {
    movie: SwimlaneItem
    index?: number
    colors: typeof ERA_COLOR_MAP[EraId]
    isActive?: boolean
    /**
     * Modo Ficha Lateral Amplia permanente (para grillas de 2 o 3 columnas como DB Clásico 3x2 o Super 2x1).
     * Muestra el póster 2:3 a la izquierda y el drawer con sinopsis y botón a la derecha.
     */
    isWideDrawer?: boolean
    /** Prioriza la descarga y decodificación cuando es visible al entrar en pantalla. */
    priority?: boolean
    onNavigate: (item: SwimlaneItem) => void
    onHover: () => void
    style?: React.CSSProperties
    className?: string
}

/**
 * SpotlightMovieCard — Tarjeta de Película con Side-Drawer Expansivo / Fijo (Edición 2026).
 *
 * Adaptable según la serie:
 * - Modo Ficha Amplia (`isWideDrawer`): póster 2:3 a la izquierda + drawer lateral siempre visible (ideal para DB 3x2 o Super).
 * - Modo Fila Expansiva (`isActive`): se expande al pasar el cursor o seleccionar.
 * - Modo Póster Compacto: para colecciones grandes (DBZ 15 películas) en grilla fluida.
 * - Cero puntuaciones, portadas nítidas 2:3 (`w342` en `getMediumResImage`, compartida con el precalentamiento) y cero sobrante.
 */
export const SpotlightMovieCard = React.memo(function SpotlightMovieCard({
    movie,
    index,
    colors,
    isActive = false,
    isWideDrawer = false,
    priority = false,
    onNavigate,
    onHover,
    style,
    className,
}: SpotlightMovieCardProps) {
    const posterSrc = movie.image
        ? (movie.image.startsWith("/") ? movie.image : localImage(getMediumResImage(movie.image)))
        : (movie.backdropUrl ? (movie.backdropUrl.startsWith("/") ? movie.backdropUrl : localImage(getMediumResImage(movie.backdropUrl))) : "")

    const isClassic = useIsClassicMode()
    // En Classic/Minimalist el CSS neutraliza el drawer: evita decodificar canvases innecesarios.
    // Paleta cromática extraída de la portada real de la película (con fallback armónico a la era)
    const palette = usePosterPalette(isClassic ? null : (posterSrc || movie.image), colors)

    const isSpecial = movie.badge === "SPECIAL" || movie.badge === "OVA" || movie.title.toLowerCase().includes("especial") || movie.title.toLowerCase().includes("ova")
    const typeLabel = isSpecial ? (movie.badge === "OVA" ? "OVA" : "Especial") : "Película"
    const indexLabel = index !== undefined ? `#${String(index).padStart(2, "0")}` : undefined
    const cleanTitle = movie.title.replace(/\s*\((?:Original|TV|\d{4})\)\s*/gi, "").trim()
    const runtimeLabel = movie.runtime && movie.runtime > 0 ? `${movie.runtime} min` : undefined

    // Subtítulo limpio: elimina apariciones redundantes de "MOVIE" o "Película" (ej. "1986 · MOVIE" -> "1986 · 50 min")
    const cleanSubtitle = React.useMemo(() => {
        const raw = movie.subtitle || (movie.year ? `${movie.year}` : "")
        const cleaned = raw
            .replace(/\b(movie|película|pelicula)\b/gi, "")
            .replace(/^·\s*|\s*·$/g, "")
            .replace(/\s*·\s*·\s*/g, " · ")
            .trim()
        const base = cleaned || (movie.year ? `${movie.year}` : "LAT / JPN")
        if (runtimeLabel && !base.includes("min")) {
            return `${base} · ${runtimeLabel}`
        }
        return base
    }, [movie.subtitle, movie.year, runtimeLabel])

    const restBorder = isClassic ? "var(--neutral-separator)" : `color-mix(in srgb, ${colors.glowStrong} 28%, rgba(255,255,255,0.12))`

    const showDrawerAlways = isWideDrawer

    return (
        <m.article
            variants={spotlightCardItemVariants}
            custom={index ?? 0}
            onMouseEnter={onHover}
            style={style}
            className={cn("movie-slot group relative flex flex-col gap-2.5 cursor-pointer select-none rounded-2xl transition-transform duration-fast ease-out-strong motion-safe:active:scale-[0.97]", className)}
            data-liquid-surface="content"
        >
            {/* Destino de teclado y lectores de pantalla (overlay canónico) */}
            <button
                type="button"
                aria-label={`Ver ${movie.title}`}
                onClick={() => onNavigate(movie)}
                onFocus={onHover}
                className="absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent cursor-pointer"
            />
            {/* Contenedor Superior: Altura fija calibrada para póster 2:3 */}
            <div
                className={cn(
                    "movie-box relative rounded-2xl bg-surface-container-lowest border overflow-hidden flex transition-[border-color,box-shadow] duration-300",
                    showDrawerAlways
                        ? "h-[225px] sm:h-[240px] [@media(hover:hover)_and_(pointer:fine)]:hover:border-[var(--movie-hover-border,transparent)] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[shadow:var(--movie-hover-shadow,none)] group-focus-visible:border-[var(--movie-hover-border,transparent)] group-focus-visible:shadow-[shadow:var(--movie-hover-shadow,none)] group-has-[:focus-visible]:border-[var(--movie-hover-border,transparent)] group-has-[:focus-visible]:shadow-[shadow:var(--movie-hover-shadow,none)]"
                        : "h-[250px] sm:h-[265px]",
                    !showDrawerAlways && (isActive
                        ? "border-[var(--movie-hover-border,transparent)] shadow-[shadow:var(--movie-hover-shadow,none)]"
                        : "[@media(hover:hover)_and_(pointer:fine)]:group-hover:border-[var(--movie-hover-border,transparent)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:shadow-[shadow:var(--movie-hover-shadow,none)] group-focus-visible:border-[var(--movie-hover-border,transparent)] group-focus-visible:shadow-[shadow:var(--movie-hover-shadow,none)] group-has-[:focus-visible]:border-[var(--movie-hover-border,transparent)] group-has-[:focus-visible]:shadow-[shadow:var(--movie-hover-shadow,none)]")
                )}
                style={{
                    borderColor: (!showDrawerAlways && isActive)
                        ? (isClassic ? "var(--neutral-separator)" : palette.hoverBorder)
                        : restBorder,
                    ["--movie-hover-border" as string]: isClassic ? "var(--neutral-separator)" : palette.hoverBorder,
                    ["--movie-hover-shadow" as string]: isClassic ? "var(--double-bezel-shadow)" : palette.hoverShadow,
                }}
            >
                {/* Póster de Alta Resolución */}
                <div
                    className={cn(
                        "relative h-full shrink-0 overflow-hidden bg-surface-container-lowest transition-[width] duration-300 ease-smooth-out",
                        showDrawerAlways
                            ? "w-[150px] sm:w-[160px]"
                            : (isActive ? "w-[170px] sm:w-[176px]" : "w-full [@media(hover:hover)_and_(pointer:fine)]:group-hover:w-[170px] sm:[@media(hover:hover)_and_(pointer:fine)]:group-hover:w-[176px] group-focus-visible:w-[170px] sm:group-focus-visible:w-[170px] group-has-[:focus-visible]:w-[170px] sm:group-has-[:focus-visible]:w-[176px]")
                    )}
                >
                    <DeferredImage
                        src={posterSrc}
                        alt={movie.title}
                        priority={priority}
                        sizes="160px"
                        className="movie-poster-img w-full h-full object-cover [filter:saturate(1.1)_contrast(1.04)] transition-transform duration-500 motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 motion-safe:group-focus-visible:scale-105 motion-safe:group-has-[:focus-visible]:scale-105"
                    />
                    {movie.watched && (
                        <div className="absolute bottom-0 inset-x-0 h-[3px] bg-black/55 z-20 pointer-events-none overflow-hidden">
                            <div
                                className="watch-progress-fill h-full w-full origin-left"
                                style={{ backgroundColor: isClassic ? "var(--selected-bg)" : colors.accent }}
                            />
                        </div>
                    )}
                </div>

                {/* Side-Drawer Lateral de la Película a la derecha (al expandirse adopta la paleta de la portada) */}
                <div
                    className={cn(
                        "drawer-panel flex-1 flex flex-col justify-between overflow-hidden border-l transition-[opacity,padding] duration-250 ease-out min-w-0",
                        showDrawerAlways
                            ? "opacity-100 pointer-events-auto p-3.5 sm:p-4"
                            : (isActive
                                ? "opacity-100 pointer-events-auto p-3.5 sm:p-4"
                                : "opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-focus-visible:opacity-100 group-has-[:focus-visible]:opacity-100 pointer-events-none [@media(hover:hover)_and_(pointer:fine)]:group-hover:pointer-events-auto group-focus-visible:pointer-events-auto group-has-[:focus-visible]:pointer-events-auto p-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:p-3.5 sm:[@media(hover:hover)_and_(pointer:fine)]:group-hover:p-4 group-focus-visible:p-3.5 sm:group-focus-visible:p-4 group-has-[:focus-visible]:p-3.5 sm:group-has-[:focus-visible]:p-4")
                    )}
                    style={{
                        ["--drawer-bg" as string]: isClassic ? "var(--neutral-elev-2)" : palette.drawerBackground,
                        background: isClassic ? "var(--neutral-elev-2)" : palette.drawerBackground,
                        borderLeftColor: isClassic ? "var(--neutral-separator)" : palette.drawerBorder,
                    }}
                >
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1.5">
                            {cleanSubtitle && (
                                <span
                                    className="movie-drawer-pill px-2 py-0.5 rounded text-xs font-mono font-bold tabular-nums border transition-colors tracking-wide"
                                    style={{
                                        backgroundColor: isClassic ? "var(--neutral-elev-3)" : palette.pillBackground,
                                        color: isClassic ? "var(--label-1)" : palette.pillText,
                                        borderColor: isClassic ? "var(--neutral-separator)" : palette.pillBorder,
                                        borderWidth: "1px",
                                        borderStyle: "solid",
                                    }}
                                >
                                    {cleanSubtitle}
                                </span>
                            )}
                            {isSpecial && (
                                <span
                                    className="text-xs font-mono font-bold tracking-wide uppercase text-amber-300"
                                >
                                    {typeLabel}
                                </span>
                            )}
                        </div>

                        <h4 className="card-title text-sm font-extrabold text-on-surface leading-snug line-clamp-2 text-balance">
                            {cleanTitle}
                        </h4>

                        {movie.description && (
                            <p className="movie-drawer-synopsis text-xs text-on-surface-variant line-clamp-3 leading-relaxed">
                                {movie.description}
                            </p>
                        )}
                    </div>

                    <div
                        className="movie-drawer-footer pt-2 border-t flex items-center justify-between pointer-events-none"
                        style={{
                            borderColor: `color-mix(in srgb, ${palette.accent} 22%, rgba(255,255,255,0.08))`,
                        }}
                    >
                        {/* Indicador visual no interactivo: el <article role="button"> externo es la única acción del bloque */}
                        <span
                            aria-hidden="true"
                            className="movie-card-cta relative h-8 px-3.5 rounded-full bg-white text-black font-extrabold text-xs tracking-tight shadow-[shadow:var(--shadow-play-cta)] motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 transition-[transform,background-color] duration-quick ease-out-strong inline-flex flex-row flex-nowrap items-center justify-center gap-1.5 ring-1 ring-white/70 select-none whitespace-nowrap shrink-0"
                        >
                            <IconMediaPlay size={13} fill="currentColor" className="ml-0.5 text-black shrink-0" />
                            <span className="font-bold text-xs tracking-tight text-black leading-none select-none">Reproducir</span>
                        </span>
                        {indexLabel && (
                            <span className="text-xs font-mono text-label-2 font-bold tabular-nums">
                                {indexLabel}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Pie de Tarjeta visible debajo SOLO en modo póster compacto sin drawer permanente */}
            {!showDrawerAlways && (
                <div className="px-0.5 space-y-0.5">
                    <h3
                        className={cn(
                            "footer-title text-xs sm:text-[13px] font-bold transition-colors truncate",
                            isActive ? "text-[var(--footer-title-active,var(--brand-accent))]" : "text-on-surface [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-[var(--footer-title-active,var(--brand-accent))] group-focus-visible:text-[var(--footer-title-active,var(--brand-accent))] group-has-[:focus-visible]:text-[var(--footer-title-active,var(--brand-accent))]"
                        )}
                        style={{
                            ["--footer-title-active" as string]: palette.titleHover,
                            color: isActive ? palette.titleHover : undefined,
                        }}
                        title={movie.title}
                    >
                        {cleanTitle}
                    </h3>
                    <p className="text-xs font-mono text-label-2 tabular-nums">
                        {movie.year && <span>{movie.year}</span>}
                        {movie.year && runtimeLabel && <span className="text-label-3"> · </span>}
                        {runtimeLabel && <span>{runtimeLabel}</span>}
                        {(movie.year || runtimeLabel) && typeLabel && <span className="text-label-3"> · </span>}
                        <span className={isSpecial ? "text-amber-300 font-semibold" : "text-on-surface-variant"}>
                            {typeLabel}
                        </span>
                    </p>
                </div>
            )}
        </m.article>
    )
})
