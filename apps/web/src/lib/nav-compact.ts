/**
 * Lógica de la barra de navegación compacta (solo íconos).
 *
 * Es pura para poder probarla sin DOM. La barra se compacta al bajar y se
 * expande al subir, pero con histéresis: hace falta recorrer cierta distancia
 * en un sentido antes de cambiar. Un umbral único (p. ej. "scrollTop > 80")
 * hace que la barra titile cuando el scroll queda justo en el borde.
 */

export type NavDensity = "auto" | "expanded" | "compact"

export const NAV_DENSITY_OPTIONS: readonly { value: NavDensity; label: string }[] = [
    { value: "auto", label: "Automática" },
    { value: "expanded", label: "Expandida" },
    { value: "compact", label: "Compacta" },
]

export function isNavDensity(value: unknown): value is NavDensity {
    return value === "auto" || value === "expanded" || value === "compact"
}

/** Por debajo de esta posición la barra siempre está expandida. */
export const NAV_TOP_ZONE = 16
/** No se compacta antes de haber bajado esto (la cabecera sigue a la vista). */
export const NAV_COMPACT_MIN_Y = 96
/** Distancia a bajar, sin retroceder, para compactar. */
export const NAV_DOWN_RUN = 32
/** Distancia a subir, sin retroceder, para volver a expandir. */
export const NAV_UP_RUN = 24

export interface NavScrollState {
    compact: boolean
    lastY: number
    /** Recorrido acumulado en el sentido actual (+ baja, − sube). */
    run: number
}

export const INITIAL_NAV_SCROLL_STATE: NavScrollState = { compact: false, lastY: 0, run: 0 }

export function nextNavScrollState(prev: NavScrollState, y: number): NavScrollState {
    const top = Math.max(0, y)
    if (top <= NAV_TOP_ZONE) {
        return prev.compact || prev.lastY !== top || prev.run !== 0
            ? { compact: false, lastY: top, run: 0 }
            : prev
    }

    const delta = top - prev.lastY
    if (delta === 0) return prev

    // Cambio de sentido: el recorrido empieza de nuevo.
    const run = Math.sign(delta) === Math.sign(prev.run) ? prev.run + delta : delta

    if (!prev.compact && top >= NAV_COMPACT_MIN_Y && run >= NAV_DOWN_RUN) {
        return { compact: true, lastY: top, run: 0 }
    }
    if (prev.compact && run <= -NAV_UP_RUN) {
        return { compact: false, lastY: top, run: 0 }
    }
    return { compact: prev.compact, lastY: top, run }
}

interface NavCompactInput {
    density: NavDensity
    /** Estado que sale del scroll (`nextNavScrollState`). */
    scrollCompact: boolean
    /** Puntero encima o foco dentro de la barra. */
    engaged: boolean
}

/**
 * ¿La barra muestra solo íconos? "Compacta" lo fuerza siempre (el foco y el
 * puntero solo muestran el tooltip); "Expandida" nunca; "Automática" sigue el
 * scroll y se abre mientras el usuario la está usando.
 */
export function resolveNavCompact({ density, scrollCompact, engaged }: NavCompactInput): boolean {
    if (density === "compact") return true
    if (density === "expanded") return false
    return scrollCompact && !engaged
}
