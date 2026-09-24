import * as React from "react"
import { useRef, useEffect } from "react"


import { DeferredImage } from "@/components/shared/deferred-image"
import { HeroBackdrop, heroHighResSrc, heroLowResSrc, useHeroTone } from "@/components/ui/spotlight/hero-backdrop"
import { heroArtFromUrl, heroObjectPosition, type HeroArt } from "@/lib/config/hero-art"
import { cn } from "@/components/ui/core/styling"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { useImagePalette } from "@/hooks/use-image-palette"
import { useThemeSettings } from "@/lib/theme/theme-hooks"

const MEDIA_HERO_TITLE_CLASS = "font-sans font-extrabold leading-[1.08] tracking-tight text-on-surface text-edge-glow uppercase text-balance break-words max-w-5xl";

export interface MediaHeroProps {
    /** El contenedor principal (`div`) para aplicar parallax al hacer scroll */
    scrollContainerRef?: React.RefObject<HTMLElement | HTMLDivElement | null>

    backdropUrl: string | null
    /** Arte curado (punto focal + composición). Si falta, se encuadra `backdropUrl` por defecto. */
    backdropArt?: HeroArt | null
    posterUrl?: string | null
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
     * Panel lateral flotante (e.g. SagaSelector) que se renderiza como overlay
     * glassmorphic a la derecha del backdrop en pantallas `lg+`. En mobile se oculta.
     */
    sidePanel?: React.ReactNode
    
    className?: string

    /** Eventos opcionales */
    onBackdropClick?: () => void
    onTitleClick?: () => void
}

/**
 * Backdrop treatment derived from Settings → Apariencia → Página de Detalle →
 * Tipo de Banner. The "-when-unavailable" variants only kick in for media with
 * no real banner art, where the fallback image tends to look poor behind text.
 */
export type BackdropTreatment = "show" | "blur" | "dim" | "hide"

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
export function heroScrimBackground(textZoneColor: string | null, strong: boolean): string {
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
        // Inferior: funde con la página.
        `linear-gradient(to top, var(--bg-primary) 0%, ${a(0.78)} 18%, ${a(0.38)} 36%, ${a(0.1)} 52%, transparent 66%)`,
    ].join(", ")
}

export function MediaHero({
    scrollContainerRef,
    backdropUrl,
    backdropArt,
    posterUrl,
    hasBannerImage,
    title,
    topBadge,
    metadataRow,
    synopsis,
    footerText,
    actionButtons,
    showPosterColumn = false,
    sidePanel,
    className,
    onBackdropClick,
    onTitleClick
}: MediaHeroProps) {
    const heroRef = useRef<HTMLDivElement>(null)
    const backdropRef = useRef<HTMLDivElement>(null)
    const setBackdropUrl = useIntelligenceStore(s => s.setBackdropUrl)
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
    const palette = useImagePalette(showArt ? heroHighResSrc(art) : null)
    const tone = useHeroTone(showArt ? art : null)
    const scrim = React.useMemo(
        () => heroScrimBackground(palette?.left ?? null, tone === "light" || art?.subject !== "right"),
        [palette?.left, tone, art?.subject]
    )

    // Sync current backdrop with global DynamicBackdrop blur background
    useEffect(() => {
        if (backdropUrl) {
            setBackdropUrl(backdropUrl)
        }
        return () => {
            setBackdropUrl(null)
        }
    }, [backdropUrl, setBackdropUrl])

    // Smooth Parallax: escucha el scroll container real (detalle de serie hace
    // scroll en <main>, no en window) además de window como fallback.
    useEffect(() => {
        let rafId: number | null = null
        const handleScroll = (e: Event) => {
            if (rafId) return
            rafId = requestAnimationFrame(() => {
                rafId = null
                const el = backdropRef.current
                if (!el) return
                // Sin trabajo inútil fuera de pantalla.
                const rect = el.getBoundingClientRect()
                if (rect.bottom < 0 || rect.top > window.innerHeight) return
                const target = e.target
                if (target === document || target === window) {
                    el.style.transform = `translate3d(0, ${window.scrollY * 0.35}px, 0)`
                } else if (target instanceof HTMLElement) {
                    el.style.transform = `translate3d(0, ${Math.max(0, target.scrollTop) * 0.35}px, 0)`
                }
            })
        }
        const scroller = scrollContainerRef?.current
        if (scroller instanceof HTMLElement) {
            scroller.addEventListener("scroll", handleScroll, { passive: true })
        }
        window.addEventListener("scroll", handleScroll, { capture: true, passive: true })
        return () => {
            if (scroller instanceof HTMLElement) {
                scroller.removeEventListener("scroll", handleScroll)
            }
            window.removeEventListener("scroll", handleScroll, { capture: true })
            if (rafId) cancelAnimationFrame(rafId)
        }
    }, [scrollContainerRef])



    return (
        <section
            ref={heroRef}
            className={cn(
                "relative w-full flex flex-col justify-end overflow-hidden pb-12 sm:pb-16 md:pb-20 pt-16 md:pt-24 shrink-0 select-none",
                isSmallBanner ? "min-h-[360px] md:min-h-[420px]" : "min-h-[70svh] lg:min-h-[80svh]",
                className
            )}
        >
            {/* Cinematic Grain Overlay */}
            <div className="grain-overlay z-20" />

            {/* ── Base 16:9 blur-fill: rellena sin recorte/zoom ───────────────────
                Blur reducido para no lavar el fondo; solo rellena el vacío. */}
            {art && backdropTreatment !== "hide" && (
                <div className="absolute inset-0 overflow-hidden bg-black z-0" aria-hidden="true">
                    <div
                        className="absolute -inset-6"
                        style={{
                            backgroundImage: `url(${heroLowResSrc(art) ?? art.src})`,
                            backgroundSize: "cover",
                            backgroundPosition: heroObjectPosition(art),
                            filter: ambientOn
                                ? "blur(14px) brightness(0.7) saturate(140%)"
                                : "blur(12px) brightness(0.62) saturate(130%)",
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
                sin dejar pozo negro. Parallax conservado sobre esta capa. */}
            <div className="absolute inset-0 z-[1] overflow-hidden pointer-events-none">
                {art && backdropTreatment !== "hide" && (
                    <div
                        ref={backdropRef}
                        role="button"
                        tabIndex={onBackdropClick ? 0 : -1}
                        onClick={onBackdropClick}
                        onKeyDown={(e) => {
                            if ((e.key === "Enter" || e.key === " ") && onBackdropClick) {
                                e.preventDefault()
                                onBackdropClick()
                            }
                        }}
                        className={cn(
                            "relative w-full h-full overflow-hidden will-change-transform group/backdrop mx-auto",
                            onBackdropClick && "cursor-pointer pointer-events-auto"
                        )}
                        style={{
                            maskImage: "linear-gradient(to bottom, black 74%, transparent 100%)",
                            WebkitMaskImage: "linear-gradient(to bottom, black 74%, transparent 100%)",
                        }}
                    >
                        <HeroBackdrop
                            art={art}
                            alt="Backdrop"
                            variant="bleed"
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
                                    : "filter saturate-[115%] contrast-[108%] brightness-[0.95]"
                            )}
                        />
                        {/* Velo ligero sin blur para no lavar la portada */}
                    </div>
                )}
            </div>

            {/* Scrim cinematográfico único, teñido con la paleta del arte */}
            <div
                aria-hidden="true"
                className="absolute inset-0 z-10 pointer-events-none"
                style={{ background: scrim }}
            />

            {/* Side Panel Overlay — visible solo en desktop (lg+) */}
            {sidePanel && (
                <div className="hidden lg:flex absolute right-0 top-0 bottom-0 z-30 w-72 xl:w-80 pointer-events-auto">
                    {/* Gradiente de fusión lateral: difumina el panel hacia el backdrop */}
                    <div className="absolute inset-y-0 -left-16 w-16 bg-gradient-to-r from-transparent to-black/60 pointer-events-none z-10" />
                    <div className="flex-1 bg-surface/70 backdrop-blur-overlay-xl border-l border-border-subtle overflow-hidden flex flex-col">
                        {sidePanel}
                    </div>
                </div>
            )}

            {/* Content Container */}
            <div className={cn(
                "relative z-20 w-full max-w-content mx-auto px-4 sm:px-6 md:px-8 lg:px-10 flex",
                showPosterColumn ? "flex-col sm:flex-row items-start sm:items-end gap-6 md:gap-10 lg:gap-14" : "flex-col pointer-events-none"
            )}>
                {showPosterColumn && posterUrl && (
                    <div className="animate-slide-up delay-50 w-24 sm:w-32 md:w-36 lg:w-44 shrink-0 aspect-[2/3] rounded-container overflow-hidden border border-border-subtle bg-surface-container shadow-elevation-5 pointer-events-auto">
                        <DeferredImage
                            src={posterUrl}
                            alt="Poster"
                            className="w-full h-full block"
                            imgClassName="!w-full !h-full !object-cover"
                        />
                    </div>
                )}

                <div className={cn(
                    "flex-1 flex flex-col gap-6 text-left w-full",
                    !showPosterColumn && typeof title === "string" && "max-w-3xl space-y-5 md:space-y-6",
                    // "boxed" lifts the copy off the backdrop onto a glass panel, so it
                    // stays readable over busy art; "fluid" (default) sits directly on it.
                    isBoxedInfo && "pointer-events-auto bg-glass-bg backdrop-blur-overlay-xl border border-border-subtle rounded-container p-6 md:p-8"
                )}>
                    {topBadge && (
                        // fade-only (sin transform): animar translateY en el
                        // ancestro directo de un backdrop-filter obliga a
                        // re-rasterizar el blur en cada frame y "llega tarde".
                        <div className="animate-fade-in delay-50 pointer-events-auto">
                            {topBadge}
                        </div>
                    )}

                    {metadataRow && (
                        <div className="animate-fade-in delay-100 pointer-events-auto">
                            {metadataRow}
                        </div>
                    )}

                    <div className="animate-slide-up delay-150 space-y-2 pointer-events-auto flex items-start justify-start flex-col">
                        {typeof title === "string" ? (
                            onTitleClick ? (
                                <button
                                    type="button"
                                    onClick={onTitleClick}
                                    className="text-left p-0 border-0 bg-transparent cursor-pointer group/title"
                                >
                                    <h1 
                                        className={cn(
                                            MEDIA_HERO_TITLE_CLASS,
                                            "group-hover/title:text-brand-secondary transition-colors duration-slow"
                                        )} 
                                        style={{ fontSize: "max(1.6rem, min(4.2vw, 3.25rem))" }}
                                    >
                                        {title}
                                    </h1>
                                </button>
                            ) : (
                                <h1 
                                    className={MEDIA_HERO_TITLE_CLASS} 
                                    style={{ fontSize: "max(1.6rem, min(4.2vw, 3.25rem))" }}
                                >
                                    {title}
                                </h1>
                            )
                        ) : title}
                    </div>

                    {synopsis && (
                        <p className="animate-slide-up delay-200 text-on-surface-variant text-sm md:text-base leading-relaxed line-clamp-3 drop-shadow-md font-medium max-w-3xl border-l-2 border-brand-secondary/30 pl-4 py-0.5 pointer-events-auto">
                            {synopsis}
                        </p>
                    )}

                    {footerText && (
                        <p className="animate-slide-up delay-250 text-on-surface-variant text-xs font-semibold tracking-wide drop-shadow-sm pointer-events-auto">
                            {footerText}
                        </p>
                    )}

                    {actionButtons && (
                        <div className="animate-slide-up delay-300 flex flex-wrap items-center gap-4 pt-2 pointer-events-auto">
                            {actionButtons}
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
