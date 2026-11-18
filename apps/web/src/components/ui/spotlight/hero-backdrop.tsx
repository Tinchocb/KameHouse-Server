import * as React from "react"
import { DeferredImage, getTmdbHeroSrcSet } from "@/components/shared/deferred-image"
import { cn } from "@/components/ui/core/styling"
import { type ImagePalette, useImagePalette, ZONE_COLS, ZONE_ROWS } from "@/hooks/use-image-palette"
import { HERO_ART_ASPECT, heroObjectPosition, type HeroArt } from "@/lib/config/hero-art"
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

interface HeroBackdropProps {
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
function heroFitRect(art: Pick<HeroArt, "focal" | "aspect">, box: Box | null) {
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

/**
 * Gradiente de máscara con curva smoothstep entre dos posiciones (px): sin la
 * "línea" que deja un lineal de 2 paradas ni escalones visibles en oscuro.
 */
function easedMask(fromPx: number, toPx: number, steps = 10): string {
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
 * para que no se vea el corte; nunca tapa personajes. Es el fundido base y el
 * de los bordes de arriba/abajo/derecha; el de la izquierda puede ser más
 * largo (ver `seamFadePx`).
 */
const EDGE_FADE_PX = 120
/** Tope del fundido largo de la costura izquierda. */
const SEAM_FADE_MAX_PX = 420
/** Fracción del ancho del arte que ocupa, a cada lado del foco, el sujeto principal. */
const SUBJECT_HALF_WIDTH = 0.2

type Rect = { left: number; top: number; width: number; height: number }

/**
 * Largo (px) del fundido de la costura izquierda. Con el sujeto a la derecha hay
 * margen para un fundido largo (sin escalón de luz entre relleno e imagen), que
 * se corta antes de llegar a los personajes; con sujeto a la izquierda o grupo
 * queda el corto de siempre. `cropPx`: parte de la imagen oculta a la izquierda
 * (el foco se mide sobre la imagen entera).
 */
export function seamFadePx(art: Pick<HeroArt, "focal" | "subject">, visibleWidth: number, cropPx = 0): number {
    const short = Math.min(EDGE_FADE_PX, visibleWidth * 0.12)
    if (art.subject !== "right") return short
    const fullWidth = visibleWidth + cropPx
    const subjectStart = (art.focal.x / 100 - SUBJECT_HALF_WIDTH) * fullWidth - cropPx
    return Math.round(Math.max(short, Math.min(subjectStart, SEAM_FADE_MAX_PX, visibleWidth * 0.3)))
}

/** Máscara de la imagen nítida: fundido en los bordes que tocan el desenfoque. */
function sharpMask(rect: Rect, box: Box, seamFade: number): React.CSSProperties {
    const fade = Math.min(EDGE_FADE_PX, rect.width * 0.12)
    const layers: string[] = []
    // Izquierda: siempre que la imagen no arranque en el borde del stage.
    layers.push(rect.left > 0 ? easedMask(0, seamFade) : "linear-gradient(black, black)")
    // Arriba/abajo/derecha: solo si la imagen no llega a ese borde (achicada).
    const top = rect.top > 0 ? `transparent 0px, black ${fade * 0.6}px` : "black 0px"
    const bottom = rect.top + rect.height < box.height ? `black calc(100% - ${fade * 0.6}px), transparent 100%` : "black 100%"
    layers.push(`linear-gradient(to bottom, ${top}, ${bottom})`)
    if (rect.left + rect.width < box.width - 1) layers.push(`linear-gradient(to left, transparent 0px, black ${fade * 0.6}px)`)
    const image = layers.join(", ")
    return { maskImage: image, WebkitMaskImage: image, maskComposite: "intersect", WebkitMaskComposite: "source-in" }
}

// La fuente es la miniatura (w185 / LQIP): ampliada ya es blanda, así que alcanza
// con un blur chico; uno grande sobre capas del tamaño del stage traba el pintado.
const BLUR_FILTER = "blur(14px) brightness(0.5) saturate(140%)"

/**
 * Cuánta luz del color real de la imagen conserva el relleno (el resto lo oscurece).
 * Pegado a la costura casi no se oscurece, para que no haya escalón de luz contra
 * la imagen; los scrims de texto lo oscurecen hacia la izquierda.
 */
const FILL_LEVEL_EDGE = 0.88
const FILL_LEVEL = 0.75
/** Realce de saturación del relleno: sin esto el color oscurecido se ve gris. */
const FILL_SATURATION = 1.4
/** Nivel del color de fondo bajo los degradados (más oscuro: deja que los focos resalten). */
const FILL_BASE_LEVEL = 0.32

function parseRgb(rgb: string): [number, number, number] | null {
    const m = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/)
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/**
 * Una zona casi gris (azul y amarillo del borde promediados, p. ej.) no aporta color: al
 * rellenar queda un gris verdoso turbio que ensucia el lado del texto. Por debajo de este
 * croma (máx − mín de RGB) el nivel baja hasta `MUDDY_MIN_LEVEL` y se funde con el fondo.
 */
const MUDDY_CHROMA = 60
const MUDDY_MIN_LEVEL = 0.35

export function mutedZoneLevel(rgb: string, level: number): number {
    const [r, g, b] = parseRgb(rgb) ?? [20, 20, 24]
    const k = Math.min(1, (Math.max(r, g, b) - Math.min(r, g, b)) / MUDDY_CHROMA)
    return level * (MUDDY_MIN_LEVEL + (1 - MUDDY_MIN_LEVEL) * k)
}

/**
 * Color de relleno a partir del color real de una zona: realza la saturación
 * (alrededor del gris de su misma luminancia) y lo oscurece a `level`.
 */
export function fillTone(rgb: string, level = FILL_LEVEL, saturation = FILL_SATURATION): [number, number, number] {
    const [r, g, b] = parseRgb(rgb) ?? [20, 20, 24]
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const tone = (v: number) => Math.min(255, Math.max(0, Math.round((gray + (v - gray) * saturation) * level)))
    return [tone(r), tone(g), tone(b)]
}

/** Croma medio (máx − mín de RGB) de las zonas de la costura bajo el cual la aurora sale gris turbia. */
const FLAT_EDGE_CHROMA = 32
/** Dispersión de luminancia (0–1) de la columna 0 bajo la cual el borde es plano (fondo croma, color liso). */
const FLAT_EDGE_SPREAD = 0.05

/**
 * ¿La aurora quedaría turbia o sería una losa lisa? Borde casi gris, o plano (todas las
 * zonas de la costura iguales: no hay detalle que extender). Entonces el relleno cae a
 * un fondo oscuro del tema con degradé suave (`darkFillBackground`).
 */
export function isFlatEdge(palette: Pick<ImagePalette, "left" | "zones">): boolean {
    if (palette.zones.length < ZONE_COLS * ZONE_ROWS) return false
    const chroma: number[] = []
    const lum: number[] = []
    for (let row = 0; row < ZONE_ROWS; row++) {
        for (const col of [0, 1]) {
            const rgb = parseRgb(palette.zones[row * ZONE_COLS + col])
            if (!rgb) continue
            chroma.push(Math.max(...rgb) - Math.min(...rgb))
            if (col === 0) lum.push((0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255)
        }
    }
    if (!chroma.length) return false
    const meanChroma = chroma.reduce((a, b) => a + b, 0) / chroma.length
    const spread = Math.max(...lum) - Math.min(...lum)
    return meanChroma < FLAT_EDGE_CHROMA || spread < FLAT_EDGE_SPREAD
}

/**
 * Relleno oscuro tipo Netflix: `--bg-primary` liso, con un velo apenas teñido del color
 * medio del borde que nace en la costura y se apaga hacia la izquierda.
 */
export function darkFillBackground(palette: Pick<ImagePalette, "left">, rect: Rect): { backgroundImage: string; backgroundColor: string } {
    const [r, g, b] = fillTone(palette.left, 0.22, 1.2)
    const cy = Math.round(rect.top + rect.height * 0.4)
    const rx = Math.max(240, Math.round(rect.left * 0.9))
    const ry = Math.round(rect.height * 0.75)
    const tint = `radial-gradient(ellipse ${rx}px ${ry}px at ${rect.left}px ${cy}px, rgba(${r},${g},${b},0.55) 0%, rgba(${r},${g},${b},0.2) 55%, transparent 100%)`
    return { backgroundImage: tint, backgroundColor: "var(--bg-primary, #08080a)" }
}

/**
 * Relleno de modo `right` hecho solo de color: un foco radial por cada zona de
 * las dos columnas izquierdas de la imagen (las que tocan la costura), puesto
 * donde está esa zona y extendido hacia la izquierda. Sin formas ni
 * reflejos, y sin `filter: blur`; empalma con el color real del borde.
 */
export function auroraBackground(palette: Pick<ImagePalette, "left" | "zones">, rect: Rect): { backgroundImage: string; backgroundColor: string } | null {
    if (palette.zones.length < ZONE_COLS * ZONE_ROWS) return null
    const cw = rect.width / ZONE_COLS
    const rh = rect.height / ZONE_ROWS
    const layers: string[] = []
    // La columna 0 va arriba (se ve más que la 1, que solo aporta profundidad bajo el fundido).
    for (const col of [1, 0]) {
        for (let row = 0; row < ZONE_ROWS; row++) {
            const zone = palette.zones[row * ZONE_COLS + col]
            const [r, g, b] = fillTone(zone, mutedZoneLevel(zone, col === 0 ? FILL_LEVEL_EDGE : FILL_LEVEL))
            const x = Math.round(rect.left + (col + 0.5) * cw)
            const y = Math.round(rect.top + (row + 0.5) * rh)
            const rx = Math.round(Math.max(x, cw * 1.6))
            const ry = Math.round(rh * 1.3)
            const a = col === 0 ? 1 : 0.7
            const stop = (k: number, pos: number) => `rgba(${r},${g},${b},${(a * k).toFixed(2)}) ${pos}%`
            layers.push(`radial-gradient(ellipse ${rx}px ${ry}px at ${x}px ${y}px, ${stop(1, 0)}, ${stop(0.6, 40)}, ${stop(0.22, 70)}, ${stop(0, 100)})`)
        }
    }
    const [br, bg, bb] = fillTone(palette.left, FILL_BASE_LEVEL)
    return { backgroundImage: layers.join(", "), backgroundColor: `rgb(${br},${bg},${bb})` }
}

// Ruido blanco de 160px (alfa = canal rojo del ruido): a baja opacidad rompe el
// banding de los degradados oscuros. `data:` inline, se rasteriza una sola vez.
const GRAIN_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
)}")`

/**
 * Relleno de modo `right` para todo lo que la imagen nítida no cubre. Con la
 * paleta de la imagen (y `mirror`): degradados con el color real de cada zona
 * del borde (`auroraBackground`) + grano. Sin paleta todavía, o con
 * `reflect: false` (borde con destello que ensuciaría el texto): la imagen en
 * `cover` muy desenfocada. Si el borde es gris o plano (`isFlatEdge`): fondo oscuro
 * del tema con degradé suave (`darkFillBackground`).
 */
function HeroBlurFill({ src, rect, palette, mirror }: { src: string; rect: Rect; palette: ImagePalette | null; mirror: boolean }) {
    const flat = mirror && palette ? isFlatEdge(palette) : false
    const dark = flat && palette ? darkFillBackground(palette, rect) : null
    const aurora = mirror && palette && !flat ? auroraBackground(palette, rect) : null
    const fill = dark ?? aurora
    return (
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" data-hero-fill={dark ? "dark" : aurora ? "aurora" : "blur"}>
            {fill ? (
                <>
                    <div className="absolute inset-0 animate-fade-in" style={fill} />
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: GRAIN_URL, backgroundSize: "160px 160px" }} />
                </>
            ) : (
                <div
                    className="absolute -inset-12"
                    style={{ backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "right center", filter: BLUR_FILTER }}
                />
            )}
        </div>
    )
}

/**
 * Scrim cinematográfico natural (Apple TV+ / Netflix):
 * Viñeta radial profunda en la esquina inferior izquierda que se disuelve
 * suavemente hacia la derecha y arriba, combinada con gradiente vertical inferior,
 * garantizando contraste perfecto y legibilidad para el título, metadatos y botones
 * sin cortar ni desenfocar bruscamente el arte ni tapar a los personajes.
 */
function HeroCinematicScrim() {
    return (
        <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none z-hero-scrim"
            style={{
                background: [
                    "radial-gradient(ellipse 90% 80% at 0% 100%, rgba(5, 7, 12, 0.95) 0%, rgba(5, 7, 12, 0.85) 32%, rgba(5, 7, 12, 0.40) 62%, transparent 85%)",
                    "linear-gradient(to top, rgba(5, 7, 12, 0.95) 0%, rgba(5, 7, 12, 0.45) 38%, transparent 68%)",
                    "linear-gradient(to right, rgba(5, 7, 12, 0.55) 0%, transparent 45%)",
                ].join(", "),
            }}
        />
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
    const src = heroHighResSrc(art)
    const lowSrc = heroLowResSrc(art) ?? src
    const [boxRef, box] = useElementSize<HTMLDivElement>()
    const fit = variant === "bleed" || wide === "right" ? null : heroFitRect(art, box)
    const right = wide === "right" ? heroRightRect(art, box) : null
    // Recorte lateral sin zoom (`art.cropLeft`): la ventana visible se achica
    // desde la izquierda y la imagen queda a su tamaño, pegada a la derecha.
    const cropPx = right && art.cropLeft ? Math.round(right.width * art.cropLeft) : 0
    const shown = right && cropPx > 0 ? { ...right, left: right.left + cropPx, width: right.width - cropPx } : right
    // Imagen visible en modo `right` (normal o recortada).
    const placed = shown
    const frame = fit ?? right
    // Colores reales del borde para el relleno (solo modo `right`; comparte caché con `useHeroTone`).
    const palette = useImagePalette(wide === "right" ? src : null)

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
            {placed && box && <HeroBlurFill src={lowSrc} rect={placed} palette={palette} mirror={art.reflect !== false && !cropPx} />}
            <div
                className="absolute"
                style={fit
                    ? { ...fit, maskImage: FIT_EDGE_MASK, WebkitMaskImage: FIT_EDGE_MASK }
                    : placed && box
                        ? { ...placed, overflow: "hidden", ...sharpMask(placed, box, seamFadePx(art, placed.width, cropPx)) }
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
                    className="!bg-transparent h-full w-full block"
                    imgClassName={cn("!h-full !w-full !object-cover", imgClassName)}
                    showSkeleton={false}
                    placeholderColor="transparent"
                />
                </div>
            </div>
            {scrims && <HeroCinematicScrim />}
        </div>
    )
}
