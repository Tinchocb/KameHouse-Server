import * as React from "react"
import { useRef, useEffect } from "react"


import { DeferredImage } from "@/components/shared/deferred-image"
import { getLowResImage } from "@/lib/helpers/images"
import { cn } from "@/components/ui/core/styling"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { useThemeSettings } from "@/lib/theme/theme-hooks"

const MEDIA_HERO_TITLE_CLASS = "font-sans font-extrabold leading-[1.08] tracking-tight text-on-surface text-edge-glow uppercase text-balance break-words max-w-5xl";

export interface MediaHeroProps {
    /** El contenedor principal (`div`) para aplicar parallax al hacer scroll */
    scrollContainerRef?: React.RefObject<HTMLElement | HTMLDivElement | null>

    backdropUrl: string | null
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

export function MediaHero({
    scrollContainerRef,
    backdropUrl,
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
    // Fondo Ambiental: capa blur/saturada detrás del backdrop. Cuando está ON
    // el backdrop high-res se atenúa para que el halo se perciba (antes quedaba
    // tapado al 85% y el toggle parecía no hacer nada).
    const ambientOn = ts.themeEnableMediaPageBlurredBackground && !!backdropUrl

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
            {backdropUrl && backdropTreatment !== "hide" && (
                <div className="absolute inset-0 overflow-hidden bg-black z-0" aria-hidden="true">
                    <div
                        className="absolute -inset-6"
                        style={{
                            backgroundImage: `url(${getLowResImage(backdropUrl)})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center 20%",
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
                {backdropUrl && backdropTreatment !== "hide" && (
                    <div
                        ref={backdropRef}
                        onClick={onBackdropClick}
                        className={cn(
                            "relative w-full h-full overflow-hidden will-change-transform group/backdrop mx-auto",
                            onBackdropClick && "cursor-pointer pointer-events-auto"
                        )}
                        style={{
                            maskImage: "linear-gradient(to bottom, black 74%, transparent 100%)",
                            WebkitMaskImage: "linear-gradient(to bottom, black 74%, transparent 100%)",
                        }}
                    >
                        <DeferredImage
                            src={backdropUrl}
                            alt="Backdrop"
                            priority={true}
                            sizes="100vw"
                            className="w-full h-full"
                            imgClassName={cn(
                                "w-full h-full transition-all duration-700 object-cover object-[center_18%] scale-[1.01]",
                                backdropTreatment === "dim" ? "opacity-40" : ambientOn ? "opacity-90" : "opacity-95",
                                // Difuminado mínimo: apenas 1px para suavizar sin tapar detalle.
                                backdropTreatment === "blur"
                                    ? "blur-[var(--filter-blur-hero)]"
                                    : "blur-[1px]"
                            )}
                        />
                        {/* Velo ligero sin blur para no lavar la portada */}
                    </div>
                )}
            </div>

            {/* Scrims cinematográficos (tokenizados). El inferior cubre el 70% bajo
                para asentar bloques de texto altos (pills+título+sinopsis+CTAs en
                mobile); antes era h-64 y el título quedaba sobre arte crudo. */}
            <div className="absolute inset-0 z-10 pointer-events-none scrim-hero-left" />
            <div className="absolute inset-x-0 bottom-0 top-[30%] z-10 pointer-events-none scrim-hero-bottom" />
            <div className="absolute inset-x-0 top-0 h-32 z-10 pointer-events-none scrim-hero-top" />

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
                        <div className="animate-slide-up delay-50 pointer-events-auto">
                            {topBadge}
                        </div>
                    )}

                    {metadataRow && (
                        <div className="animate-slide-up delay-100 pointer-events-auto">
                            {metadataRow}
                        </div>
                    )}

                    <div className="animate-slide-up delay-150 space-y-2 pointer-events-auto flex items-start justify-start flex-col">
                        {typeof title === "string" ? (
                            <h1 
                                onClick={onTitleClick}
                                className={cn(
                                    MEDIA_HERO_TITLE_CLASS,
                                    onTitleClick && "cursor-pointer hover:text-brand-secondary transition-colors duration-slow"
                                )} 
                                style={{ fontSize: "max(1.6rem, min(4.2vw, 3.25rem))" }}
                            >
                                {title}
                            </h1>
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
