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

    React.useEffect(() => {
        if (!imageSrc) {
            setBackdropUrl(null)
            return
        }

        const finalUrl = optimizeResolution ? getLargeResImage(imageSrc) : imageSrc
        setBackdropUrl(finalUrl)
    }, [imageSrc, setBackdropUrl, optimizeResolution])
}

/**
 * Provee una referencia a un elemento DOM y aplica un desplazamiento parallax optimizado
 * con requestAnimationFrame al hacer scroll en la ventana o contenedor padre.
 * Se puede desactivar (eco / reduced-motion) y no hace nada cuando el hero
 * está fuera del viewport para no desperdiciar writes de transform.
 */
export function useHeroParallax<T extends HTMLElement = HTMLDivElement>(speed: number = 0.15, options?: { disabled?: boolean }) {
    const ref = React.useRef<T>(null)
    const disabled = options?.disabled ?? false

    React.useEffect(() => {
        if (disabled) return
        if (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return
        }
        let rafId: number | null = null

        const handleScroll = (e: Event) => {
            if (rafId) return
            rafId = requestAnimationFrame(() => {
                rafId = null
                const el = ref.current
                if (!el) return
                // Sin trabajo inútil fuera de pantalla: evita invalidar el layer
                // del hero mientras el usuario lee las sagas/películas de abajo.
                const rect = el.getBoundingClientRect()
                if (rect.bottom < 0 || rect.top > window.innerHeight) return
                const target = e.target
                if (target === document || target === window) {
                    el.style.transform = `translate3d(0, ${window.scrollY * speed}px, 0)`
                } else if (target instanceof HTMLElement && target.scrollTop > 0) {
                    el.style.transform = `translate3d(0, ${target.scrollTop * speed}px, 0)`
                }
            })
        }

        window.addEventListener("scroll", handleScroll, { capture: true, passive: true })
        return () => {
            window.removeEventListener("scroll", handleScroll, { capture: true })
            if (rafId) cancelAnimationFrame(rafId)
        }
    }, [speed, disabled])

    return ref
}
