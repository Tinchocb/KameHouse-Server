/**
 * Lógica pura de las transiciones entre apartados: qué clase de navegación es (pestaña
 * principal, entrar a una ficha, volver de ella) y qué keyframes le corresponden. Sin DOM:
 * PageTransition la usa para animar y los tests la cubren sin navegador.
 *
 * Reglas de motion: solo `opacity` y `transform`; entrada ≤ 250 ms, salida ≤ 120 ms; sin rebotes.
 */

/** Curva ease-out fuerte del sistema (--ease-out en animation.css). */
export const NAV_EASING = "cubic-bezier(0.23, 1, 0.32, 1)"
export const NAV_ENTER_MS = 200
/** Salida de la página vieja mientras se monta la nueva: corta, solo opacidad (≤ 120 ms). */
export const NAV_EXIT_MS = 110
/**
 * Opacidad a la que baja la página vieja durante la salida, y desde la que arranca la nueva si no
 * hubo salida. No es 0: si el hilo principal se traba en el primer cuadro (render de la ruta,
 * decodificación de imágenes), una entrada desde 0 dejaba ver el fondo vacío ~100-200 ms: un
 * parpadeo a negro en cada navegación (medido cuadro a cuadro en Inicio → Series).
 */
export const NAV_DIM_OPACITY = 0.6
/** Por encima de esta opacidad la salida cuenta como "no se llegó a ver". */
const EXIT_VISIBLE_BELOW = 0.98

export type NavKind = "tab" | "drill-in" | "drill-out" | "standard"

interface NavClass {
    kind: NavKind
    /** Sentido horizontal de las pestañas: +1 hacia la derecha, -1 hacia la izquierda, 0 sin sentido. */
    direction: -1 | 0 | 1
}

/** Orden de las pestañas principales de la barra flotante (define el sentido del desplazamiento). */
const MAIN_TAB_ORDER: Record<string, number> = {
    "/home": 0,
    "/series": 1,
    "/movies": 2,
    "/chronology": 3,
    "/admin": 4,
    "/settings": 5,
}

const DETAIL_RE = /\/(movies|series)\/[^/]+/
const SHARED_RE = /^\/(movies|series)\/([^/]+)\/?$/

function isDetailPath(path: string): boolean {
    return DETAIL_RE.test(path)
}

/** `/series/123` y `/series/456` son la misma ruta (misma raíz de página): ids numéricos → `:id`. */
export function routeShape(path: string): string {
    return path.replace(/\/\d+(?=\/|$)/g, "/:id")
}

export function classifyNavigation(prevPath: string, nextPath: string): NavClass {
    const prevDetail = isDetailPath(prevPath)
    const nextDetail = isDetailPath(nextPath)
    // Drill-in: de lista o catálogo a una ficha.
    if (!prevDetail && nextDetail) return { kind: "drill-in", direction: 0 }
    // Drill-out: de una ficha de vuelta a lista o catálogo.
    if (prevDetail && !nextDetail) return { kind: "drill-out", direction: 0 }
    const prevOrder = MAIN_TAB_ORDER[prevPath]
    const nextOrder = MAIN_TAB_ORDER[nextPath]
    if (prevOrder !== undefined && nextOrder !== undefined && prevOrder !== nextOrder) {
        return { kind: "tab", direction: nextOrder > prevOrder ? 1 : -1 }
    }
    return { kind: "standard", direction: 0 }
}

/**
 * Clave del elemento compartido de una ficha: `/movies/12` → `movies:12`, `/series/7` → `series:7`.
 * Las tarjetas y la portada de la ficha llevan la misma clave en `data-shared-poster`. Rutas más
 * profundas (`/series/7/algo`) no comparten portada.
 */
export function sharedPosterKey(path: string): string | null {
    const m = SHARED_RE.exec(path)
    return m ? `${m[1]}:${decodeURIComponent(m[2])}` : null
}

/**
 * Keyframes de la entrada de la página nueva. `shared`: la portada vuela sola, la página solo se funde.
 * `staggered`: los bloques principales se escalonan y cada uno se funde desde su propia opacidad, así que el
 * contenedor solo se desplaza (sin `opacity`): si también bajara, el primer cuadro quedaría a 0,6 × 0,6.
 */
export function enterKeyframes(nav: NavClass, fromOpacity: number, shared = false, staggered = false): Keyframe[] {
    const frames = motionKeyframes(nav, fromOpacity, shared)
    return staggered ? frames.map(({ transform }) => ({ transform })) : frames
}

/** Desplazamiento y fundido de la entrada, sin escalonado (ver enterKeyframes). */
function motionKeyframes(nav: NavClass, fromOpacity: number, shared: boolean): Keyframe[] {
    const to: Keyframe = { opacity: 1, transform: "translate3d(0, 0, 0)" }
    if (shared) return [{ opacity: fromOpacity, transform: "translate3d(0, 0, 0)" }, to]
    switch (nav.kind) {
        case "drill-in":
            // Ascenso sutil con leve escala.
            return [{ opacity: fromOpacity, transform: "translate3d(0, 10px, 0) scale(0.995)" }, { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" }]
        case "drill-out":
            // Inversa del drill-in: descenso suave.
            return [{ opacity: fromOpacity, transform: "translate3d(0, -6px, 0)" }, to]
        case "tab":
            return [{ opacity: fromOpacity, transform: `translate3d(${nav.direction * 8}px, 0, 0)` }, to]
        default:
            return [{ opacity: fromOpacity, transform: "translate3d(0, 6px, 0)" }, to]
    }
}

/** Salida de la página vieja: solo baja la opacidad (no mueve nada), así no compite con la entrada. */
export function exitKeyframes(): Keyframe[] {
    return [{ opacity: 1 }, { opacity: NAV_DIM_OPACITY }]
}

/**
 * Opacidad desde la que arranca la entrada (con escalonado, la del primer bloque): continúa la de la salida
 * si esta llegó a verse.
 * Si la página nueva se montó en el mismo cuadro que arrancó la salida (ruta ya precargada: el render
 * es una sola tarea larga), la salida nunca se pintó y seguir desde 1 sería un corte seco: se
 * arranca desde la opacidad base, como antes.
 */
export function entryStartOpacity(exitOpacity: number | null): number {
    if (exitOpacity === null || !Number.isFinite(exitOpacity) || exitOpacity >= EXIT_VISIBLE_BELOW) return NAV_DIM_OPACITY
    return Math.min(1, Math.max(NAV_DIM_OPACITY, exitOpacity))
}

/** Marca del placeholder de carga de la ruta (RoutePending): mientras se ve, la página nueva todavía no existe. */
export const ROUTE_PENDING_ATTR = "data-route-pending"

export function isRoutePendingPlaceholder(el: Element | null): boolean {
    return Boolean(el && el.hasAttribute(ROUTE_PENDING_ATTR))
}
