import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react"
import { useRouterState } from "@tanstack/react-router"
import { cn } from "@/components/ui/core/styling"

type PageTransitionProps = ComponentPropsWithoutRef<"div">

/** Curva ease-out fuerte del sistema (--ease-out en animation.css). */
const PAGE_ENTER_EASING = "cubic-bezier(0.23, 1, 0.32, 1)"
const PAGE_ENTER_MS = 200
/**
 * Opacidad inicial de la página que entra. No arranca en 0: la vieja ya se
 * desmontó y, si el hilo principal se traba en el primer cuadro (render de la
 * ruta, decodificación de imágenes), una entrada desde 0 dejaba ver el fondo
 * vacío ~100-200 ms: un parpadeo a negro en cada navegación (medido cuadro a
 * cuadro en Inicio → Series). Desde 0.6 sigue sin ser un corte seco.
 */
const PAGE_ENTER_FROM_OPACITY = 0.6

const MAIN_TAB_ORDER: Record<string, number> = {
    "/home": 0,
    "/series": 1,
    "/movies": 2,
    "/chronology": 3,
    "/admin": 4,
    "/settings": 5,
}

function getNavigationKeyframes(prevPath: string, nextPath: string): Keyframe[] {
    const isPrevDetail = Boolean(prevPath.match(/\/(movies|series)\/[^/]+/))
    const isNextDetail = Boolean(nextPath.match(/\/(movies|series)\/[^/]+/))

    // Drill-in: pasando de lista o catálogo a ficha de detalle (ascenso sutil con leve escala)
    if (!isPrevDetail && isNextDetail) {
        return [
            { opacity: PAGE_ENTER_FROM_OPACITY, transform: "translate3d(0, 10px, 0) scale(0.995)" },
            { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
        ]
    }

    // Drill-out: volviendo de ficha de detalle a catálogo o lista (descenso suave)
    if (isPrevDetail && !isNextDetail) {
        return [
            { opacity: PAGE_ENTER_FROM_OPACITY, transform: "translate3d(0, -6px, 0)" },
            { opacity: 1, transform: "translate3d(0, 0, 0)" },
        ]
    }

    // Navegación horizontal entre pestañas principales de la barra flotante
    const prevOrder = MAIN_TAB_ORDER[prevPath]
    const nextOrder = MAIN_TAB_ORDER[nextPath]
    if (prevOrder !== undefined && nextOrder !== undefined && prevOrder !== nextOrder) {
        const xOffset = nextOrder > prevOrder ? 8 : -8
        return [
            { opacity: PAGE_ENTER_FROM_OPACITY, transform: `translate3d(${xOffset}px, 0, 0)` },
            { opacity: 1, transform: "translate3d(0, 0, 0)" },
        ]
    }

    // Transición estándar para el resto de rutas (ascenso sutil de 6px)
    return [
        { opacity: PAGE_ENTER_FROM_OPACITY, transform: "translate3d(0, 6px, 0)" },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
    ]
}

/**
 * Contenedor de scroll de las páginas. Al cambiar de ruta, la página nueva entra con
 * un fundido direccional y físico según la jerarquía (tabs horizontales, drill-in
 * a detalle o drill-out a catálogo), evitando cortes secos o saltos abruptos.
 *
 * Se anima solo el envoltorio interno con WAAPI (compositor, sin re-montar la ruta) y
 * sin `fill`: al terminar no queda ningún transform que rompa los `position: fixed`
 * de modales o del reproductor. Se omite con movimiento reducido y al entrar directo
 * al reproductor (`autoplay`), donde ya hay una pantalla de carga continua.
 */
export function PageTransition({ children, className, ...rest }: PageTransitionProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const pathname = useRouterState({ select: (s) => s.location.pathname })
    const isAutoplay = useRouterState({
        select: (s) => Boolean((s.location.search as Record<string, unknown> | undefined)?.autoplay),
    })
    const prevPathRef = useRef(pathname)

    useLayoutEffect(() => {
        if (prevPathRef.current === pathname) return
        const prevPath = prevPathRef.current
        prevPathRef.current = pathname

        // Reset scroll position al cambiar de página principal o entrar a detalle
        if (containerRef.current) {
            containerRef.current.scrollTop = 0
        }

        const el = contentRef.current
        if (!el || typeof el.animate !== "function" || isAutoplay) return
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return

        const keyframes = getNavigationKeyframes(prevPath, pathname)
        const animation = el.animate(keyframes, {
            duration: PAGE_ENTER_MS,
            easing: PAGE_ENTER_EASING,
        })
        return () => animation.cancel()
    }, [pathname, isAutoplay])

    return (
        <div ref={containerRef} className={cn("h-full w-full flex flex-col", className)} {...rest}>
            <div ref={contentRef} className="flex flex-1 flex-col w-full">
                {children}
            </div>
        </div>
    )
}
