import * as React from "react"
import { DeferredImage, getTmdbHeroSrcSet } from "@/components/shared/deferred-image"
import { cn } from "@/components/ui/core/styling"
import { useImagePalette } from "@/hooks/use-image-palette"
import { HERO_ART_ASPECT, HERO_COMPACT_MAX_WIDTH, heroObjectPosition, type HeroArt } from "@/lib/config/hero-art"
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
    /**
     * `cover` (por defecto): agranda y recorta; en angostos, modo relleno.
     * `right`: la imagen entera, en su proporción, a la altura del stage y pegada
     * a la derecha; lo demás es desenfoque (ver `HeroBlurFill`). Nunca se agranda
     * ni se recorta: si no entra a lo ancho, se achica.
     */
    wide?: "cover" | "right"
    /**
     * Dibuja los scrims de legibilidad del texto. En `right` oscurecen solo la
     * zona desenfocada (nunca la imagen); en `cover`, los estándar.
     */
    scrims?: boolean
    className?: string
    imgClassName?: string
}

/** Por debajo de esta proporción (ancho/alto) `cover` recortaría demasiado el 16:9. */
const FIT_MAX_RATIO = 1.3
/** Zoom sobre "ancho completo" en modo relleno: personajes más grandes, ~87% del ancho visible. */
const FIT_ZOOM = 1.15
/** Altura (0–1 del contenedor) del centro de la imagen en modo relleno: arriba del bloque de texto. */
const FIT_CENTER_Y = 0.25

type Box = { width: number; height: number }

/**
 * Contenedores angostos o verticales (celular, tablet): en vez de recortar el
 * 16:9 a una franja, la imagen se muestra casi entera con el punto focal
 * centrado y el resto se rellena con la misma imagen desenfocada.
 */
export function heroFitRect(art: Pick<HeroArt, "focal" | "aspect">, box: Box | null) {
    if (!box || box.width <= 0 || box.height <= 0 || box.width / box.height >= FIT_MAX_RATIO) return null
    const width = box.width * FIT_ZOOM
    const height = width / (art.aspect ?? HERO_ART_ASPECT)
    const left = Math.min(0, Math.max(box.width - width, box.width / 2 - (art.focal.x / 100) * width))
    const top = Math.max(0, box.height * FIT_CENTER_Y - height / 2)
    return { left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) }
}

/**
 * Modo `right`: la imagen ENTERA, en su proporción, a la altura del stage y
 * pegada a la derecha; el hueco lo llena el desenfoque. Nunca se agranda ni se
 * recorta: si a esa altura no entra a lo ancho, se achica hasta el ancho del
 * stage (centrada en vertical). En contenedores angostos (mobile) sigue `cover`.
 */
export function heroRightRect(art: Pick<HeroArt, "aspect">, box: Box | null) {
    if (!box || box.width <= 0 || box.height <= 0 || box.width / box.height < FIT_MAX_RATIO) return null
    const aspect = art.aspect ?? HERO_ART_ASPECT
    const width = Math.round(box.height * aspect)
    if (width <= box.width) return { left: box.width - width, top: 0, width, height: box.height }
    const height = Math.round(box.width / aspect)
    return { left: 0, top: Math.round((box.height - height) / 2), width: box.width, height }
}

/** Alto (fracción del stage) del arte compacto: se ve a un tamaño cercano al real. */
const COMPACT_SCALE = 0.84
/** Separación del borde derecho del stage (fracción del ancho). */
const COMPACT_INSET_X = 0.02

export function isCompactArt(art: Pick<HeroArt, "sourceWidth">): boolean {
    return art.sourceWidth != null && art.sourceWidth < HERO_COMPACT_MAX_WIDTH
}

/**
 * Arte de baja resolución en modo `right`: más chico (cerca de su tamaño real)
 * y un poco hacia arriba, lejos del texto; alrededor, el desenfoque.
 */
export function heroCompactRect(art: Pick<HeroArt, "aspect">, box: Box | null) {
    if (!box || box.width <= 0 || box.height <= 0) return null
    const height = Math.round(box.height * COMPACT_SCALE)
    const width = Math.round(height * (art.aspect ?? HERO_ART_ASPECT))
    if (width >= box.width * 0.8) return null
    const top = Math.round((box.height - height) * 0.35)
    return { left: Math.round(box.width - width - box.width * COMPACT_INSET_X), top, width, height }
}

/**
 * Gradiente de máscara con curva smoothstep entre dos posiciones (px): sin la
 * "línea" que deja un lineal de 2 paradas ni escalones visibles en oscuro.
 */
export function easedMask(fromPx: number, toPx: number, steps = 10): string {
    const stops: string[] = []
    for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const a = t * t * (3 - 2 * t)
        stops.push(`rgba(0,0,0,${a.toFixed(3)}) ${Math.round(fromPx + (toPx - fromPx) * t)}px`)
    }
    return `linear-gradient(to right, ${stops.join(", ")})`
}

/**
 * Borde (px) en que la imagen nítida se funde con el desenfoque: corto, solo
 * para que no se vea el corte; nunca tapa personajes.
 */
const EDGE_FADE_PX = 120

type Rect = { left: number; top: number; width: number; height: number }

/** Máscara de la imagen nítida: fundido corto en los bordes que tocan el desenfoque. */
function sharpMask(rect: Rect, box: Box): React.CSSProperties {
    const fade = Math.min(EDGE_FADE_PX, rect.width * 0.12)
    const layers: string[] = []
    // Izquierda: siempre que la imagen no arranque en el borde del stage.
    layers.push(rect.left > 0 ? easedMask(0, fade) : "linear-gradient(black, black)")
    // Arriba/abajo/derecha: solo si la imagen no llega a ese borde (compacta o achicada).
    const top = rect.top > 0 ? `transparent 0px, black ${fade * 0.6}px` : "black 0px"
    const bottom = rect.top + rect.height < box.height ? `black calc(100% - ${fade * 0.6}px), transparent 100%` : "black 100%"
    layers.push(`linear-gradient(to bottom, ${top}, ${bottom})`)
    if (rect.left + rect.width < box.width - 1) layers.push(`linear-gradient(to left, transparent 0px, black ${fade * 0.6}px)`)
    const image = layers.join(", ")
    return { maskImage: image, WebkitMaskImage: image, maskComposite: "intersect", WebkitMaskComposite: "source-in" }
}

// La fuente es la miniatura (w185 / LQIP): ampliada ya es blanda, así que alcanza
// con un blur chico; uno grande sobre capas del tamaño del stage traba el pintado.
const BLUR_FILTER = "blur(14px) brightness(0.4) saturate(105%)"

/**
 * Relleno desenfocado de modo `right`. Base: la imagen en `cover`, muy
 * desenfocada, para todo lo que la nítida no cubre (incluidos arriba/abajo
 * cuando va achicada). Encima, a la izquierda de su borde, la misma imagen
 * espejada y desenfocada: la columna de la costura es la misma de los dos
 * lados, así que el color sigue sin manchas.
 *
 * `imageWidth`: ancho de la imagen completa (con `cropLeft`, `rect` es solo la
 * parte visible y el espejo arranca en el borde del recorte).
 */
function HeroBlurFill({ src, rect, imageWidth, box, mirror }: { src: string; rect: Rect; imageWidth: number; box: Box; mirror: boolean }) {
    const bleed = 48
    // En coordenadas del wrapper: la costura está en x = rect.width; el reflejo
    // se desvanece desde ahí hacia el borde izquierdo del stage.
    const reflectionMask = easedMask(Math.max(0, rect.width - rect.left), rect.width - Math.min(rect.left * 0.5, rect.width * 0.3))
    const tile = {
        position: "absolute" as const,
        top: 0,
        bottom: 0,
        width: rect.width,
        backgroundImage: `url(${src})`,
        backgroundSize: `${imageWidth}px 100%`,
        backgroundPosition: "right top",
    }
    return (
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
            <div
                className="absolute -inset-12"
                style={{ backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "right center", filter: BLUR_FILTER }}
            />
            {mirror && rect.left > 0 && (
                <div
                    className="absolute"
                    style={{
                        left: rect.left - rect.width,
                        top: Math.min(0, rect.top) - bleed,
                        width: rect.width * 2,
                        height: Math.max(box.height, rect.height) + bleed * 2,
                        filter: BLUR_FILTER,
                        maskImage: reflectionMask,
                        WebkitMaskImage: reflectionMask,
                    }}
                >
                    <div style={{ ...tile, left: 0, transform: "scaleX(-1)" }} />
                    <div style={{ ...tile, left: rect.width }} />
                </div>
            )}
        </div>
    )
}

/** Ancho y alto (px) de la viñeta del texto: título + meta + sinopsis + botones (`max-w-hero-content-wide`). */
const TEXT_POOL_W = 780
const TEXT_POOL_H = 340

const scrimBase = (pct: number) => `color-mix(in srgb, var(--scrim-hero-base, var(--bg-primary, #000000)) ${pct}%, transparent)`

/**
 * Scrims de legibilidad en modo `right`: oscurecen solo la zona desenfocada
 * donde va el texto (hasta el borde de la imagen), nunca la imagen.
 */
function RightModeScrims({ edge }: { edge: number }) {
    const left = `linear-gradient(to right, ${scrimBase(88)} 0px, ${scrimBase(72)} ${Math.round(edge * 0.45)}px, ${scrimBase(35)} ${Math.round(edge * 0.85)}px, transparent ${Math.round(edge + 24)}px)`
    const bottom = `linear-gradient(to top, ${scrimBase(92)} 0%, ${scrimBase(55)} 22%, transparent 50%)`
    const bottomMask = `linear-gradient(to right, black 0px, black ${Math.round(edge * 0.8)}px, transparent ${Math.round(edge + 40)}px)`
    // El bloque de texto (hasta ~670 px) puede pasar el borde de la imagen y quedar sobre
    // personajes claros o saturados. Viñeta suave anclada abajo a la izquierda, del tamaño
    // del texto: el resto del arte queda intacto.
    const textPool = `radial-gradient(ellipse ${TEXT_POOL_W}px ${TEXT_POOL_H}px at 0% 100%, ${scrimBase(80)} 0%, ${scrimBase(68)} 50%, ${scrimBase(44)} 82%, transparent 100%)`
    return (
        <>
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: left }} />
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: textPool }} />
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: bottom, maskImage: bottomMask, WebkitMaskImage: bottomMask }} />
        </>
    )
}

const FIT_EDGE_MASK = "linear-gradient(to bottom, transparent 0%, black 10%, black 78%, transparent 100%)"

/**
 * Capa de imagen de todos los heroes. Encuadra por punto focal (inline, sirve
 * en cualquier proporción), elige máscara por composición y refuerza el scrim
 * cuando el arte es claro o tiene personajes bajo el texto. En contenedores
 * angostos pasa a modo relleno (ver `heroFitRect`).
 */
export function HeroBackdrop({
    art,
    alt,
    variant = "stage",
    priority = true,
    wide = "cover",
    scrims = false,
    className,
    imgClassName,
}: HeroBackdropProps) {
    const tone = useHeroTone(art)
    const src = heroHighResSrc(art)
    const lowSrc = heroLowResSrc(art) ?? src
    const softMask = art.subject !== "right"
    const [boxRef, box] = useElementSize<HTMLDivElement>()
    const fit = wide === "right" ? null : heroFitRect(art, box)
    const compact = wide === "right" && isCompactArt(art) ? heroCompactRect(art, box) : null
    const right = wide === "right" && !compact ? heroRightRect(art, box) : null
    // Recorte lateral sin zoom (`art.cropLeft`): la ventana visible se achica
    // desde la izquierda y la imagen queda a su tamaño, pegada a la derecha.
    const cropPx = right && art.cropLeft ? Math.round(right.width * art.cropLeft) : 0
    const shown = right && cropPx > 0 ? { ...right, left: right.left + cropPx, width: right.width - cropPx } : right
    // Imagen visible en modo `right` (normal, recortada o compacta).
    const placed = shown ?? compact
    const frame = fit ?? compact ?? right
    // Arte claro o con sujeto bajo el texto: el scrim estándar no alcanza (solo `cover`).
    const needsBoost = variant === "stage" && !placed && (tone === "light" || softMask)

    return (
        <div ref={boxRef} className={cn("absolute inset-0 h-full w-full pointer-events-none overflow-hidden", className)}>
            {fit && (
                <div
                    aria-hidden="true"
                    className="absolute -inset-6 pointer-events-none"
                    style={{
                        backgroundImage: `url(${lowSrc})`,
                        backgroundSize: "cover",
                        backgroundPosition: `${art.focal.x}% ${art.focal.y}%`,
                        filter: "blur(var(--filter-blur-hero, 12px)) brightness(0.55) saturate(130%)",
                        transform: "scale(1.08)",
                    }}
                />
            )}
            {placed && box && <HeroBlurFill src={lowSrc} rect={placed} imageWidth={right?.width ?? placed.width} box={box} mirror={art.reflect !== false} />}
            <div
                className="absolute"
                style={fit
                    ? { ...fit, maskImage: FIT_EDGE_MASK, WebkitMaskImage: FIT_EDGE_MASK }
                    : placed && box
                        ? { ...placed, overflow: "hidden", ...sharpMask(placed, box) }
                        : { inset: 0 }}
            >
                <div className="absolute right-0 top-0 h-full" style={{ width: right?.width ?? "100%" }}>
                <DeferredImage
                    src={src}
                    lowResSrc={heroLowResSrc(art)}
                    srcSet={getTmdbHeroSrcSet(src)}
                    // Con caja propia, el ancho real: el srcSet no sube a `original` de más.
                    sizes={frame ? `${frame.width}px` : "100vw"}
                    alt={alt}
                    priority={priority}
                    loading={priority ? "eager" : "lazy"}
                    decoding="async"
                    fetchPriority={priority ? "high" : "auto"}
                    objectPosition={fit || placed ? "50% 50%" : heroObjectPosition(art, box)}
                    className={cn(
                        "!bg-transparent h-full w-full block",
                        variant === "stage" && !fit && !placed && (softMask ? "hero-art-mask-soft" : "hero-art-mask-right")
                    )}
                    imgClassName={cn("!h-full !w-full !object-cover", imgClassName)}
                />
                </div>
            </div>
            {needsBoost && (
                <div
                    aria-hidden="true"
                    className="absolute inset-0 pointer-events-none scrim-hero-boost"
                />
            )}
            {scrims && (placed
                ? <RightModeScrims edge={placed.left} />
                : (
                    <>
                        <div aria-hidden="true" className="absolute inset-0 scrim-hero-left pointer-events-none" />
                        <div aria-hidden="true" className="absolute inset-0 scrim-hero-bottom pointer-events-none" />
                        <div aria-hidden="true" className="absolute inset-0 scrim-hero-top pointer-events-none" />
                    </>
                ))}
        </div>
    )
}
