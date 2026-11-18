import * as React from "react"
import { HeroBackdrop } from "@/components/ui/spotlight/hero-backdrop"
import { IconButton } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import { IconNavigationChevronLeft } from "@/components/ui/icons"
import type { HeroArt } from "@/lib/config/hero-art"

/**
 * Cabecera inmersiva de ficha (serie / película), modelo Apple TV:
 * arte a sangre, logo o título grande abajo a la izquierda sobre un scrim
 * LOCAL (solo esa esquina y el borde inferior; la imagen no se oscurece entera),
 * metadatos en una línea, sinopsis corta expandible y una sola fila de acciones.
 *
 * Variante nueva y propia de la ficha: no reemplaza a `MediaHero`.
 */
interface DetailHeroProps {
    art: HeroArt | null
    title: string
    /** Portada vertical (póster 2:3) de la película */
    posterUrl?: string | null
    /** Clave de elemento compartido de la portada (`movies:<id>`): la tarjeta de origen vuela hasta acá. */
    posterShareKey?: string
    /** Logo transparente (media.logoImage). Si carga, reemplaza visualmente al título. */
    logoUrl?: string | null
    /** Línea superior chica (ej. la era). */
    eyebrow?: React.ReactNode
    /** Metadatos en una línea: año · temporadas · clasificación · géneros. */
    meta?: Array<React.ReactNode | null | undefined | false>
    synopsis?: string | null
    /** Botón principal + acciones secundarias redondas. */
    actions?: React.ReactNode
    /** Debajo de las acciones: progreso de "Continuar". */
    footer?: React.ReactNode
    onBack?: () => void
    backLabel?: string
    /** Atajo de puntero sobre el arte (el teclado ya tiene el botón principal). */
    onArtClick?: () => void
    className?: string
}

const LOCAL_SCRIM = [
    // 1. Superior suave: legibilidad del botón volver y barra de navegación
    "linear-gradient(to bottom, color-mix(in srgb, var(--bg-primary, #08080a) 55%, transparent) 0px, transparent 132px)",
    // 2. Radial local esquina inferior izquierda: protege título, sinopsis y acciones sin invadir el arte
    "radial-gradient(ellipse 85% 70% at 0% 100%, color-mix(in srgb, var(--bg-primary, #08080a) 85%, transparent) 0%, color-mix(in srgb, var(--bg-primary, #08080a) 50%, transparent) 35%, transparent 68%)",
    // 3. Inferior sutil para fundir suavemente con la base de la pantalla
    "linear-gradient(to top, var(--bg-primary, #08080a) 0%, color-mix(in srgb, var(--bg-primary, #08080a) 65%, transparent) 14%, transparent 36%)",
].join(", ")

function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = React.useState(() =>
        typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
    React.useEffect(() => {
        const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)")
        if (!mq) return
        const onChange = () => setReduced(mq.matches)
        mq.addEventListener("change", onChange)
        return () => mq.removeEventListener("change", onChange)
    }, [])
    return reduced
}

/** Parallax suave del arte (solo transform) siguiendo al scroller del shell. */
function useHeroParallax(disabled: boolean) {
    const layerRef = React.useRef<HTMLDivElement>(null)
    React.useEffect(() => {
        const layer = layerRef.current
        if (!layer) return
        if (disabled) {
            layer.style.transform = ""
            return
        }
        const scroller = layer.closest<HTMLElement>("[data-scroll-container]")
        let raf = 0
        const update = () => {
            raf = 0
            const y = scroller ? scroller.scrollTop : window.scrollY
            layer.style.transform = `translate3d(0, ${Math.min(Math.max(0, y), 900) * 0.3}px, 0)`
        }
        const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
        const target: HTMLElement | Window = scroller ?? window
        target.addEventListener("scroll", onScroll, { passive: true })
        update()
        return () => {
            target.removeEventListener("scroll", onScroll)
            if (raf) cancelAnimationFrame(raf)
        }
    }, [disabled])
    return layerRef
}

function ExpandableSynopsis({ text }: { text: string }) {
    const ref = React.useRef<HTMLParagraphElement>(null)
    const [expanded, setExpanded] = React.useState(false)
    const [overflows, setOverflows] = React.useState(false)
    const id = React.useId()

    React.useLayoutEffect(() => {
        const el = ref.current
        if (!el || expanded) return
        const measure = () => setOverflows(el.scrollHeight - el.clientHeight > 2)
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [text, expanded])

    return (
        <div className="max-w-[54ch]">
            <p ref={ref} id={id} className={cn("hero-synopsis type-body text-xs sm:text-sm text-on-surface/90 text-pretty leading-relaxed", !expanded && "line-clamp-3")}>
                {text}
            </p>
            {(overflows || expanded) && (
                <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={id}
                    onClick={() => setExpanded(v => !v)}
                    className="mt-1 -ml-2 inline-flex min-h-11 items-center rounded-full px-2 type-label font-semibold text-on-surface underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent cursor-pointer"
                >
                    {expanded ? "Menos" : "Más"}
                </button>
            )}
        </div>
    )
}

export function DetailHero({
    art, title, posterUrl, posterShareKey, logoUrl, eyebrow, meta, synopsis, actions, footer,
    onBack, backLabel = "Volver", onArtClick, className,
}: DetailHeroProps) {
    const layerRef = useHeroParallax(usePrefersReducedMotion())
    const [logoFailed, setLogoFailed] = React.useState(false)
    const showLogo = !!logoUrl && !logoFailed
    const metaItems = (meta ?? []).filter(Boolean) as React.ReactNode[]

    return (
        <section
            aria-label={title}
            className={cn(
                "relative isolate w-full overflow-hidden flex items-end select-none",
                "min-h-dvh md:min-h-screen",
                className
            )}
        >
            <div className="absolute inset-0 z-hero-visual overflow-hidden pointer-events-none">
                <div ref={layerRef} className="absolute inset-x-0 -top-12 -bottom-12 will-change-transform">
                    {art ? (
                        onArtClick ? (
                            <button
                                type="button"
                                aria-label="Abrir imagen de portada a pantalla completa"
                                className="absolute inset-0 w-full h-full cursor-pointer p-0 border-0 bg-transparent text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent pointer-events-auto"
                                onClick={onArtClick}
                            >
                                <HeroBackdrop art={art} alt="" variant="bleed" priority scrims={false} imgClassName="hero-image-filter" />
                            </button>
                        ) : (
                            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                                <HeroBackdrop art={art} alt="" variant="bleed" priority scrims={false} imgClassName="hero-image-filter" />
                            </div>
                        )
                    ) : (
                        <div className="absolute inset-0 bg-surface-container" aria-hidden="true" />
                    )}
                </div>
            </div>

            <div aria-hidden="true" className="absolute inset-0 z-hero-scrim pointer-events-none" style={{ background: LOCAL_SCRIM }} />

            {onBack && (
                <IconButton
                    intent="glass"
                    onClick={onBack}
                    aria-label={backLabel}
                    icon={<IconNavigationChevronLeft className="w-5 h-5" />}
                    className="absolute top-4 md:top-[4.75rem] left-4 sm:left-6 md:left-8 lg:left-10 z-hero-controls h-11 w-11 [@media(hover:hover)_and_(pointer:fine)]:h-11 [@media(hover:hover)_and_(pointer:fine)]:w-11"
                />
            )}

            <div className="relative z-hero-content page-container pt-28 pb-16 md:pb-20 [@media(max-height:780px)]:pt-20 [@media(max-height:780px)]:pb-10 w-full flex flex-col md:flex-row items-start md:items-end gap-6 sm:gap-8 md:gap-10 lg:gap-14">
                {posterUrl && (
                    <div data-shared-poster={posterShareKey} className="animate-slide-up [animation-duration:var(--duration-base)] shrink-0 w-28 sm:w-32 md:w-36 lg:w-40 aspect-[2/3] rounded-2xl overflow-hidden border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] bg-surface-container shadow-hero">
                        <img
                            src={posterUrl}
                            alt={title}
                            loading="eager"
                            decoding="async"
                            className="h-full w-full object-cover select-none"
                        />
                    </div>
                )}

                <div className="flex-1 min-w-0 flex max-w-[640px] flex-col items-start gap-3 sm:gap-3.5 [@media(max-height:780px)]:gap-2.5">
                    {eyebrow && (
                        <div className="animate-fade-in type-label font-semibold text-on-surface/90">{eyebrow}</div>
                    )}
                    <h1 className="animate-slide-up [animation-duration:var(--duration-base)] delay-50 m-0">
                        {showLogo ? (
                            <img
                                src={logoUrl ?? undefined}
                                alt={title}
                                onError={() => setLogoFailed(true)}
                                className="block h-auto max-h-16 sm:max-h-20 md:max-h-24 w-auto max-w-[min(380px,75vw)] object-contain object-left [filter:var(--drop-shadow-logo)]"
                            />
                        ) : (
                            <span className="hero-title block font-display font-extrabold text-2xl sm:text-3xl md:text-4xl lg:text-[2.6rem] tracking-tight text-on-surface text-balance break-words leading-[1.08]">
                                {title}
                            </span>
                        )}
                    </h1>
                    {metaItems.length > 0 && (
                        <div className="animate-fade-in delay-100 flex flex-wrap items-center gap-1.5 text-xs font-semibold tabular-nums">
                            {metaItems.map((item, i) => (
                                <span
                                    key={i}
                                    className="detail-meta-chip inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-black/60 border border-white/15 border-t-white/25 text-white/90 text-xs font-semibold shadow-glass-highlight-sm"
                                >
                                    {item}
                                </span>
                            ))}
                        </div>
                    )}
                    {synopsis && <div className="animate-fade-in delay-100"><ExpandableSynopsis text={synopsis} /></div>}
                    {actions && <div className="hero-actions animate-slide-up [animation-duration:var(--duration-base)] delay-150 flex w-full flex-wrap items-center gap-3 pt-1">{actions}</div>}
                    {footer && <div className="animate-fade-in delay-150 w-full max-w-sm">{footer}</div>}
                </div>
            </div>
        </section>
    )
}

