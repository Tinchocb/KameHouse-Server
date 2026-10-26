import { startTransition, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { whenPageEntered } from "./page-enter-signal"

interface DeferredMountProps {
    children: ReactNode
    /**
     * Identifica el bloque para recordar su alto entre visitas. Al volver a la
     * página se reserva ese alto desde el primer cuadro, y la restauración del
     * scroll (volver atrás desde una ficha) cae donde estaba en vez de quedar
     * recortada contra una página todavía vacía.
     */
    heightKey: string
    /** Alto reservado la primera vez, cuando todavía no se conoce el real. */
    fallbackHeight?: number | string
    /** Clases del contenedor (el contenido hereda su layout: `space-y-8`, grillas, etc.). */
    className?: string
    /** Monta desde el primer render (sin diferir): para bloques que otro efecto necesita en el montaje. */
    immediate?: boolean
    /** Avisa cuando el contenido ya está montado (después del commit), para que quien mide el DOM vuelva a hacerlo. */
    onMount?: () => void
}

/** Fracción superior de la pantalla que cuenta como "visible al entrar". */
const VISIBLE_ON_ENTRY_RATIO = 0.7

/** Último alto medido por bloque, durante la sesión. */
const knownHeights = new Map<string, number>()

/**
 * Monta `children` DESPUÉS del primer pintado de la página, dentro de una
 * transición de React (el render se corta en porciones y no bloquea la entrada).
 *
 * Por qué: el router publica la ubicación por useSyncExternalStore, así que el
 * render de la ruta nueva es síncrono. Todo lo que está bajo el pliegue (filas,
 * grillas) se pagaba dentro del cuadro del click (50-270 ms medidos). Lo que no
 * se ve al entrar puede llegar un par de cuadros después.
 *
 * Una vez montado se queda montado: cambiar filtros o datos no lo desmonta.
 */
export function DeferredMount({ children, heightKey, fallbackHeight = "60vh", className, immediate = false, onMount }: DeferredMountProps) {
    const [ready, setReady] = useState(immediate)
    const ref = useRef<HTMLDivElement>(null)
    const onMountRef = useRef(onMount)
    useLayoutEffect(() => {
        onMountRef.current = onMount
    })

    useEffect(() => {
        if (ready) return
        let raf2 = 0
        let cancelWait = () => {}
        // rAF #1 corre antes del primer pintado; rAF #2, ya pintado. Después, si la página todavía
        // está en su animación de entrada, se espera a que termine (o a que el usuario scrollee).
        const mount = () => startTransition(() => setReady(true))
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => {
                // Si el bloque ya se ve bien al entrar (empieza en el 70 % superior de la pantalla),
                // esperar al fin del fundido lo retrasaba justo cuando el usuario lo está mirando
                // (episodios de la ficha: primer episodio a y=736 de 900). Solo lo que queda abajo espera.
                const top = ref.current?.getBoundingClientRect().top ?? 0
                if (top < window.innerHeight * VISIBLE_ON_ENTRY_RATIO) mount()
                else cancelWait = whenPageEntered(mount)
            })
        })
        return () => {
            cancelAnimationFrame(raf1)
            cancelAnimationFrame(raf2)
            cancelWait()
        }
    }, [ready])

    // Al montarse, el contenido entra con un fundido corto: en pantallas altas parte de él ya está
    // a la vista y aparecer de golpe se nota. Solo opacity (compositor); omitido con movimiento reducido.
    // useLayoutEffect: el montaje llega en una transición, y en ese carril React corre los efectos
    // pasivos en otra tarea; el navegador podía pintar el contenido opaco un cuadro antes del fundido.
    // Con `immediate` no hubo diferimiento: el contenido se muestra tal cual, sin fundido.
    useLayoutEffect(() => {
        const el = ref.current
        if (immediate || !ready || !el || typeof el.animate !== "function") return
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
        const fade = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" })
        return () => fade.cancel()
    }, [ready, immediate])

    // Aviso una sola vez por montaje del contenido (lo lee la última versión de onMount).
    useEffect(() => {
        if (ready) onMountRef.current?.()
    }, [ready])

    // Con el contenido montado, recordar su alto (también cuando crece al cargar datos).
    useEffect(() => {
        const el = ref.current
        if (!ready || !el || typeof ResizeObserver === "undefined") return
        const observer = new ResizeObserver(() => {
            if (el.offsetHeight > 0) knownHeights.set(heightKey, el.offsetHeight)
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [ready, heightKey])

    return (
        <div ref={ref} className={className} style={ready ? undefined : { minHeight: knownHeights.get(heightKey) ?? fallbackHeight }}>
            {ready ? children : null}
        </div>
    )
}
