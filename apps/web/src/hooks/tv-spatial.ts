export type SpatialDir = "up" | "down" | "left" | "right"

interface RectLike {
    left: number
    top: number
    width: number
    height: number
}

export interface SpatialCandidate<T> {
    el: T
    rect: RectLike
}

/** Margen (px) para considerar que dos centros están "en la misma línea". */
const AXIS_EPSILON = 2
/** Peso de la desalineación perpendicular frente a la distancia en el eje de la flecha. */
const PERP_WEIGHT = 2
/** Si hay solape perpendicular, la desalineación de centros pesa poco. */
const ALIGNED_PERP_WEIGHT = 0.25
/** Tangente del semiángulo del cono (2 ≈ 63°). */
const CONE_SLOPE = 2

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
    return Math.min(aEnd, bEnd) - Math.max(aStart, bStart)
}

/**
 * Puntaje de un candidato respecto de `from` en la dirección dada (menor es mejor).
 * Devuelve `null` si el candidato no está estrictamente en el semiplano de la flecha.
 * Los que se solapan en el eje perpendicular no pagan penalización perpendicular,
 * así un destino lejano y alineado le gana a uno cercano pero desviado.
 */
export function scoreCandidate(from: RectLike, to: RectLike, dir: SpatialDir): number | null {
    const fromCx = from.left + from.width / 2
    const fromCy = from.top + from.height / 2
    const dx = to.left + to.width / 2 - fromCx
    const dy = to.top + to.height / 2 - fromCy

    const horizontal = dir === "left" || dir === "right"
    const primary = dir === "right" || dir === "down" ? (horizontal ? dx : dy) : -(horizontal ? dx : dy)
    if (primary <= AXIS_EPSILON) return null

    const perpCenter = Math.abs(horizontal ? dy : dx)
    const aligned = horizontal
        ? overlap(from.top, from.top + from.height, to.top, to.top + to.height) > 0
        : overlap(from.left, from.left + from.width, to.left, to.left + to.width) > 0
    const perp = aligned ? perpCenter * ALIGNED_PERP_WEIGHT : perpCenter
    return primary + perp * PERP_WEIGHT
}

/** ¿El candidato cae dentro del cono de ~63° de la flecha (o se solapa en el eje perpendicular)? */
function inCone(from: RectLike, to: RectLike, dir: SpatialDir): boolean {
    const dx = to.left + to.width / 2 - (from.left + from.width / 2)
    const dy = to.top + to.height / 2 - (from.top + from.height / 2)
    const horizontal = dir === "left" || dir === "right"
    const primary = Math.abs(horizontal ? dx : dy)
    const perp = Math.abs(horizontal ? dy : dx)
    const aligned = horizontal
        ? overlap(from.top, from.top + from.height, to.top, to.top + to.height) > 0
        : overlap(from.left, from.left + from.width, to.left, to.left + to.width) > 0
    return aligned || perp <= primary * CONE_SLOPE
}

/**
 * Mejor candidato en la dirección dada: primero dentro del cono de ~63°; solo si no
 * hay ninguno, cualquiera del semiplano. `null` si no hay ninguno en el semiplano.
 * No hay "fallback" hacia la dirección opuesta: un vecino detrás nunca gana a uno
 * correcto más lejano, y en el borde la flecha simplemente no mueve el foco.
 */
export function pickNext<T>(
    from: RectLike,
    candidates: ReadonlyArray<SpatialCandidate<T>>,
    dir: SpatialDir,
    current?: T
): T | null {
    let bestCone: T | null = null
    let bestConeScore = Infinity
    let bestHalf: T | null = null
    let bestHalfScore = Infinity
    for (const { el, rect } of candidates) {
        if (el === current) continue
        const s = scoreCandidate(from, rect, dir)
        if (s === null) continue
        if (s < bestHalfScore) {
            bestHalfScore = s
            bestHalf = el
        }
        if (s < bestConeScore && inCone(from, rect, dir)) {
            bestConeScore = s
            bestCone = el
        }
    }
    return bestCone ?? bestHalf
}

/**
 * ¿Es un elemento navegable con el D-pad? Excluye el skip-link y todo lo que el
 * usuario no ve (visibility hidden, opacidad ≈ 0 propia o heredada de un ancestro).
 */
export function isNavigable(el: HTMLElement): boolean {
    if (el.classList.contains("skip-link")) return false
    // `sr-only` (p. ej. el "Saltar al contenido"): 1×1 px, no es un destino visible.
    const box = el.getBoundingClientRect()
    if (box.width <= 2 && box.height <= 2) return false
    for (let node: HTMLElement | null = el; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (node === el && style.visibility === "hidden") return false
        // Un fade-in en curso (entrada de ruta) no cuenta como "invisible": la caché de
        // nodos no se vuelve a calcular cuando termina la animación.
        if (parseFloat(style.opacity) < 0.05 && (node.getAnimations?.().length ?? 0) === 0) return false
    }
    return true
}
