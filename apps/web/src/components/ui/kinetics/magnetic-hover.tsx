import * as React from "react"
import { m, type HTMLMotionProps } from "framer-motion"
import { useSpringPreset, useMotionTier } from "./hooks"

interface MagneticHoverProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode
    scale?: number
    x?: number
}

const FINE_HOVER_QUERY = "(hover: hover) and (pointer: fine)"

/** ¿El puntero principal puede hacer hover (mouse o trackpad)? false en táctil. */
function useFineHover(): boolean {
    return React.useSyncExternalStore(
        (notify) => {
            if (typeof window === "undefined" || !window.matchMedia) return () => {}
            const mql = window.matchMedia(FINE_HOVER_QUERY)
            mql.addEventListener("change", notify)
            return () => mql.removeEventListener("change", notify)
        },
        () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(FINE_HOVER_QUERY).matches,
        () => false,
    )
}

/**
 * Hover magnético solo con puntero fino y presión con el spring `press`.
 * Fuera del tier "full" (movimiento reducido, bajo consumo o TV) es un div plano.
 */
export const MagneticHover = React.forwardRef<HTMLDivElement, MagneticHoverProps>(
    ({ children, className, scale = 1.012, x = 2, ...props }, ref) => {
        const cardSpring = useSpringPreset("cardHover")
        const pressSpring = useSpringPreset("press")
        const tier = useMotionTier()
        const fineHover = useFineHover()

        if (tier !== "full") {
            return (
                <div ref={ref} className={className} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
                    {children}
                </div>
            )
        }

        return (
            <m.div
                ref={ref}
                whileHover={fineHover ? { scale, x } : undefined}
                whileTap={{ scale: 0.96, transition: pressSpring }}
                transition={cardSpring}
                className={className}
                {...props}
            >
                {children}
            </m.div>
        )
    }
)

MagneticHover.displayName = "MagneticHover"
