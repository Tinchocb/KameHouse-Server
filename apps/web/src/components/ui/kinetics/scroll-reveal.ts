import * as React from "react"
import { useMotionTier, type MotionTier } from "./motion-tier"

/**
 * Revelado al hacer scroll: el contenido que entra en pantalla aparece con un
 * fundido y un ascenso corto, una sola vez.
 *
 * - Un único IntersectionObserver para toda la app (cientos de filas no cuestan
 *   cientos de observers).
 * - Lo que ya está en pantalla al montar NO se anima: la transición de página ya
 *   lo presenta, y animarlo de nuevo sería un segundo fundido (y un parpadeo).
 * - Los elementos que entran en el mismo cuadro se escalonan solos, en orden de
 *   lectura (arriba→abajo, izquierda→derecha): una grilla entra "en ola" sin
 *   pasar índices a mano.
 * - Solo transform y opacity, por CSS (compositor, sin re-renders de React). Al
 *   terminar se limpian los estilos en línea, así el hover de las tarjetas (que
 *   también usa transform) vuelve a funcionar.
 */

export interface RevealConfig {
    /** Desplazamiento vertical inicial en px (0 = solo fundido). */
    y: number
    /** Duración en ms. */
    duration: number
    /** Retraso entre elementos que entran juntos, en ms. */
    stagger: number
    /** Tope del retraso acumulado, en ms. */
    maxDelay: number
}

/** Curva ease-out fuerte del sistema (--ease-out en animation.css). */
const REVEAL_EASING = "cubic-bezier(0.23, 1, 0.32, 1)"

/**
 * `list`: filas de listas largas que se recorren rápido (episodios). Entrada más
 * corta y casi sin escalonado: con 520 ms y retrasos acumulados, al scrollear
 * rápido el contenido llegaba tarde y la lista se sentía lenta.
 */
type RevealVariant = "default" | "list"

export function revealConfigForTier(tier: MotionTier, variant: RevealVariant = "default"): RevealConfig | null {
    if (tier === "off") return null
    if (variant === "list") {
        // Solo opacidad, 200 ms: con el ascenso de 10 px y 300 ms, cada fila que entra al scrollear
        // se movía contra el scroll y quedaba a medio fundido (~1 por cuadro durante el scroll).
        return { y: 0, duration: 200, stagger: 0, maxDelay: 0 }
    }
    if (tier === "subtle") return { y: 0, duration: 320, stagger: 30, maxDelay: 180 }
    return { y: 18, duration: 520, stagger: 45, maxDelay: 360 }
}

interface Tracked {
    config: RevealConfig
    key?: string
}

/**
 * Claves ya reveladas en la sesión. Las listas virtualizadas desmontan y vuelven
 * a montar filas al scrollear: sin esto, cada vuelta hacia arriba repetía la
 * animación. Acotado para no crecer sin límite.
 */
const revealedKeys = new Set<string>()
const MAX_REVEALED_KEYS = 4000

function rememberRevealed(key: string | undefined) {
    if (!key) return
    if (revealedKeys.size >= MAX_REVEALED_KEYS) {
        const first = revealedKeys.values().next().value
        if (first !== undefined) revealedKeys.delete(first)
    }
    revealedKeys.add(key)
}

const tracked = new WeakMap<Element, Tracked>()
let observer: IntersectionObserver | null = null

function isInViewport(el: Element): boolean {
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight || document.documentElement.clientHeight
    const vw = window.innerWidth || document.documentElement.clientWidth
    return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw
}

function hide(el: HTMLElement, config: RevealConfig) {
    el.style.opacity = "0"
    if (config.y) el.style.transform = `translate3d(0, ${config.y}px, 0)`
}

function show(el: HTMLElement, config: RevealConfig, delay: number) {
    const t = `${config.duration}ms ${REVEAL_EASING} ${delay}ms`
    el.style.transition = `opacity ${t}, transform ${t}`
    // Forzar el estilo oculto antes de cambiar, para que la transición arranque.
    void el.offsetWidth
    el.style.opacity = ""
    el.style.transform = ""
    const cleanup = () => {
        el.style.transition = ""
        el.removeEventListener("transitionend", onEnd)
    }
    const onEnd = (e: TransitionEvent) => {
        if (e.target === el && e.propertyName === "opacity") cleanup()
    }
    el.addEventListener("transitionend", onEnd)
    // Respaldo: si no hay transitionend (pestaña oculta, elemento desmontado).
    window.setTimeout(cleanup, config.duration + delay + 80)
}

/** Orden de lectura: fila (con tolerancia) y después columna. */
export function readingOrder(a: DOMRectReadOnly, b: DOMRectReadOnly): number {
    if (Math.abs(a.top - b.top) > 8) return a.top - b.top
    return a.left - b.left
}

/** Fracción del elemento que debe asomar para revelarlo. */
const REVEAL_RATIO = 0.08
/** Alto visible (px) que basta para revelar, aunque no llegue a la fracción: contenedores de listas largas. */
const REVEAL_MIN_VISIBLE_PX = 64
/**
 * Umbrales finos: con uno solo (0.08), un contenedor más alto que ~12 pantallas
 * (la sección de una grilla de cien títulos) nunca llegaba al 8 % visible y
 * quedaba invisible para siempre.
 */
const REVEAL_THRESHOLDS = [0, 0.001, 0.0025, 0.005, 0.01, 0.02, 0.04, REVEAL_RATIO]

function isRevealable(e: IntersectionObserverEntry): boolean {
    if (!e.isIntersecting) return false
    const ratio = e.intersectionRatio
    const visible = e.intersectionRect?.height
    // Sin datos de intersección (entornos de prueba, navegadores viejos): vale isIntersecting.
    if (ratio === undefined || visible === undefined) return true
    return ratio >= REVEAL_RATIO || visible >= REVEAL_MIN_VISIBLE_PX
}

function handleEntries(entries: IntersectionObserverEntry[]) {
    const entering = entries
        .filter((e) => isRevealable(e) && tracked.has(e.target))
        .sort((a, b) => readingOrder(a.boundingClientRect, b.boundingClientRect))
    entering.forEach((entry, i) => {
        const el = entry.target as HTMLElement
        const info = tracked.get(el)
        if (!info) return
        tracked.delete(el)
        observer?.unobserve(el)
        rememberRevealed(info.key)
        show(el, info.config, Math.min(i * info.config.stagger, info.config.maxDelay))
    })
}

function getObserver(): IntersectionObserver | null {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return null
    if (!observer) {
        // El borde inferior se achica un 8%: el elemento aparece cuando ya asoma,
        // no cuando apenas toca el borde (ahí el movimiento no se llega a ver).
        observer = new IntersectionObserver(handleEntries, { threshold: REVEAL_THRESHOLDS, rootMargin: "0px 0px -8% 0px" })
    }
    return observer
}

interface QueuedReveal {
    el: HTMLElement
    config: RevealConfig
    key: string | undefined
    cancelled: boolean
    release: (() => void) | null
}
let revealQueue: QueuedReveal[] = []
let revealFlushScheduled = false

function flushRevealQueue() {
    revealFlushScheduled = false
    const batch = revealQueue
    revealQueue = []
    const obs = getObserver()
    if (!obs) return
    const live = batch.filter((q) => !q.cancelled && !tracked.has(q.el) && !(q.key && revealedKeys.has(q.key)))
    // Todas las lecturas antes de cualquier escritura: una sola medición de layout para el lote.
    const inView = live.map((q) => isInViewport(q.el))
    live.forEach((q, i) => {
        q.release = registerReveal(obs, q.el, q.config, q.key, inView[i])
    })
}

/**
 * Como `observeReveal`, pero el registro se junta con el de los demás elementos que montan en
 * el mismo commit y se resuelve en un microtask (antes del pintado, sin parpadeo). Un ref
 * callback por fila de una lista leía su posición justo después de que la fila anterior se
 * ocultó: un layout forzado por fila (70 ms con ~20 episodios, medido con perfil).
 */
export function observeRevealBatched(el: HTMLElement, config: RevealConfig, key?: string): () => void {
    if (!getObserver() || tracked.has(el) || (key && revealedKeys.has(key))) return () => {}
    const queued: QueuedReveal = { el, config, key, cancelled: false, release: null }
    revealQueue.push(queued)
    if (!revealFlushScheduled) {
        revealFlushScheduled = true
        queueMicrotask(flushRevealQueue)
    }
    return () => {
        queued.cancelled = true
        queued.release?.()
    }
}

/** Registra un elemento para revelarlo al entrar en pantalla. Devuelve la baja. */
export function observeReveal(el: HTMLElement, config: RevealConfig, key?: string): () => void {
    const obs = getObserver()
    if (!obs || tracked.has(el) || (key && revealedKeys.has(key))) return () => {}
    return registerReveal(obs, el, config, key, isInViewport(el))
}

/** Escritura del registro: separada de la lectura (`isInViewport`) para poder agrupar lecturas. */
function registerReveal(obs: IntersectionObserver, el: HTMLElement, config: RevealConfig, key: string | undefined, inView: boolean): () => void {
    if (inView) {
        rememberRevealed(key)
        return () => {}
    }
    tracked.set(el, { config, key })
    hide(el, config)
    obs.observe(el)
    return () => {
        if (!tracked.has(el)) return
        tracked.delete(el)
        obs.unobserve(el)
        el.style.opacity = ""
        el.style.transform = ""
    }
}

/** Revela el elemento de la ref al entrar en pantalla. */
export function useScrollReveal<T extends HTMLElement>(ref: React.RefObject<T | null>) {
    const tier = useMotionTier()
    React.useLayoutEffect(() => {
        const el = ref.current
        const config = revealConfigForTier(tier)
        if (!el || !config) return
        return observeReveal(el, config)
    }, [ref, tier])
}

/**
 * Ref callback que revela el elemento al entrar en pantalla; con limpieza al
 * desmontar (React 19). Para ítems que montan y desmontan solos, como las
 * filas de una lista virtualizada: con `key`, cada ítem se revela una sola vez
 * por sesión aunque se vuelva a montar. Si un mismo ref se comparte entre
 * ítems, la clave se toma del atributo `data-reveal-key` de cada elemento.
 */
export function useRevealRef<T extends HTMLElement>(key?: string, variant: RevealVariant = "default"): (el: T | null) => (() => void) | undefined {
    const tier = useMotionTier()
    return React.useCallback((el: T | null) => {
        const config = revealConfigForTier(tier, variant)
        if (!el || !config) return undefined
        return observeRevealBatched(el, config, key ?? el.dataset.revealKey)
    }, [tier, key, variant])
}
