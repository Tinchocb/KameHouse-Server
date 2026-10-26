import { useEffect, useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react"
import { useRouterState } from "@tanstack/react-router"
import { cn } from "@/components/ui/core/styling"
import { PAGE_ENTERED_EVENT, PAGE_ENTERING_ATTR } from "./page-enter-signal"
import { staggerBlocksOf, staggerEnter } from "./enter-stagger"
import {
    NAV_ENTER_MS,
    NAV_EASING,
    NAV_DIM_OPACITY,
    NAV_EXIT_MS,
    classifyNavigation,
    enterKeyframes,
    entryStartOpacity,
    exitKeyframes,
    isRoutePendingPlaceholder,
    routeShape,
    sharedPosterKey,
    type NavKind,
} from "./navigation-transition"
import {
    FOCUS_RESTORE_MS,
    SHARED_FLIGHT_MS,
    departureStillValid,
    findSharedPoster,
    getDeparture,
    holdPosterHidden,
    liftSharedPoster,
    noteActivation,
    rememberDeparture,
    restoreFocusWhenReady,
    viewportOf,
    type Departure,
    type SharedGhost,
} from "./shared-element"

type PageTransitionProps = ComponentPropsWithoutRef<"div">

/**
 * Tope de espera al contenido nuevo. Si por algo la raíz de la página no cambia (o el cambio
 * no se detecta), la entrada corre igual pasado este tiempo, para no quedar pendiente.
 */
const CONTENT_SWAP_TIMEOUT_MS = 900

interface PendingEntry {
    prevPath: string
    nextPath: string
    autoplay: boolean
    /**
     * Clave de la portada compartida: la de la ficha a la que se entra (drill-in) o de la que se sale
     * (drill-out). `null` si no es ese tipo de navegación.
     */
    sharedKey: string | null
}

function prefersReducedMotion(): boolean {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
}

/** Opacidad actual de la salida (1 si todavía no se pintó ningún cuadro). */
function exitOpacityOf(exit: Animation | null): number | null {
    const progress = exit?.effect?.getComputedTiming().progress
    if (progress === undefined || progress === null) return null
    return 1 - (1 - NAV_DIM_OPACITY) * progress
}

function sharedKeyFor(kind: NavKind, prevPath: string, nextPath: string): string | null {
    if (kind === "drill-in") return sharedPosterKey(nextPath)
    if (kind === "drill-out") return sharedPosterKey(prevPath)
    return null
}

/**
 * Contenedor de scroll de las páginas. Al cambiar de ruta:
 * - la página vieja baja un poco su opacidad mientras se monta la nueva (salida corta, ≤ 110 ms, solo
 *   `opacity`): si la ruta tarda en montarse, el clic ya tiene respuesta y no hay un corte seco;
 * - la página nueva entra con un fundido direccional según la jerarquía (pestañas horizontales,
 *   drill-in a ficha o drill-out a catálogo), que CONTINÚA desde la opacidad a la que quedó la vieja;
 * - sus bloques principales (hero, luego cuerpo) aparecen escalonados;
 * - al abrir una ficha desde su tarjeta la tarjeta vuela hasta la portada, y al volver regresa a su lugar
 *   (ver shared-element.ts). Al volver, el foco va a la tarjeta de origen en cualquier caso.
 *
 * La entrada se dispara cuando el contenido nuevo YA está montado, no cuando cambia la
 * URL: el router publica la ubicación de inmediato pero monta la ruta después (en una
 * transición de React). Disparar con la URL animaba la página vieja y el contenido nuevo
 * aparecía sin animación (medido: el efecto veía la raíz de la página anterior). Mientras la ruta carga,
 * el router muestra su placeholder (RoutePending): no cuenta como página nueva. La salida nunca
 * retrasa el montaje: es una animación del compositor que se corta cuando llega la página nueva.
 *
 * Se anima con WAAPI (compositor, sin re-montar la ruta) y sin `fill` al terminar: no queda ningún
 * transform que rompa los `position: fixed` de modales o del reproductor. Se omite con movimiento
 * reducido y al entrar directo al reproductor (`autoplay`), donde ya hay una pantalla de carga continua.
 */
export function PageTransition({ children, className, ...rest }: PageTransitionProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const pathname = useRouterState({ select: (s) => s.location.pathname })
    const isAutoplay = useRouterState({
        select: (s) => Boolean((s.location.search as Record<string, unknown> | undefined)?.autoplay),
    })
    const prevPathRef = useRef(pathname)
    /** Navegación a la espera de que se monte la página nueva. */
    const pendingRef = useRef<PendingEntry | null>(null)
    /** Raíz de la página que se ve ahora: cuando cambia, el contenido nuevo ya está. */
    const lastRootRef = useRef<Element | null>(null)
    const timeoutRef = useRef<number | undefined>(undefined)
    const cancelEntryRef = useRef<(() => void) | null>(null)
    /** Salida de la página vieja en curso (hasta que llega la nueva). */
    const exitRef = useRef<Animation | null>(null)
    /** Copia de la tarjeta de origen, esperando su destino. */
    const ghostRef = useRef<SharedGhost | null>(null)
    /** Reintento del foco al volver de una ficha, hasta que la tarjeta esté en la lista. */
    const focusRef = useRef<(() => void) | null>(null)

    const dropExit = () => {
        exitRef.current?.cancel()
        exitRef.current = null
    }
    const dropGhost = () => {
        ghostRef.current?.destroy()
        ghostRef.current = null
    }

    /** Lanza la entrada (fundido + escalonado + vuelo) sobre la página actual. Una sola vez por navegación. */
    const runEntryNow = () => {
        const pending = pendingRef.current
        if (!pending) return
        pendingRef.current = null
        window.clearTimeout(timeoutRef.current)
        cancelEntryRef.current?.()
        cancelEntryRef.current = null
        focusRef.current?.()
        focusRef.current = null

        const container = containerRef.current
        const el = contentRef.current
        lastRootRef.current = el?.firstElementChild ?? null

        // La entrada continúa desde la opacidad a la que había llegado la salida (se lee del progreso de la
        // animación: leerla con getComputedStyle forzaría un recálculo de estilos de la página recién montada).
        const exitOpacity = exitOpacityOf(exitRef.current)
        dropExit()
        const ghost = ghostRef.current
        ghostRef.current = null

        // Reset scroll position al cambiar de página principal o entrar a detalle
        if (container) container.scrollTop = 0

        // La tarjeta que se tocó ya no existe: sin esto el foco cae al <body> y el lector de pantalla
        // pierde dónde está. Se lo lleva al contenedor de la página (sin scroll, sin anillo visible).
        const active = document.activeElement
        if (!active || active === document.body || !active.isConnected) container?.focus({ preventScroll: true })

        const nav = classifyNavigation(pending.prevPath, pending.nextPath)
        const key = pending.sharedKey

        // Volver de una ficha: el foco vuelve a la tarjeta de origen en cualquier caso (con o sin animación,
        // movimiento reducido incluido). La lista puede montar la tarjeta después: se reintenta un rato.
        if (nav.kind === "drill-out" && key) {
            focusRef.current = restoreFocusWhenReady(key, container, getDeparture(key), FOCUS_RESTORE_MS)
        }

        if (!el || typeof el.animate !== "function" || pending.autoplay || prefersReducedMotion()) {
            ghost?.destroy()
            return
        }

        // Elemento compartido. Drill-in: la copia vuela desde la tarjeta hasta la portada de la ficha
        // (que ya está montada). Drill-out: la portada de la ficha vuela de regreso hasta el lugar donde
        // estaba la tarjeta; ahí la lista todavía no restauró su scroll ni montó la tarjeta, así que el
        // vuelo se decide en el cuadro siguiente con el lugar que se recordó al salir.
        let flight: Animation | null = null
        let release = () => {}
        let dest: HTMLElement | null = null
        let returning: Departure | null = null
        if (ghost && key) {
            if (nav.kind === "drill-in") {
                dest = findSharedPoster(key, el)
                if (dest) {
                    release = holdPosterHidden(dest, SHARED_FLIGHT_MS + 600)
                    flight = ghost.fly(dest.getBoundingClientRect())
                    if (!flight) {
                        release()
                        release = () => {}
                    }
                }
            } else if (nav.kind === "drill-out") {
                returning = getDeparture(key) ?? null
            }
            if (!flight && !returning) ghost.dismiss()
        } else {
            ghost?.destroy()
        }
        const shared = flight !== null || returning !== null

        // Escalonado de los bloques principales (hero, luego cuerpo). Con vuelo de portada la página solo se
        // funde: los bloques que suben moverían el destino mientras la copia aterriza. Se decide antes de animar
        // el contenedor: si hay bloques escalonados, el contenedor solo se desplaza, porque cada bloque ya se
        // funde desde su propia opacidad (si el contenedor también bajara, el primer cuadro quedaría a 0,6 × 0,6).
        const startOpacity = entryStartOpacity(exitOpacity)
        const blocks = !shared && el.firstElementChild instanceof HTMLElement ? staggerBlocksOf(el.firstElementChild) : []
        const animation = el.animate(enterKeyframes(nav, startOpacity, shared, blocks.length > 0), {
            duration: NAV_ENTER_MS,
            easing: NAV_EASING,
        })
        // Avisar mientras dura la entrada: el trabajo diferido (DeferredMount, etc.) espera a
        // que termine, así no cae a mitad del fundido y le roba cuadros (medido: 37-67 ms).
        // Al volver de una ficha NO se espera: el router restaura el scroll de la lista y lo que se ve es
        // justo el cuerpo diferido (medido: ~500 ms de página vacía bajo el scroll restaurado).
        if (nav.kind !== "drill-out") container?.setAttribute(PAGE_ENTERING_ATTR, "")
        const staggered = staggerEnter(blocks, startOpacity)
        // La entrada termina cuando acaban el fundido de la página, los bloques escalonados y el vuelo.
        const all = flight ? [animation, ...staggered, flight] : [animation, ...staggered]
        // Token de esta entrada: al cancelarla, sus animaciones no deben cerrar la entrada siguiente.
        const token = { live: true }
        let remaining = all.length + (returning ? 1 : 0)
        const done = () => {
            if (!token.live) return
            if (--remaining > 0) return
            container?.removeAttribute(PAGE_ENTERING_ATTR)
            window.dispatchEvent(new Event(PAGE_ENTERED_EVENT))
        }
        for (const a of all) {
            // finish y cancel son excluyentes para una misma animación: cada una cuenta una sola vez.
            let counted = false
            const count = () => {
                if (counted) return
                counted = true
                done()
            }
            a.addEventListener("finish", count)
            a.addEventListener("cancel", count)
        }
        if (flight) {
            flight.addEventListener("finish", () => {
                release()
                ghost?.land(dest)
            })
            flight.addEventListener("cancel", () => {
                release()
                ghost?.destroy()
            })
        }

        // Regreso a la lista: cuadro siguiente, ya con el scroll restaurado por el router.
        let returnRaf = 0
        let returnFlight: Animation | null = null
        if (ghost && key && returning) {
            const departure = returning
            returnRaf = requestAnimationFrame(() => {
                returnRaf = 0
                const valid = container ? departureStillValid(departure, container.scrollTop, viewportOf()) : false
                returnFlight = valid ? ghost.fly(departure.box) : null
                if (!returnFlight) {
                    ghost.dismiss()
                    done()
                    return
                }
                returnFlight.addEventListener("finish", () => {
                    // La tarjeta de la lista que estaba en ese lugar (no la otra copia de la misma película).
                    ghost.land(findSharedPoster(key, document, departure.box))
                    done()
                })
                returnFlight.addEventListener("cancel", () => {
                    ghost.destroy()
                    done()
                })
            })
        }
        cancelEntryRef.current = () => {
            token.live = false
            if (returnRaf) {
                cancelAnimationFrame(returnRaf)
                ghost?.destroy()
            }
            animation.cancel()
            staggered.forEach((a) => a.cancel())
            flight?.cancel()
            returnFlight?.cancel()
        }
    }

    /** Si la página nueva no llega a tiempo, se suelta lo que quedó colgado; la entrada espera a la página real. */
    const swapTimeoutNow = () => {
        if (!pendingRef.current) return
        if (isRoutePendingPlaceholder(contentRef.current?.firstElementChild ?? null)) {
            // La ruta sigue cargando: no se anima el placeholder. Se quita la copia y la salida, y la entrada
            // queda pendiente hasta que el observer vea la página real.
            dropGhost()
            dropExit()
            return
        }
        runEntry.current()
    }

    // Los refs apuntan siempre a la versión de este render antes de que corra la lógica de cambio de ruta
    // (este efecto se declara antes que el de la URL).
    const runEntry = useRef<() => void>(() => {})
    const onSwapTimeout = useRef<() => void>(() => {})
    useLayoutEffect(() => {
        runEntry.current = runEntryNow
        onSwapTimeout.current = swapTimeoutNow
    })

    // La URL cambió: la entrada queda pendiente hasta que se monte el contenido nuevo.
    useLayoutEffect(() => {
        if (prevPathRef.current === pathname) return
        const prevPath = prevPathRef.current
        prevPathRef.current = pathname
        // Una navegación que llega con otra en vuelo la reemplaza.
        dropGhost()
        const kind = classifyNavigation(prevPath, pathname).kind
        pendingRef.current = { prevPath, nextPath: pathname, autoplay: isAutoplay, sharedKey: sharedKeyFor(kind, prevPath, pathname) }

        const el = contentRef.current
        const root = el?.firstElementChild ?? null
        // Misma ruta con otro parámetro (`/series/1` → `/series/2`): la raíz no cambia, se anima ya.
        // O el contenido nuevo ya estaba montado antes de que llegara este aviso.
        if (routeShape(prevPath) === routeShape(pathname) || root !== lastRootRef.current) {
            runEntry.current()
            return
        }

        // La página vieja sigue a la vista mientras se monta la nueva: responde al clic ya.
        if (el && typeof el.animate === "function" && !isAutoplay && !prefersReducedMotion()) {
            if (!exitRef.current) {
                exitRef.current = el.animate(exitKeyframes(), { duration: NAV_EXIT_MS, easing: NAV_EASING, fill: "forwards" })
            }
            // Tarjeta de origen: se deja una copia encima, sin cambio visible, para que vuele luego.
            // Al entrar a una ficha se recuerda dónde estaba la tarjeta, para el regreso.
            const key = pendingRef.current?.sharedKey
            if (key && (kind === "drill-in" || kind === "drill-out")) {
                ghostRef.current = liftSharedPoster(key)
                if (kind === "drill-in" && ghostRef.current) {
                    rememberDeparture(key, ghostRef.current.origin, containerRef.current?.scrollTop ?? 0)
                }
            }
        }
        timeoutRef.current = window.setTimeout(() => onSwapTimeout.current(), CONTENT_SWAP_TIMEOUT_MS)
        return () => window.clearTimeout(timeoutRef.current)
    }, [pathname, isAutoplay])

    // Detecta el montaje del contenido nuevo: cambia el elemento raíz bajo el contenedor.
    useEffect(() => {
        const el = contentRef.current
        if (!el) return
        lastRootRef.current = el.firstElementChild
        const observer = new MutationObserver(() => {
            const root = el.firstElementChild
            if (root === lastRootRef.current) return
            // Mientras la ruta carga, el router muestra su placeholder: todavía no es la página nueva.
            if (isRoutePendingPlaceholder(root)) {
                lastRootRef.current = root
                return
            }
            if (pendingRef.current) runEntry.current()
            else lastRootRef.current = root
        })
        observer.observe(el, { childList: true })
        return () => {
            observer.disconnect()
            window.clearTimeout(timeoutRef.current)
            cancelEntryRef.current?.()
            focusRef.current?.()
            focusRef.current = null
            dropExit()
            dropGhost()
        }
    }, [])

    // Qué portada se tocó: con una misma película en dos sitios, la vista que se levanta es la del clic.
    useEffect(() => {
        const onClick = (e: MouseEvent) => noteActivation(e.target)
        window.addEventListener("click", onClick, true)
        return () => window.removeEventListener("click", onClick, true)
    }, [])

    return (
        <div ref={containerRef} className={cn("h-full w-full flex flex-col", className)} {...rest}>
            <div ref={contentRef} className="flex flex-1 flex-col w-full">
                {children}
            </div>
        </div>
    )
}
