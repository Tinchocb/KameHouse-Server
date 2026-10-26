/**
 * Elemento compartido portada → ficha (y de vuelta): al abrir una ficha, la tarjeta que se tocó "vuela"
 * desde su lugar en la lista hasta la portada de la ficha, y al volver, regresa a su lugar.
 *
 * Por qué una copia (fantasma) y no la View Transitions API ni transformar la portada real:
 * - El router publica la ubicación y monta la ruta después, en una transición de React: el
 *   callback de `startViewTransition` resolvería antes de que exista el DOM nuevo y la captura
 *   congelaría la pantalla o animaría una página vacía (ver reporte transiciones.md).
 * - La copia vive en `<body>` con `position: fixed`: no deja ningún `transform` en un ancestro de
 *   los `position: fixed` de la app (modales, reproductor, barra), y se retira al aterrizar.
 * - Solo `transform` (y un fundido corto al final) sobre la copia: corre en el compositor aunque el
 *   hilo principal siga montando la página.
 * - La copia es la tarjeta entera (degradados, insignias, textos), no solo la imagen: así al hacer clic
 *   no desaparece nada de lo que se ve.
 *
 * Tarjetas y portadas de ficha se emparejan por `data-shared-poster="<clave>"` (ver
 * `sharedPosterKey` en navigation-transition.ts). Si una misma película aparece en dos sitios de la
 * misma pantalla, se usa la tarjeta tocada (clic) o, al volver, la que estaba en el lugar recordado.
 */
import { NAV_EASING } from "./navigation-transition"

const SHARED_POSTER_ATTR = "data-shared-poster"
/** Duración del vuelo: dentro del tope de 250 ms de las entradas de navegación. */
export const SHARED_FLIGHT_MS = 240
/** Fundido de la copia sobre la portada real al aterrizar (esconde la diferencia de resolución). */
const SHARED_LAND_FADE_MS = 90
/** Tope de espera a que la portada real de la ficha termine de cargar y de aparecer tras el vuelo. */
const SHARED_DECODE_WAIT_MS = 600
/** Tope del reintento del foco al volver: la lista puede montar la tarjeta después (DeferredMount, filas). */
export const FOCUS_RESTORE_MS = 600
/** Animaciones CSS de entrada que trae la portada al montarse: se cancelan mientras la copia vuela. */
const POSTER_ENTRY_ANIMATIONS = ["slide-up", "fade-in"]

interface Box {
    left: number
    top: number
    width: number
    height: number
}

interface Viewport {
    width: number
    height: number
}

/** Fracción del área de `box` que cae dentro del viewport (0-1). */
export function visibleFraction(box: Box, viewport: Viewport): number {
    const area = box.width * box.height
    if (area <= 0) return 0
    const w = Math.min(box.left + box.width, viewport.width) - Math.max(box.left, 0)
    const h = Math.min(box.top + box.height, viewport.height) - Math.max(box.top, 0)
    if (w <= 0 || h <= 0) return 0
    return (w * h) / area
}

/**
 * Transformación (origen arriba-izquierda) que lleva un elemento colocado en `from` hasta cubrir `to`.
 * La escala es uniforme (ancho): `canFly` exige proporciones parecidas.
 */
export function flightTransform(from: Box, to: Box): { dx: number; dy: number; scale: number } {
    return { dx: to.left - from.left, dy: to.top - from.top, scale: to.width / from.width }
}

/** ¿Vale la pena el vuelo? Ambos extremos a la vista, tamaño real y proporciones parecidas (sin deformar). */
export function canFly(from: Box, to: Box, viewport: Viewport): boolean {
    if (from.width < 24 || from.height < 24 || to.width < 24 || to.height < 24) return false
    if (visibleFraction(from, viewport) < 0.5 || visibleFraction(to, viewport) < 0.5) return false
    const ratio = from.width / from.height / (to.width / to.height)
    return ratio > 0.88 && ratio < 1.14
}

/** Selector seguro para una clave (puede traer `:`). */
function selectorFor(key: string): string {
    const esc = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(key) : key.replace(/["\\]/g, "\\$&")
    return `[${SHARED_POSTER_ATTR}="${esc}"]`
}

function toBox(r: DOMRect): Box {
    return { left: r.left, top: r.top, width: r.width, height: r.height }
}

export function viewportOf(): Viewport {
    return { width: window.innerWidth, height: window.innerHeight }
}

/** Distancia entre los centros de dos cajas. */
function centerDistance(a: Box, b: Box): number {
    const dx = a.left + a.width / 2 - (b.left + b.width / 2)
    const dy = a.top + a.height / 2 - (b.top + b.height / 2)
    return Math.hypot(dx, dy)
}

/**
 * Último elemento compartido sobre el que se hizo clic. Con una misma película en dos sitios (fila y
 * grilla), esto dice cuál tocó el usuario, aunque la otra copia esté más a la vista.
 */
let activated: Element | null = null

/** Se llama en la fase de captura de cada clic: recuerda la portada tocada (o ninguna si el clic fue en otra cosa). */
export function noteActivation(target: EventTarget | null): void {
    activated = target instanceof Element ? target.closest(`[${SHARED_POSTER_ATTR}]`) : null
}

function activatedPoster(key: string): HTMLElement | null {
    if (!activated || !activated.isConnected || activated.getAttribute(SHARED_POSTER_ATTR) !== key) return null
    return visibleFraction(toBox(activated.getBoundingClientRect()), viewportOf()) > 0 ? (activated as HTMLElement) : null
}

/**
 * Portada compartida con esa clave. Con `near` (una caja de referencia) gana la más cercana a esa
 * posición y no exige que esté a la vista (al volver, la tarjeta puede estar fuera de pantalla). Sin
 * `near`, la más visible.
 */
export function findSharedPoster(key: string, root: ParentNode = document, near?: Box): HTMLElement | null {
    const vp = viewportOf()
    let best: HTMLElement | null = null
    let bestScore = Infinity
    for (const el of root.querySelectorAll<HTMLElement>(selectorFor(key))) {
        const box = toBox(el.getBoundingClientRect())
        const fraction = visibleFraction(box, vp)
        if (!near && fraction <= 0) continue
        const score = near ? centerDistance(box, near) : -fraction
        if (score < bestScore) {
            best = el
            bestScore = score
        }
    }
    return best
}

/** Dónde estaba la portada en la lista al abrir su ficha: a ese lugar vuelve al regresar. */
export interface Departure {
    box: Box
    /** Scroll del contenedor de la lista al salir: si al volver no coincide, la tarjeta no está donde estaba. */
    scrollTop: number
    viewport: Viewport
}

const MAX_DEPARTURES = 12
const departures = new Map<string, Departure>()

export function rememberDeparture(key: string, box: Box, scrollTop: number): void {
    departures.delete(key)
    departures.set(key, { box, scrollTop, viewport: viewportOf() })
    // Solo las últimas: una lista larga de fichas visitadas no debe crecer sin límite.
    while (departures.size > MAX_DEPARTURES) departures.delete(departures.keys().next().value as string)
}

export function getDeparture(key: string): Departure | undefined {
    return departures.get(key)
}

/**
 * ¿La tarjeta de origen sigue donde estaba? Mismo scroll (restaurado por el router) y mismo tamaño de
 * ventana. Si no, el vuelo de regreso aterrizaría en otro lugar y es mejor la entrada normal.
 */
export function departureStillValid(dep: Departure, scrollTop: number, viewport: Viewport): boolean {
    return Math.abs(dep.scrollTop - scrollTop) <= 2 && dep.viewport.width === viewport.width && dep.viewport.height === viewport.height
}

/**
 * La imagen nítida de una portada: `DeferredImage` apila un placeholder borroso (`aria-hidden`) y, encima,
 * la imagen real; la copia flotante tiene que salir de la real.
 */
export function pickPosterImage(root: Element): HTMLImageElement | null {
    const imgs = [...root.querySelectorAll("img")].filter((i) => i.getAttribute("aria-hidden") !== "true")
    return imgs.length > 0 ? imgs[imgs.length - 1] : null
}

/** Opacidad efectiva de un elemento: el producto de su opacidad y la de sus ancestros. */
export function effectiveOpacity(el: Element | null): number {
    let opacity = 1
    for (let e: Element | null = el; e && e !== document.documentElement; e = e.parentElement) {
        const v = Number.parseFloat(getComputedStyle(e).opacity)
        if (Number.isFinite(v)) opacity *= v
    }
    return opacity
}

/** Copia flotante de una portada. */
export interface SharedGhost {
    /** Dónde estaba la portada de origen (coordenadas de pantalla). */
    readonly origin: Box
    /** Lanza el vuelo hasta `target`. Devuelve la animación (para contar su fin) o `null` si no vale la pena. */
    fly(target: Box): Animation | null
    /** Aterriza sobre la portada real: espera a que esté lista y retira la copia con un fundido corto. */
    land(dest: HTMLElement | null): void
    /** Retira la copia ya (fundido corto) sin vuelo. */
    dismiss(): void
    /** Retira la copia sin animar (limpieza). */
    destroy(): void
}

/**
 * Clon de la tarjeta para la copia: la misma estructura y clases (degradados, insignias, textos), sin
 * identificadores ni marcas de clave (para que no compita con la portada real) y no interactivo.
 */
function cloneForFlight(source: HTMLElement): HTMLElement {
    const copy = source.cloneNode(true) as HTMLElement
    const detach = (el: Element) => {
        el.removeAttribute(SHARED_POSTER_ATTR)
        el.removeAttribute("id")
    }
    detach(copy)
    copy.querySelectorAll("[id], [data-shared-poster]").forEach(detach)
    copy.setAttribute("aria-hidden", "true")
    copy.setAttribute("inert", "")
    Object.assign(copy.style, {
        position: "relative",
        inset: "auto",
        width: "100%",
        height: "100%",
        margin: "0",
        // La transformación en línea de la tarjeta (framer-motion o hover) es del lugar de origen, no de la copia.
        transform: "none",
        transition: "none",
        // Las animaciones de entrada de la portada (slide-up / fade-in) son del origen: al insertarse la copia,
        // el navegador las reiniciaría desde opacidad 0 y se vería un fundido al iniciar el vuelo. La copia tiene
        // que verse igual que el origen desde el primer cuadro.
        animation: "none",
        boxSizing: "border-box",
    })
    return copy
}

/**
 * Levanta una copia de la tarjeta con esa clave, encima de la original y sin cambio visible.
 * Usa la tarjeta tocada si hay una con esa clave. `null` si la portada no está a la vista o su imagen
 * todavía no cargó.
 */
export function liftSharedPoster(key: string): SharedGhost | null {
    if (typeof document === "undefined") return null
    const source = activatedPoster(key) ?? findSharedPoster(key)
    activated = null
    if (!source) return null
    const rect = toBox(source.getBoundingClientRect())
    if (visibleFraction(rect, viewportOf()) < 0.5) return null
    const img = pickPosterImage(source)
    const src = img?.currentSrc || img?.src
    if (!img || !src || !img.complete || img.naturalWidth === 0) return null

    // Hereda la opacidad de los ancestros (la lista atenuada o en entrada), no la propia: el clon ya la lleva.
    const inherited = effectiveOpacity(source.parentElement)
    const cs = getComputedStyle(source)
    const wrapper = document.createElement("div")
    wrapper.setAttribute("aria-hidden", "true")
    wrapper.setAttribute("data-shared-ghost", "")
    Object.assign(wrapper.style, {
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        overflow: "hidden",
        pointerEvents: "none",
        // Debajo de la barra de eras y de la navegación (--z-sticky), encima del contenido de la página.
        zIndex: "calc(var(--z-sticky) - 1)",
        transformOrigin: "0 0",
        borderRadius: cs.borderRadius,
        boxSizing: "border-box",
        opacity: String(inherited),
        contain: "layout paint",
    })
    wrapper.appendChild(cloneForFlight(source))
    document.body.appendChild(wrapper)

    let flight: Animation | null = null
    let fade: Animation | null = null
    let gone = false
    let cancelWait = () => {}

    const destroy = () => {
        if (gone) return
        gone = true
        cancelWait()
        flight?.cancel()
        fade?.cancel()
        wrapper.remove()
    }
    const fadeOut = () => {
        if (gone) return
        if (typeof wrapper.animate !== "function") return destroy()
        fade = wrapper.animate([{ opacity: inherited }, { opacity: 0 }], { duration: SHARED_LAND_FADE_MS, easing: "linear", fill: "forwards" })
        fade.addEventListener("finish", destroy)
        fade.addEventListener("cancel", destroy)
    }

    return {
        origin: rect,
        fly(target) {
            if (gone || typeof wrapper.animate !== "function") return null
            if (!canFly(rect, target, viewportOf())) return null
            const { dx, dy, scale } = flightTransform(rect, target)
            wrapper.style.willChange = "transform"
            flight = wrapper.animate(
                [{ transform: "translate3d(0, 0, 0) scale(1)" }, { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})` }],
                { duration: SHARED_FLIGHT_MS, easing: NAV_EASING, fill: "forwards" },
            )
            return flight
        },
        land(dest) {
            if (gone) return
            wrapper.style.willChange = ""
            const destImg = dest ? pickPosterImage(dest) : null
            if (!destImg) return fadeOut()
            // La portada real (más grande) puede no haber terminado de bajar, o estar dentro de un fundido
            // (opacity 0 → 1 de `DeferredImage` o de la página que entra): no se retira la copia hasta que
            // se vea del todo, con tope.
            const started = performance.now()
            let raf = 0
            const ready = () => destImg.complete && destImg.naturalWidth > 0 && effectiveOpacity(destImg) > 0.98
            const check = () => {
                raf = 0
                if (gone) return
                if (ready() || performance.now() - started > SHARED_DECODE_WAIT_MS) return fadeOut()
                raf = requestAnimationFrame(check)
            }
            check()
            const prevDestroy = cancelWait
            cancelWait = () => {
                prevDestroy()
                if (raf) cancelAnimationFrame(raf)
            }
        },
        dismiss() {
            fadeOut()
        },
        destroy,
    }
}

/**
 * Devuelve el foco a la tarjeta de la que se salió (al volver de su ficha) si nadie más lo reclamó:
 * quien navega con teclado sigue donde estaba. Con `near`, la tarjeta que estaba en ese lugar.
 * `allowScroll` solo si el scroll ya está donde estaba la lista: si no, el foco no mueve la vista.
 */
export function restoreFocusToPoster(key: string, idle: Element | null, near?: Box, allowScroll = false): boolean {
    const active = document.activeElement
    if (active && active !== document.body && active !== idle) return false
    const poster = findSharedPoster(key, document, near)
    if (!poster) return false
    const target = poster.matches("button, a[href], [tabindex]") ? poster : poster.parentElement?.querySelector<HTMLElement>("button, a[href]")
    if (!target) return false
    target.focus({ preventScroll: true })
    if (allowScroll && document.activeElement === target) {
        const r = target.getBoundingClientRect()
        if (r.top < 0 || r.bottom > window.innerHeight) target.scrollIntoView({ block: "nearest" })
    }
    return document.activeElement === target
}

/**
 * Reintenta `restoreFocusToPoster` cada cuadro hasta `maxMs`: la tarjeta de la lista puede montarse después
 * de la navegación (DeferredMount, filas virtualizadas). Devuelve la función que lo cancela.
 */
export function restoreFocusWhenReady(key: string, idle: HTMLElement | null, dep: Departure | undefined, maxMs = FOCUS_RESTORE_MS): () => void {
    const started = performance.now()
    let raf = 0
    const tick = () => {
        raf = 0
        const allowScroll = Boolean(dep && idle && Math.abs(idle.scrollTop - dep.scrollTop) <= 2)
        if (restoreFocusToPoster(key, idle, dep?.box, allowScroll)) return
        if (performance.now() - started > maxMs) return
        raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
        if (raf) cancelAnimationFrame(raf)
        raf = 0
    }
}

/**
 * Oculta la portada real mientras la copia vuela encima (la copia la reemplaza a la vista).
 * Devuelve la función que la muestra. Cancela solo las animaciones de entrada de la portada (no las
 * transiciones del hover) y se limpia sola si algo falla.
 */
export function holdPosterHidden(dest: HTMLElement, maxMs: number): () => void {
    // La entrada CSS de la portada (slide-up/fade-in) pisaría la animación de ocultar: se cancela.
    for (const a of dest.getAnimations()) {
        const name = "animationName" in a ? (a as CSSAnimation).animationName : ""
        if (POSTER_ENTRY_ANIMATIONS.includes(name)) a.cancel()
    }
    if (typeof dest.animate !== "function") return () => {}
    const hold = dest.animate([{ opacity: 0 }, { opacity: 0 }], { duration: maxMs, fill: "both" })
    return () => hold.cancel()
}
