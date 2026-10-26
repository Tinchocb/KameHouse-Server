import * as React from "react"
import { AnimatePresence, m, useReducedMotion } from "framer-motion"
import { cn } from "@/components/ui/core/styling"

/** Mismos valores que --duration-base (250 ms) y --ease-out de animation.css (framer no lee variables CSS). */
const NAV_LABEL_TRANSITION = { duration: 0.25, ease: [0.23, 1, 0.32, 1] } as const
const NAV_LAYOUT_TRANSITION = NAV_LABEL_TRANSITION
const INSTANT = { duration: 0 } as const

export function useNavTransition() {
    const reduced = useReducedMotion()
    return reduced ? INSTANT : NAV_LAYOUT_TRANSITION
}

interface NavLabelProps {
    show: boolean
    children: React.ReactNode
    className?: string
    /** Eje del deslizamiento: "x" para etiquetas al costado del ícono, "y" si van debajo. */
    axis?: "x" | "y"
}

/**
 * Etiqueta de un destino de la barra. Al ocultarse hace fundido + deslizamiento
 * corto (solo `opacity` y `transform`) y sale del flujo al instante
 * (`popLayout`), de modo que el resto de la barra se reacomoda con `layout` en
 * vez de animar el ancho. El nombre accesible NO depende de esta etiqueta:
 * el enlace o botón lleva `aria-label`, y esto es solo la parte visual.
 */
export function NavLabel({ show, children, className, axis = "x" }: NavLabelProps) {
    const reduced = useReducedMotion()
    const slide = reduced ? 0 : 6
    const offset = axis === "x" ? { x: -slide } : { y: slide }
    const rest = axis === "x" ? { x: 0 } : { y: 0 }
    return (
        <AnimatePresence initial={false} mode="popLayout">
            {show && (
                <m.span
                    key="label"
                    aria-hidden="true"
                    initial={{ opacity: 0, ...offset }}
                    animate={{ opacity: 1, ...rest }}
                    exit={{ opacity: 0, ...offset }}
                    transition={reduced ? INSTANT : NAV_LABEL_TRANSITION}
                    className={cn("whitespace-nowrap", className)}
                >
                    {children}
                </m.span>
            )}
        </AnimatePresence>
    )
}

/**
 * Tooltip de solo CSS para un destino que quedó en ícono: aparece con el puntero
 * o con el foco de teclado. Es decorativo (aria-hidden); el nombre accesible lo
 * da el `aria-label` del control. El padre debe ser `group relative`.
 */
export function NavTooltip({ show, children }: { show: boolean; children: React.ReactNode }) {
    if (!show) return null
    return (
        <span
            aria-hidden="true"
            className={cn(
                "pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1",
                "bg-surface-container-high text-xs font-medium text-on-surface shadow-elevation-2 border border-white/10",
                "opacity-0 transition-opacity duration-quick ease-out motion-reduce:transition-none",
                "group-hover:opacity-100 group-focus-visible:opacity-100",
            )}
        >
            {children}
        </span>
    )
}
