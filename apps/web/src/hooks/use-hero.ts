import * as React from "react"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { getLargeResImage } from "@/lib/helpers/images"

/**
 * Sincroniza una imagen de backdrop con el DynamicBackdrop global del IntelligenceStore.
 * Al desmontar o cambiar, limpia o actualiza el backdrop de manera segura.
 */
export function useHeroBackdrop(imageSrc: string | null | undefined, options?: { optimizeResolution?: boolean }) {
    const setBackdropUrl = useIntelligenceStore((state) => state.setBackdropUrl)
    const optimizeResolution = options?.optimizeResolution ?? true
    const deferredSrc = React.useDeferredValue(imageSrc)
    const currentUrlRef = React.useRef<string | null>(null)

    React.useEffect(() => {
        if (!deferredSrc) {
            if (currentUrlRef.current !== null) {
                currentUrlRef.current = null
                setBackdropUrl(null)
            }
            return
        }

        const finalUrl = optimizeResolution ? getLargeResImage(deferredSrc) : deferredSrc
        if (currentUrlRef.current === finalUrl) return

        const timer = setTimeout(() => {
            currentUrlRef.current = finalUrl
            setBackdropUrl(finalUrl)
        }, 150)

        return () => clearTimeout(timer)
    }, [deferredSrc, setBackdropUrl, optimizeResolution])
}

/** scrollTop del ancestro con scroll vertical (o de la ventana si no hay). */
function getScrollTop(el: HTMLElement): number {
    for (let node = el.parentElement; node; node = node.parentElement) {
        const { overflowY } = getComputedStyle(node)
        if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
            return node.scrollTop
        }
    }
    return window.scrollY
}

/**
 * Provee una referencia a un elemento DOM y aplica un desplazamiento parallax optimizado
 * con requestAnimationFrame al hacer scroll en la ventana o contenedor padre.
 * Se puede desactivar (eco / reduced-motion) y no hace nada cuando el hero
 * está fuera del viewport para no desperdiciar writes de transform.
 *
 * `maxOffset` topa el desplazamiento: la capa debe sobresalir por arriba al
 * menos esa cantidad, si no, al bajar deja al descubierto una franja del fondo.
 */
export function useHeroParallax<T extends HTMLElement = HTMLDivElement>(
    speed: number = 0.15,
    options?: { disabled?: boolean; maxOffset?: number }
) {
    const ref = React.useRef<T>(null)
    const disabled = options?.disabled ?? false
    const maxOffset = options?.maxOffset ?? Infinity

    React.useEffect(() => {
        if (disabled) return
        if (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return
        }
        let rafId: number | null = null

        const handleScroll = () => {
            if (rafId) return
            rafId = requestAnimationFrame(() => {
                rafId = null
                const el = ref.current
                if (!el) return
                // Sin trabajo inútil fuera de pantalla: evita invalidar el layer
                // del hero mientras el usuario lee las sagas/películas de abajo.
                const rect = el.getBoundingClientRect()
                if (rect.bottom < 0 || rect.top > window.innerHeight) return
                // No se usa e.target: con el throttle por frame el primer evento
                // puede venir de otro contenedor (swimlanes, drag) con scrollTop 0.
                // Se lee siempre el ancestro que mueve al hero, incluido 0, para que
                // al volver arriba la capa regrese exacta a su lugar.
                const offset = Math.min(Math.max(0, getScrollTop(el)) * speed, maxOffset)
                el.style.transform = `translate3d(0, ${offset}px, 0)`
            })
        }

        window.addEventListener("scroll", handleScroll, { capture: true, passive: true })
        return () => {
            window.removeEventListener("scroll", handleScroll, { capture: true })
            if (rafId) cancelAnimationFrame(rafId)
        }
    }, [speed, disabled, maxOffset])

    return ref
}
