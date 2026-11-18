import * as React from "react"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { getLargeResImage } from "@/lib/helpers/images"
import { useMediaQuery } from "./use-media-query"

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

/** Resolve the page owner once; avoid incidental overflow on clipped artwork. */
function getScrollTarget(el: HTMLElement): HTMLElement | Window {
    const page = el.closest<HTMLElement>('[data-scroll-container="true"]')
    if (page) return page
    for (let node = el.parentElement; node; node = node.parentElement) {
        const { overflowY } = getComputedStyle(node)
        if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node
    }
    return window
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
    options?: { disabled?: boolean; maxOffset?: number; scrollContainerRef?: React.RefObject<HTMLElement | null> }
) {
    const ref = React.useRef<T>(null)
    const disabled = options?.disabled ?? false
    const maxOffset = options?.maxOffset ?? Infinity
    const scrollContainerRef = options?.scrollContainerRef

    const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
    React.useEffect(() => {
        const el = ref.current
        if (disabled || reducedMotion || !el) return
        const target = scrollContainerRef?.current ?? getScrollTarget(el)
        let rafId = 0
        let visible = true
        let previousOffset: number | null = null
        const update = () => {
            rafId = 0
            if (!visible) return
            if (!intersection) {
                const rect = el.getBoundingClientRect()
                if (rect.bottom < 0 || rect.top > window.innerHeight) return
            }
            const top = target instanceof HTMLElement ? target.scrollTop : window.scrollY
            const offset = Math.min(Math.max(0, top) * speed, maxOffset)
            if (offset !== previousOffset) {
                el.style.transform = `translate3d(0, ${offset}px, 0)`
                previousOffset = offset
            }
        }
        const schedule = () => { if (visible && !rafId) rafId = requestAnimationFrame(update) }
        const intersection = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
            visible = entries.some(entry => entry.isIntersecting)
            if (visible) schedule()
            else if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
        })
        intersection?.observe(el)
        // Listen only to the owner: nested carousels cannot trigger geometry work.
        target.addEventListener("scroll", schedule, { passive: true })
        schedule()
        return () => {
            target.removeEventListener("scroll", schedule)
            intersection?.disconnect()
            if (rafId) cancelAnimationFrame(rafId)
            el.style.transform = ""
        }
    }, [speed, disabled, maxOffset, reducedMotion, scrollContainerRef])

    return ref
}

