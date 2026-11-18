import * as React from "react"
import { useRef, useEffect } from "react"


import { DeferredImage } from "@/components/shared/deferred-image"
import { HeroBackdrop, heroLowResSrc, useHeroTone } from "@/components/ui/spotlight/hero-backdrop"
import { heroArtFromUrl, heroObjectPosition, type HeroArt } from "@/lib/config/hero-art"
import { cn } from "@/components/ui/core/styling"
import { useMotionTier } from "@/components/ui/kinetics/hooks"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { useHeroParallax } from "@/hooks/use-hero"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { useIsMinimalistMode } from "@/lib/theme/use-classic-mode"

const MEDIA_HERO_TITLE_CLASS = "hero-title font-display font-extrabold text-2xl sm:text-3xl md:text-4xl lg:text-[2.6rem] tracking-tight text-on-surface text-edge-glow text-balance break-words max-w-3xl leading-[1.08]";

interface MediaHeroProps {
    /** El contenedor principal (`div`) para aplicar parallax al hacer scroll */
    scrollContainerRef?: React.RefObject<HTMLElement | HTMLDivElement | null>

    backdropUrl: string | null
    /** Arte curado (punto focal + composición). Si falta, se encuadra `backdropUrl` por defecto. */
    backdropArt?: HeroArt | null
    posterUrl?: string | null
    /** Clave de elemento compartido de la portada (`series:<id>`): la tarjeta de origen vuela hasta acá. */
    posterShareKey?: string
    hasBannerImage: boolean
    
    /** El título puede ser un string (se formateará por defecto) o un ReactNode (para custom shimmer etc.) */
    title: string | React.ReactNode

    /** Contenido opcional por encima del título (e.g. Era badge) */
    topBadge?: React.ReactNode
    
    /** Contenido opcional intercalado o para Series (metadataRow y topBadge pueden estar en el mismo lugar) */
    metadataRow?: React.ReactNode
    
    synopsis?: string | null

    /** Cast, directores u otros textos al final de la sinopsis */
    footerText?: React.ReactNode

    actionButtons?: React.ReactNode

    /** Muestra el póster a la izquierda en desktop (como en películas) */
    showPosterColumn?: boolean

    /**
     * Ocupa la pantalla completa del viewport (100dvh / min-h-screen).
     * En este modo el arte se extiende hasta el borde inferior sin máscara
     * de corte ni fundido a negro sólido, ideal para fichas de película.
     */
    fullHeight?: boolean

    /**
     * Panel lateral flotante (e.g. SagaSelector) que se renderiza como overlay
     * glassmorphic a la derecha del backdrop en pantallas `lg+`. En mobile se oculta.
     */
    sidePanel?: React.ReactNode
    
    className?: string

    /** Eventos opcionales */
    onBackdropClick?: () => void
    onTitleClick?: () => void
    /** false: sin parallax del arte (p. ej. cuando el contenedor ya se mueve al scrollear). */
    parallax?: boolean
}

/**
 * Backdrop treatment derived from Settings → Apariencia → Página de Detalle →
 * Tipo de Banner. The "-when-unavailable" variants only kick in for media with
 * no real banner art, where the fallback image tends to look poor behind text.
 */
type BackdropTreatment = "show" | "blur" | "dim" | "hide"

export function resolveBackdropTreatment(bannerType: string, hasBannerImage: boolean): BackdropTreatment {
    switch (bannerType) {
        case "blur": return "blur"
        case "dim": return "dim"
        case "hide": return "hide"
        case "blur-when-unavailable": return hasBannerImage ? "show" : "blur"
        case "dim-when-unavailable": return hasBannerImage ? "show" : "dim"
        case "hide-when-unavailable": return hasBannerImage ? "show" : "hide"
        default: return "show"
    }
}

/**
 * Scrim único del hero de detalle (antes: izquierdo + inferior + superior +
 * refuerzo de HeroBackdrop + máscara, apilados → imagen "sucia").
 * Teñido con el color de la zona del texto en vez de negro puro, así la
 * imagen se funde con la página; la base termina exacto en `--bg-primary`.
 * `strong` para arte claro, donde el texto necesita más contraste.
 */
export function heroScrimBackground(textZoneColor: string | null, strong: boolean, fullHeight = false): string {
    const tint = textZoneColor
        ? `color-mix(in srgb, ${textZoneColor} 16%, var(--bg-primary))`
        : "var(--bg-primary)"
    const a = (alpha: number) => `color-mix(in srgb, ${tint} ${Math.round(alpha * 100)}%, transparent)`
    const k = strong ? 1 : 0.85
    return [
        // Superior: legibilidad de la navbar flotante.
        `linear-gradient(to bottom, ${a(0.45)} 0px, transparent 140px)`,
        // Lateral: columna de texto.
        `linear-gradient(to right, ${a(0.92 * k)} 0%, ${a(0.64 * k)} 20%, ${a(0.26 * k)} 38%, transparent 58%)`,
        // Inferior: cuando no es fullHeight, funde a negro puro para dar paso a la siguiente sección.
        // Cuando es fullHeight (pantalla completa), un velo protector suave para no convertir el tercio inferior en un pozo negro.
        fullHeight
            ? `linear-gradient(to top, ${a(0.75)} 0%, ${a(0.35)} 18%, ${a(0.1)} 32%, transparent 48%)`
            : `linear-gradient(to top, var(--bg-primary) 0%, ${a(0.78)} 18%, ${a(0.38)} 36%, ${a(0.1)} 52%, transparent 66%)`,
    ].join(", ")
}

export function MediaHero({
    scrollContainerRef,
    backdropUrl,
    backdropArt,
    posterUrl,
    posterShareKey,
    hasBannerImage,
    title,
    topBadge,
    metadataRow,
    synopsis,
    footerText,
    actionButtons,
    showPosterColumn = false,
    fullHeight = false,
    sidePanel,
    className,
    onBackdropClick,
    onTitleClick,
    parallax = true,
}: MediaHeroProps) {
    const heroRef = useRef<HTMLDivElement>(null)
    const setBackdropUrl = useIntelligenceStore(s => s.setBackdropUrl)
    // Parallax solo en tier full: "off" es movimiento reducido (un transform
    // escrito por JS no lo frena la regla global) y "subtle" es TV / bajo consumo.
    const parallaxEnabled = useMotionTier() === "full" && parallax
    const ts = useThemeSettings()
    const isSmallBanner = ts.themeMediaPageBannerSize === "small"
    const backdropTreatment = resolveBackdropTreatment(ts.themeMediaPageBannerType, hasBannerImage)
    const isBoxedInfo = ts.themeMediaPageBannerInfoBoxSize === "boxed"
    // Fondo Ambiental: capa blur/saturada detrás del backdrop, visible donde
    // la máscara inferior funde la imagen nítida.
    const ambientOn = ts.themeEnableMediaPageBlurredBackground && !!backdropUrl
    const art = React.useMemo(
        () => backdropArt ?? (backdropUrl ? heroArtFromUrl(backdropUrl) : null),
        [backdropArt, backdropUrl]
    )
    const showArt = !!art && backdropTreatment !== "hide"
    const backdropRef = useHeroParallax(0.35, { disabled: !parallaxEnabled || !showArt, scrollContainerRef })
    const tone = useHeroTone(showArt ? art : null)
    const isMinimalist = useIsMinimalistMode()
    const scrim = React.useMemo(
        () => heroScrimBackground(null, tone === "light" || art?.subject !== "right", fullHeight),
        [tone, art?.subject, fullHeight]
    )

    // Sync current backdrop with global DynamicBackdrop blur background
    useEffect(() => {
        if (backdropUrl && ambientOn) {
            setBackdropUrl(backdropUrl)
        } else {
            setBackdropUrl(null)
        }
        return () => {
            setBackdropUrl(null)
        }
    }, [backdropUrl, ambientOn, setBackdropUrl])





    return (
        <section
            ref={heroRef}
            className={cn(
                "relative w-full flex flex-col justify-end overflow-hidden select-none",
                fullHeight
                    ? "min-h-dvh lg:min-h-dvh pb-16 sm:pb-20 md:pb-24 pt-20 md:pt-24 [@media(max-height:780px)]:pt-16 [@media(max-height:780px)]:pb-10 shrink-0"
                    : isSmallBanner
                        ? "min-h-[360px] md:min-h-[420px] pb-12 sm:pb-16 md:pb-20 pt-16 md:pt-24 shrink-0"
                        : "min-h-[70svh] lg:min-h-[80svh] pb-12 sm:pb-16 md:pb-20 pt-16 md:pt-24 shrink-0",
                className
            )}
        >
            {/* ── Base 16:9 blur-fill: rellena sin recorte/zoom ───────────────────
                Visible solo cuando Fondo Ambiental (ambientOn) está activo.
                Si está apagado, se conserva fondo negro puro AMOLED. */}
            {art && backdropTreatment !== "hide" && ambientOn && (
                <div className="absolute inset-0 overflow-hidden bg-black z-hero-base" aria-hidden="true">
                    <div
                        className="absolute -inset-6"
                        style={{
                            backgroundImage: `url(${heroLowResSrc(art) ?? art.src})`,
                            backgroundSize: "cover",
                            backgroundPosition: heroObjectPosition(art),
                            filter: "blur(16px) brightness(0.68) saturate(135%)",
                            transform: "scale(1.08)",
                        }}
                    />
                    {/* Velo para asentar póster/texto sobre el blur */}
                    <div className="absolute inset-0 bg-black/10" />
                </div>
            )}

            {/* ── Sharp full-bleed: cubre el 100% del hero (paridad Movies) ──────
                inset-0 + cover a toda la altura del hero; el fade inferior
                (74%→100%) llega hasta el contenido y funde con el blur-fill
                sin dejar pozo negro. Parallax conservado sobre esta capa.
                En fullHeight, no se corta la imagen inferior para lucir todo el arte. */}
            <div className="absolute inset-0 z-hero-visual overflow-hidden pointer-events-none">
                {art && backdropTreatment !== "hide" && (
                    // Atajo de puntero sobre el arte; por teclado/lector ya está la
                    // PlayCta del hero, así que no se duplica como botón ni tab stop.
                    <div
                        ref={backdropRef}
                        aria-hidden="true"
                        onClick={onBackdropClick}
                        className={cn(
                            "relative w-full h-full overflow-hidden will-change-transform group/backdrop mx-auto",
                            onBackdropClick && "cursor-pointer pointer-events-auto"
                        )}
                        style={{
                            maskImage: (fullHeight || isMinimalist)
                                ? undefined
                                : "linear-gradient(to bottom, black 74%, transparent 100%)",
                            WebkitMaskImage: (fullHeight || isMinimalist)
                                ? undefined
                                : "linear-gradient(to bottom, black 74%, transparent 100%)",
                        }}
                    >
                        <HeroBackdrop
                            art={art}
                            alt=""
                            variant="bleed"
                            scrims={false}
                            imgClassName={cn(
                                // Solo opacity: transition-all animaría también el
                                // filter y mantendría vivo el repaint del fondo,
                                // retrasando el backdrop-filter de la cápsula de
                                // metadatos que está encima.
                                "transition-opacity duration-700",
                                // Nítido y opaco como el hero del Home: cualquier
                                // opacity < 1 deja ver el LQIP 64px y el blur-fill
                                // debajo (efecto fantasma), y el blur ablanda el arte.
                                backdropTreatment === "dim" && "opacity-40",
                                backdropTreatment === "blur"
                                    ? "blur-[var(--filter-blur-hero)]"
                                    : "hero-image-filter"
                            )}
                        />
                        {/* Velo ligero sin blur para no lavar la portada */}
                    </div>
                )}
            </div>

            {/* Scrim cinematográfico único, teñido con la paleta del arte */}
            <div
                aria-hidden="true"
                className="absolute inset-0 z-hero-scrim pointer-events-none"
                style={{ background: scrim }}
            />

            {/* Side Panel Overlay — visible solo en desktop (lg+) */}
            {sidePanel && (
                <div className="hidden lg:flex absolute right-0 top-0 bottom-0 z-hero-controls w-72 xl:w-80 pointer-events-auto">
                    {/* Gradiente de fusión lateral: difumina el panel hacia el backdrop */}
                    <div className="absolute inset-y-0 -left-16 w-16 bg-gradient-to-r from-transparent to-black/60 pointer-events-none z-10" />
                    <div className="flex-1 bg-[var(--surface-content)] border-l border-[var(--surface-content-border)] overflow-hidden flex flex-col">
                        {sidePanel}
                    </div>
                </div>
            )}

            {/* Content Container: Platter D compacta en la esquina inferior izquierda */}
            <div className={cn(
                "relative z-hero-content w-full max-w-content mx-auto px-4 sm:px-6 md:px-8 lg:px-10 flex",
                showPosterColumn ? "flex-col sm:flex-row items-start sm:items-end gap-6 md:gap-8" : "flex-col items-start justify-end pointer-events-none"
            )}>
                {showPosterColumn && posterUrl && (
                    <div data-shared-poster={posterShareKey} className="animate-slide-up [animation-duration:var(--duration-base)] delay-50 w-24 sm:w-32 md:w-36 lg:w-44 shrink-0 aspect-[2/3] rounded-container overflow-hidden border border-border-subtle bg-surface-container shadow-elevation-5 pointer-events-auto">
                        <DeferredImage
                            src={posterUrl}
                            alt={typeof title === "string" ? `Póster de ${title}` : "Póster"}
                            className="w-full h-full block"
                            imgClassName="!w-full !h-full !object-cover"
                        />
                    </div>
                )}

                <div className={cn(
                    "flex flex-col gap-3.5 sm:gap-4 pointer-events-auto text-left",
                    showPosterColumn ? "flex-1 w-full" : "w-full sm:w-[65%] sm:max-w-2xl",
                    isBoxedInfo && "surface-content rounded-container p-6 md:p-8"
                )}>
                    {topBadge && (
                        // fade-only (sin transform): animar translateY en el
                        // ancestro directo de un backdrop-filter obliga a
                        // re-rasterizar el blur en cada frame y "llega tarde".
                        <div className="animate-fade-in delay-50 pointer-events-auto">
                            {topBadge}
                        </div>
                    )}

                    <div className="animate-slide-up [animation-duration:var(--duration-base)] delay-50 space-y-1 pointer-events-auto flex items-start justify-start flex-col">
                        {typeof title === "string" ? (
                            onTitleClick ? (
                                <button
                                    type="button"
                                    onClick={onTitleClick}
                                    className="text-left p-0 border-0 bg-transparent cursor-pointer group/title motion-safe:active:scale-[0.99] transition-transform duration-fast ease-out-strong"
                                >
                                    <h1 
                                        className={cn(
                                            isMinimalist
                                                ? "hero-title font-extrabold text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-tight text-white leading-[1.05] text-balance break-words max-w-3xl [text-shadow:0_2px_16px_rgba(0,0,0,0.95),0_1px_4px_rgba(0,0,0,0.9)]"
                                                : `${MEDIA_HERO_TITLE_CLASS} group-hover/title:text-brand-secondary transition-colors duration-slow`
                                        )}
                                    >
                                        {title}
                                    </h1>
                                </button>
                            ) : (
                                <h1 
                                    className={cn(
                                        isMinimalist
                                            ? "hero-title font-extrabold text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-tight text-white leading-[1.05] text-balance break-words max-w-3xl [text-shadow:0_2px_16px_rgba(0,0,0,0.95),0_1px_4px_rgba(0,0,0,0.9)]"
                                            : MEDIA_HERO_TITLE_CLASS
                                    )}
                                >
                                    {title}
                                </h1>
                            )
                        ) : title}
                    </div>

                    {metadataRow && (
                        <div className="animate-fade-in delay-50 pointer-events-auto">
                            {metadataRow}
                        </div>
                    )}

                    {synopsis && (
                        <p className={cn(
                            "animate-slide-up [animation-duration:var(--duration-base)] delay-100 text-xs leading-relaxed line-clamp-3 pointer-events-auto text-pretty",
                            isMinimalist
                                ? "text-on-surface/90 sm:text-[14.5px] [text-shadow:0_1px_8px_rgba(0,0,0,0.95)] max-w-[48ch]"
                                : "text-on-surface/90 sm:text-sm text-edge-glow font-normal max-w-[54ch]"
                        )}>
                            {synopsis}
                        </p>
                    )}

                    {footerText && (
                        <p className="animate-slide-up [animation-duration:var(--duration-base)] delay-150 text-on-surface/85 text-xs font-semibold tracking-wide drop-shadow-sm pointer-events-auto">
                            {footerText}
                        </p>
                    )}

                    {actionButtons && (
                        <div className="animate-slide-up [animation-duration:var(--duration-base)] delay-200 flex flex-wrap items-center gap-3 pt-1 pointer-events-auto">
                            {actionButtons}
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
