import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react"
import { useRouterState } from "@tanstack/react-router"
import { cn } from "@/components/ui/core/styling"

type PageTransitionProps = ComponentPropsWithoutRef<"div">

/** Curva ease-out fuerte del sistema (--ease-out en animation.css). */
const PAGE_ENTER_EASING = "cubic-bezier(0.23, 1, 0.32, 1)"
const PAGE_ENTER_MS = 240

/**
 * Contenedor de scroll de las páginas. Al cambiar de ruta, la página nueva entra con
 * un fundido corto y un leve ascenso, así navegar no se siente como un corte seco.
 *
 * Se anima solo el envoltorio interno con WAAPI (compositor, sin re-montar la ruta) y
 * sin `fill`: al terminar no queda ningún transform que rompa los `position: fixed`
 * de modales o del reproductor. Se omite con movimiento reducido y al entrar directo
 * al reproductor (`autoplay`), donde ya hay una pantalla de carga continua.
 */
export function PageTransition({ children, className, ...rest }: PageTransitionProps) {
    const contentRef = useRef<HTMLDivElement>(null)
    const pathname = useRouterState({ select: (s) => s.location.pathname })
    const isAutoplay = useRouterState({
        select: (s) => Boolean((s.location.search as Record<string, unknown> | undefined)?.autoplay),
    })
    const prevPathRef = useRef(pathname)

    useLayoutEffect(() => {
        if (prevPathRef.current === pathname) return
        prevPathRef.current = pathname
        const el = contentRef.current
        if (!el || typeof el.animate !== "function" || isAutoplay) return
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return

        const animation = el.animate(
            [
                { opacity: 0, transform: "translate3d(0, 8px, 0)" },
                { opacity: 1, transform: "translate3d(0, 0, 0)" },
            ],
            { duration: PAGE_ENTER_MS, easing: PAGE_ENTER_EASING },
        )
        return () => animation.cancel()
    }, [pathname, isAutoplay])

    return (
        <div className={cn("h-full w-full flex flex-col", className)} {...rest}>
            <div ref={contentRef} className="flex flex-1 flex-col w-full">
                {children}
            </div>
        </div>
    )
}
