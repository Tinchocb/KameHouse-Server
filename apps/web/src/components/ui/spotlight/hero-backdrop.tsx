import * as React from "react"
import { DeferredImage, getTmdbHeroSrcSet } from "@/components/shared/deferred-image"
import { cn } from "@/components/ui/core/styling"
import { useImagePalette } from "@/hooks/use-image-palette"
import { heroObjectPosition, type HeroArt } from "@/lib/config/hero-art"
import { getLargeResImage, getLowResImage } from "@/lib/helpers/images"

const isLocal = (src: string) => src.startsWith("/")

/** Imagen nítida del hero: local tal cual, TMDB en w1280 (el srcSet sube a original). */
export function heroHighResSrc(art: HeroArt): string {
    return isLocal(art.src) ? art.src : getLargeResImage(art.src)
}

/** Versión minúscula para capas desenfocadas y LQIP. */
export function heroLowResSrc(art: HeroArt): string | undefined {
    if (art.lowRes) return art.lowRes
    return isLocal(art.src) ? undefined : getLowResImage(art.src)
}

function luminance(rgb: string): number | null {
    const m = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/)
    if (!m) return null
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** Tono declarado en el registro o estimado con la paleta de la zona del texto. */
export function useHeroTone(art: HeroArt | null): "light" | "dark" {
    const palette = useImagePalette(art && !art.tone ? heroHighResSrc(art) : null)
    if (art?.tone) return art.tone
    const l = palette ? luminance(palette.left) : null
    return l != null && l > 0.5 ? "light" : "dark"
}

/** Tamaño del contenedor (para encuadrar según su proporción real). */
function useElementSize<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number } | null] {
    const ref = React.useRef<T>(null)
    const [size, setSize] = React.useState<{ width: number; height: number } | null>(null)
    React.useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        const update = (width: number, height: number) =>
            // Redondeo a px: sin re-render por subpíxeles durante el parallax.
            setSize(prev => {
                const w = Math.round(width)
                const h = Math.round(height)
                return prev && prev.width === w && prev.height === h ? prev : { width: w, height: h }
            })
        const rect = el.getBoundingClientRect()
        update(rect.width, rect.height)
        const ro = new ResizeObserver(([entry]) => update(entry.contentRect.width, entry.contentRect.height))
        ro.observe(el)
        return () => ro.disconnect()
    }, [])
    return [ref, size]
}

export interface HeroBackdropProps {
    art: HeroArt
    alt: string
    /**
     * `stage`: card del Home/Películas, funde la izquierda según `art.subject`.
     * `bleed`: detalle full-bleed; máscara y scrim (tono incluido) los pone el contenedor.
     */
    variant?: "stage" | "bleed"
    /** El hero es el LCP de la página: carga con prioridad salvo que se diga lo contrario. */
    priority?: boolean
    className?: string
    imgClassName?: string
}

/**
 * Capa de imagen de todos los heroes. Encuadra por punto focal (inline, sirve
 * en cualquier proporción), elige máscara por composición y refuerza el scrim
 * cuando el arte es claro o tiene personajes bajo el texto.
 */
export function HeroBackdrop({
    art,
    alt,
    variant = "stage",
    priority = true,
    className,
    imgClassName,
}: HeroBackdropProps) {
    const tone = useHeroTone(art)
    const src = heroHighResSrc(art)
    const softMask = art.subject !== "right"
    // Arte claro o con sujeto bajo el texto: el scrim estándar no alcanza.
    const needsBoost = variant === "stage" && (tone === "light" || softMask)
    const [boxRef, box] = useElementSize<HTMLDivElement>()

    return (
        <div ref={boxRef} className={cn("absolute inset-0 h-full w-full pointer-events-none overflow-hidden", className)}>
            <DeferredImage
                src={src}
                lowResSrc={heroLowResSrc(art)}
                srcSet={getTmdbHeroSrcSet(src)}
                sizes="100vw"
                alt={alt}
                priority={priority}
                loading={priority ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={priority ? "high" : "auto"}
                objectPosition={heroObjectPosition(art, box)}
                className={cn(
                    "!bg-transparent h-full w-full block",
                    variant === "stage" && (softMask ? "hero-art-mask-soft" : "hero-art-mask-right")
                )}
                imgClassName={cn("!h-full !w-full !object-cover", imgClassName)}
            />
            {needsBoost && (
                <div
                    aria-hidden="true"
                    className="absolute inset-0 pointer-events-none scrim-hero-boost"
                />
            )}
        </div>
    )
}
