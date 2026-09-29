import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/components/ui/core/styling"

/** Progreso de scroll (0..1) de un contenedor. */
export function scrollProgress(scrollTop: number, scrollHeight: number, clientHeight: number): number {
    const max = scrollHeight - clientHeight
    if (max <= 0) return 0
    return Math.min(1, Math.max(0, scrollTop / max))
}

interface ScrollProgressProps {
    /** Contenedor que scrollea; por defecto el principal de la app ([data-scroll-container]). */
    container?: HTMLElement | null
    className?: string
}

/**
 * Barra fina arriba de todo que muestra cuánto se recorrió la página. Pensada
 * para páginas largas (Cronología). Se actualiza con transform: scaleX en un
 * requestAnimationFrame por cuadro (sin re-renders) y aparece recién al bajar.
 * Se monta mediante Portal en document.body para evitar que los filtros y transformaciones
 * cinéticas del contenedor de página rompan su coordenada fixed.
 */
export function ScrollProgress({ container, className }: ScrollProgressProps) {
    const barRef = React.useRef<HTMLDivElement>(null)

    // El portal se monta en el mismo commit que el componente (SPA, sin SSR):
    // barRef ya apunta a la barra cuando corre el efecto.
    React.useEffect(() => {
        const scroller = container ?? document.querySelector<HTMLElement>('[data-scroll-container="true"]')
        const bar = barRef.current
        if (!scroller || !bar) return
        let raf = 0
        const update = () => {
            raf = 0
            const p = scrollProgress(scroller.scrollTop, scroller.scrollHeight, scroller.clientHeight)
            bar.style.transform = `scaleX(${p})`
            bar.style.opacity = scroller.scrollTop > 8 ? "1" : "0"
        }
        const onScroll = () => {
            if (!raf) raf = requestAnimationFrame(update)
        }
        // Solo medir si ya se encuentra scrolleado; en scrollTop=0 se evita el reflow síncrono en el montaje
        if (scroller.scrollTop > 0) {
            update()
        }
        scroller.addEventListener("scroll", onScroll, { passive: true })
        return () => {
            scroller.removeEventListener("scroll", onScroll)
            if (raf) cancelAnimationFrame(raf)
        }
    }, [container])

    if (typeof document === "undefined") return null

    return createPortal(
        <div
            ref={barRef}
            aria-hidden
            className={cn(
                "pointer-events-none fixed inset-x-0 top-0 z-navbar h-0.5 origin-left bg-brand-accent",
                "shadow-[0_0_8px_hsl(var(--brand-accent)/0.6)] opacity-0 transition-opacity duration-fast",
                className,
            )}
            style={{ transform: "scaleX(0)" }}
        />,
        document.body,
    )
}
